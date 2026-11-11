// Database integration fixtures use the real Casbin provider and SQL migrations.
use super::*;
use diesel_migrations::MigrationHarness;

#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=diesel::sql_types::BigInt)]
    total: i64,
}
async fn pending_count(state: &web::Data<AppState>, org: &str, app: &str) -> Result<i64> {
    let pool = state.db_pool.clone();
    let (org, app) = (org.to_owned(), app.to_owned());
    run_blocking!({
        let mut c = pool.get_timeout(std::time::Duration::from_secs(1))?;
        expire(&mut c, &org, &app)?;
        Ok(diesel::sql_query("SELECT count(*) AS total FROM hyperotaserver.deployment_requests WHERE org_id=$1 AND app_id=$2 AND status='pending' AND (data->>'expires_at')::timestamptz > now()").bind::<Text,_>(org).bind::<Text,_>(app).get_result::<Count>(&mut c)?.total)
    })
}

struct Directory;
#[async_trait::async_trait]
impl crate::provider::authn::AuthNProvider for Directory {
    fn kind(&self) -> crate::types::AuthnProviderKind {
        crate::types::AuthnProviderKind::Keycloak
    }
    fn supports_password_login(&self) -> bool {
        false
    }
    fn supports_signup(&self) -> bool {
        false
    }
    async fn approval_subject_exists(&self, _: &AppState, sub: &str) -> Result<bool> {
        Ok(["maker@test", "checker@test"].contains(&sub))
    }
}
async fn fixture() -> (
    web::Data<AppState>,
    actix_web::dev::ServerHandle,
    std::sync::Arc<std::sync::Mutex<Value>>,
) {
    fixture_with_pool(8).await
}
async fn fixture_with_pool(
    pool_size: u32,
) -> (
    web::Data<AppState>,
    actix_web::dev::ServerHandle,
    std::sync::Arc<std::sync::Mutex<Value>>,
) {
    let url = std::env::var("TEST_DATABASE_URL").expect("disposable TEST_DATABASE_URL required");
    assert!(url.contains("scratch"), "only disposable scratch databases");
    let mut conn = diesel::PgConnection::establish(&url).unwrap();
    conn.run_pending_migrations(crate::MIGRATIONS).unwrap();
    let pool = crate::utils::db::DbPool::builder()
        .max_size(pool_size)
        .build(diesel::r2d2::ConnectionManager::new(url.clone()))
        .unwrap();
    // A real HTTP upstream fixture: releases and config begin empty.
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let upstream_data = std::sync::Arc::new(std::sync::Mutex::new(json!([])));
    let data = upstream_data.clone();
    let server = actix_web::HttpServer::new(move || {
        let data = data.clone();
        actix_web::App::new().default_service(web::to(
            move |req: actix_web::HttpRequest, body: web::Bytes| {
                let mut stored = data.lock().unwrap();
                let response = if stored.is_object() {
                    let path = req.path();
                    if stored["strict_fail"] == true {
                        HttpResponse::ServiceUnavailable()
                            .json(json!({"message":"injected strict resolution outage"}))
                    } else if path.contains("ramp") || path.contains("conclude") {
                        let stage = if path.contains("ramp") {
                            "ramp"
                        } else {
                            "conclude"
                        };
                        if stored["fail_stage"] == stage && stored["failed"] != true {
                            stored["failed"] = json!(true);
                            HttpResponse::BadRequest()
                                .json(json!({"message":"injected pre-application failure"}))
                        } else {
                            let body: Value = serde_json::from_slice(&body).unwrap();
                            let row = &mut stored["rows"][1];
                            row["change_reason"] = body["change_reason"].clone();
                            if stage == "ramp" {
                                row["status"] = json!("INPROGRESS");
                                row["traffic_percentage"] = json!(50)
                            } else {
                                row["status"] = json!("CONCLUDED");
                                row["chosen_variant"] = json!("exp")
                            }
                            HttpResponse::Ok().json(row.clone())
                        }
                    } else if path.contains("experiments") {
                        HttpResponse::Ok()
                            .json(json!({"data":stored["rows"],"total_items":2,"total_pages":1}))
                    } else {
                        HttpResponse::Ok()
                            .insert_header(("x-config-version", "1"))
                            .insert_header(("last-modified", "1970-01-01T00:00:02Z"))
                            .json(json!({"package.index":"index@version:1"}))
                    }
                } else {
                    let rows = if req.path().contains("experiments") {
                        stored.clone()
                    } else {
                        json!([])
                    };
                    HttpResponse::Ok().json(json!({"data":rows,"total_items":0,"total_pages":0}))
                };
                async move { response }
            },
        ))
    })
    .listen(listener)
    .unwrap()
    .run();
    let handle = server.handle();
    actix_web::rt::spawn(server);
    let authz = crate::provider::authz::casbin::CasbinAuthzProvider::new(
        vec!["maker@test".into(), "checker@test".into()],
        pool.clone(),
        None,
    )
    .await
    .unwrap();
    let mut env = crate::types::Environment {
        public_url: String::new(),
        authn_issuer_url: String::new(),
        authn_external_issuer_url: String::new(),
        authn_client_id: String::new(),
        authn_client_secret: String::new(),
        authn_clock_skew_secs: 0,
        auth_admin_client_id: String::new(),
        auth_admin_client_secret: String::new(),
        auth_admin_token_url: String::new(),
        auth_admin_audience: None,
        auth_admin_scopes: None,
        keycloak_url: String::new(),
        realm: String::new(),
        bucket_name: String::new(),
        superposition_org_id: String::new(),
        enabled_oidc_idps: Vec::new(),
        organisation_creation_disabled: false,
        use_legacy_build_packages: false,
        google_spreadsheet_id: String::new(),
        cloudfront_distribution_id: String::new(),
        default_configs: Vec::new(),
    };
    env.superposition_org_id = "scratch".into();
    env.public_url = endpoint.clone();
    let sdk = aws_config::SdkConfig::builder()
        .behavior_version(aws_config::BehaviorVersion::latest())
        .region(aws_config::Region::new("us-east-1"))
        .credentials_provider(aws_sdk_s3::config::SharedCredentialsProvider::new(
            aws_sdk_s3::config::Credentials::new("test", "test", None, None, "test"),
        ))
        .build();
    let state = web::Data::new(AppState {
        env,
        authn_provider: std::sync::Arc::new(Directory),
        authz_provider: std::sync::Arc::new(authz),
        feed_read_permits: crate::utils::db::feed_read_permits(&pool),
        db_pool: pool,
        release_write_db_url: url,
        redis_cache: None,
        s3_client: aws_sdk_s3::Client::new(&sdk),
        cf_client: aws_sdk_cloudfront::Client::new(&sdk),
        superposition_client: superposition_sdk::Client::from_conf(
            superposition_sdk::Config::builder()
                .bearer_token("test".into())
                .endpoint_url(&endpoint)
                .behavior_version_latest()
                .build(),
        ),

        release_superposition_client: superposition_sdk::Client::from_conf(
            superposition_sdk::Config::builder()
                .bearer_token("test".into())
                .endpoint_url(&endpoint)
                .behavior_version_latest()
                .build(),
        ),
        sheets_hub: None,
        provider_registry: std::sync::Arc::new(
            crate::utils::superposition_provider::ProviderRegistry::new(
                "scratch".into(),
                "test".into(),
                endpoint,
            ),
        ),
    });
    state.authz_provider.bootstrap(&state).await.unwrap();
    (state, handle, upstream_data)
}
fn auth(sub: &str, org: &str, app: &str) -> AuthResponse {
    AuthResponse {
        sub: sub.into(),
        authn_sub: sub.into(),
        authn_iss: None,
        authn_email: Some(sub.into()),
        organisation: Some(crate::middleware::auth::AccessLevel {
            name: org.into(),
            level: 4,
        }),
        application: Some(crate::middleware::auth::AccessLevel {
            name: app.into(),
            level: 3,
        }),
        is_super_admin: true,
        username: sub.into(),
    }
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL; no live services or credentials"]
async fn postgres_lifecycle_and_writer_recovery() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, upstream_data) = fixture().await;
    let org = format!("scratch-{}", Uuid::new_v4());
    let app = "test-app";
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, "checker@test", "admin")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, app, "maker@test")
        .await
        .unwrap();
    {
        let mut c = state.db_pool.get().unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,$2,$1)").bind::<Text,_>(&org).bind::<Text,_>(app).execute(&mut c).unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,$2,$3)").bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Jsonb,_>(json!({"enabled":true,"makers":["maker@test"],"checkers":["checker@test","maker@test"]})).execute(&mut c).unwrap();
    }
    let o = org.clone();
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                let sub = req
                    .headers()
                    .get("x-test-actor")
                    .and_then(|s| s.to_str().ok())
                    .unwrap_or("checker@test");
                req.extensions_mut().insert(auth(sub, &o, "test-app"));
                srv.call(req)
            })
            .configure(routes)
            .service(super::super::recovery::list),
    )
    .await;
    // Raise and successfully execute through the real HTTP handler, Casbin, app lock,
    // immutable request store, serving-policy mutation and audit transaction.
    let raise = || {
        test::TestRequest::post().uri("/deployment-requests").insert_header(("x-test-actor","maker@test")).set_json(json!({"action":"set_strict_serving","payload":{"body":{"strict":true}},"reason":"integration"})).to_request()
    };
    let response = test::call_service(&service, raise()).await;
    assert!(
        response.status().is_success(),
        "{:?}",
        test::read_body(response).await
    );
    let r: Value = test::call_and_read_body_json(&service, raise()).await;
    let id = r["id"].as_str().expect("raised request");
    let self_approval: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::post()
            .uri(&format!("/deployment-requests/{id}/approve"))
            .insert_header(("x-test-actor", "maker@test"))
            .set_json(json!({"reason":"self"}))
            .to_request(),
    )
    .await;
    assert_eq!(self_approval["code"], "self_approval");
    let decision = |id: &str| {
        test::TestRequest::post()
            .uri(&format!("/deployment-requests/{id}/approve"))
            .set_json(json!({"reason":"checked"}))
            .to_request()
    };
    let (one, two) = tokio::join!(
        test::call_and_read_body_json::<_, _, Value>(&service, decision(id)),
        test::call_and_read_body_json::<_, _, Value>(&service, decision(id))
    );
    assert_eq!(
        [&one, &two]
            .iter()
            .filter(|r| r["status"] == "executed")
            .count(),
        1,
        "{one} {two}"
    );
    let result = if one["status"] == "executed" {
        one
    } else {
        two
    };
    assert_eq!(result["status"], "executed", "{result}");
    assert_eq!(
        super::super::serving_policy::get(&state, &org, app)
            .await
            .unwrap()["strict"],
        true
    );
    let targeting:Value=test::call_and_read_body_json(&service,test::TestRequest::post().uri("/deployment-requests").insert_header(("x-test-actor","maker@test")).set_json(json!({"action":"create","payload":{"body":{"config":{"boot_timeout":1000,"release_config_timeout":1000}}},"reason":"strict targeting"})).to_request()).await;
    assert!(
        targeting["message"].as_str().unwrap().contains("target"),
        "{targeting}"
    );
    let ws = crate::utils::db::models::WorkspaceName {
        id: 0,
        organization_id: org.clone(),
        application_id: app.into(),
        workspace_name: org.clone(),
    };
    let refused = crate::utils::migrations::migrate_superposition_workspace(
        &ws,
        &state,
        &crate::utils::migrations::SuperpositionMigrationStrategy::Patch,
    )
    .await
    .unwrap_err();
    assert!(refused.to_string().contains("maintenance"));
    let duplicate: Value = test::call_and_read_body_json(&service, decision(id)).await;
    assert_eq!(duplicate["code"], "not_pending");
    // Another request bound to the previous base state is now stale.
    let queued = request_queue(&state, &org, app, Some("pending"))
        .await
        .unwrap();
    let stale: Value =
        test::call_and_read_body_json(&service, decision(queued[0]["id"].as_str().unwrap())).await;
    assert_eq!(stale["code"], "request_stale", "{stale}");
    // Immutability trigger rejects payload tampering, including a change of expiry.
    let mut c = state.db_pool.get().unwrap();
    assert!(diesel::sql_query("UPDATE hyperotaserver.deployment_requests SET data=jsonb_set(data,'{payload_hash}','\"tampered\"') WHERE org_id=$1").bind::<Text,_>(&org).execute(&mut c).is_err());
    // A deliberately corrupted row must also be caught by the execution hash check.
    let mut forged = r.clone();
    forged["id"] = json!(Uuid::new_v4());
    forged["payload_hash"] = json!("bad");
    diesel::sql_query("INSERT INTO hyperotaserver.deployment_requests(id,org_id,app_id,status,data) VALUES($1,$2,$3,'pending',$4)").bind::<SqlUuid,_>(Uuid::parse_str(forged["id"].as_str().unwrap()).unwrap()).bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Jsonb,_>(&forged).execute(&mut c).unwrap();
    let tamper: Value =
        test::call_and_read_body_json(&service, decision(forged["id"].as_str().unwrap())).await;
    assert_eq!(tamper["code"], "hash_mismatch");
    let mut expired = r.clone();
    expired["id"] = json!(Uuid::new_v4());
    expired["expires_at"] = json!(Utc::now() - chrono::Duration::seconds(1));
    diesel::sql_query("INSERT INTO hyperotaserver.deployment_requests(id,org_id,app_id,status,data) VALUES($1,$2,$3,'pending',$4)").bind::<SqlUuid,_>(Uuid::parse_str(expired["id"].as_str().unwrap()).unwrap()).bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Jsonb,_>(&expired).execute(&mut c).unwrap();
    let expiry: Value =
        test::call_and_read_body_json(&service, decision(expired["id"].as_str().unwrap())).await;
    assert_eq!(expiry["code"], "request_expired");
    let queue = request_queue(&state, &org, app, Some("pending"))
        .await
        .unwrap();
    assert!(!queue.iter().any(|q| q["id"] == expired["id"]));
    let events=diesel::sql_query("SELECT payload AS data FROM hyperotaserver.release_events WHERE org_id=$1 AND action='expired'").bind::<Text,_>(&org).load::<Row>(&mut c).unwrap();
    assert_eq!(events.len(), 1);
    let aux = overview_batch(&state, &[(org.clone(), app.into())])
        .await
        .unwrap();
    assert_eq!(
        aux[0]["pending_requests"],
        pending_count(&state, &org, app).await.unwrap()
    );
    assert_eq!(aux[0]["strict"], true);
    // A validated request whose action itself fails advertises the persisted
    // terminal outcome, rather than forcing a client to infer it from HTTP 400.
    let mut failing = r.clone();
    failing["id"] = json!(Uuid::new_v4());
    failing["action"] = json!("set_rollback_sensitive");
    let mut payload = json!({"release_id":"test-release","body":{"rollback_sensitive":"invalid"}});
    payload["snapshot"] = snapshot_payload(&state, &org, app, "set_rollback_sensitive", &payload)
        .await
        .unwrap();
    failing["payload_hash"] = json!(hash(&payload));
    failing["payload"] = payload;
    failing["base_state"] = base_state(&state, &org, app).await.unwrap();
    diesel::sql_query("INSERT INTO hyperotaserver.deployment_requests(id,org_id,app_id,status,data) VALUES($1,$2,$3,'pending',$4)").bind::<SqlUuid,_>(Uuid::parse_str(failing["id"].as_str().unwrap()).unwrap()).bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Jsonb,_>(&failing).execute(&mut c).unwrap();
    let failed: Value =
        test::call_and_read_body_json(&service, decision(failing["id"].as_str().unwrap())).await;
    assert_eq!(failed["code"], "execution_failed", "{failed}");
    assert_eq!(failed["request_status"], "failed");
    assert_eq!(failed["request_id"], failing["id"]);
    assert_eq!(
        find(
            &state,
            &org,
            app,
            Uuid::parse_str(failing["id"].as_str().unwrap()).unwrap()
        )
        .await
        .unwrap()["status"],
        "failed"
    );
    // An unavailable auxiliary table cannot consume an unbounded overview budget.
    let mut blocker = state.db_pool.get().unwrap();
    diesel::sql_query("BEGIN").execute(&mut blocker).unwrap();
    diesel::sql_query("LOCK hyperotaserver.serving_policies IN ACCESS EXCLUSIVE MODE")
        .execute(&mut blocker)
        .unwrap();
    let started = std::time::Instant::now();
    assert!(overview_batch(&state, &[(org.clone(), app.into())])
        .await
        .is_err());
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
    diesel::sql_query("ROLLBACK").execute(&mut blocker).unwrap();
    // Hold the real physical lock, prove exclusion, then cancel the writer future
    // after durable journal persistence. A new session resumes that same journal.
    let op = super::super::operations::Operation {
        id: Uuid::new_v4(),
        state: "planned".into(),
        data: json!({"stage":"before_dispatch"}),
    };
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
    let (s, o, p) = (state.clone(), org.clone(), op.clone());
    let task = actix_web::rt::spawn(async move {
        write_lock::locked_inner(&s, &o, app, false, async {
            super::super::operations::save(&s, &o, app, "rollback", "crash-source", &p).await?;
            ready_tx.send(()).unwrap();
            std::future::pending::<Result<()>>().await
        })
        .await
    });
    ready_rx.await.unwrap();
    assert!(
        write_lock::locked_inner(&state, &org, app, false, async { Ok(()) })
            .await
            .is_err()
    );
    task.abort();
    let _ = task.await;
    write_lock::locked_inner(&state, &org, app, false, async {
        let saved = super::super::operations::load(&state, &org, app, Some("crash-source")).await?;
        assert_eq!(saved[0].id, op.id);
        assert_eq!(saved[0].data["stage"], "before_dispatch");
        let mut resumed = saved[0].clone();
        resumed.advance("completed")?;
        super::super::operations::save(&state, &org, app, "rollback", "crash-source", &resumed)
            .await
    })
    .await
    .unwrap();
    // Kill the writer's database session: lock verification rejects every later
    // store; the durable row remains readable on a fresh connection.
    write_lock::locked_inner(&state, &org, app, false, async {
        #[derive(QueryableByName)]
        struct Pid {
            #[diesel(sql_type=diesel::sql_types::Integer)]
            pid: i32,
        }
        let holder = std::sync::Arc::new(std::sync::Mutex::new(0));
        let copy = holder.clone();
        write_lock::store(move |c| {
            *copy.lock().unwrap() = diesel::sql_query("SELECT pg_backend_pid() AS pid")
                .get_result::<Pid>(c)?
                .pid;
            Ok(())
        })
        .await?;
        let pid = *holder.lock().unwrap();
        diesel::sql_query("SELECT pg_terminate_backend($1)")
            .bind::<diesel::sql_types::Integer, _>(pid)
            .execute(&mut c)?;
        assert!(write_lock::store(|_| Ok(())).await.is_err());
        Ok(())
    })
    .await
    .unwrap_err();
    assert_eq!(
        super::super::operations::load(&state, &org, app, Some("crash-source"))
            .await
            .unwrap()[0]
            .state,
        "completed"
    );
    // SQL authorization scoping must not leak a second tenant's unresolved row.
    diesel::sql_query("INSERT INTO hyperotaserver.release_operations(id,org_id,app_id,kind,source_release_id,state,data) VALUES($1,'other-tenant','secret','write','','unresolved','{}')").bind::<SqlUuid,_>(Uuid::new_v4()).execute(&mut c).unwrap();
    assert!(
        super::super::operations::pending_apps(&state, &[(org.clone(), app.into())])
            .await
            .unwrap()
            .is_empty()
    );
    assert!(super::super::operations::pending_apps(&state, &[])
        .await
        .unwrap()
        .is_empty());
    // Recover a real rollback after upstream accepted discard but the process
    // died before terminal audit/completion. No second discard is dispatched.
    diesel::sql_query(
        "UPDATE hyperotaserver.approval_policies SET data='{\"enabled\":false}' WHERE org_id=$1",
    )
    .bind::<Text, _>(&org)
    .execute(&mut c)
    .unwrap();
    let marker = "resume crash [Airborne operation 00000000-0000-4000-8000-000000000001]";
    let source_json = json!({"id":"resume-release","name":format!("{app}-{org}-release-exp"),"override_keys":[],"created_at":"2026-01-01T00:00:00Z","created_by":"test","last_modified":"2026-01-01T00:00:01Z","last_modified_by":"test","status":"DISCARDED","traffic_percentage":0,"experiment_type":"DEFAULT","description":"","change_reason":marker,"variants":[{"id":"control","variant_type":"CONTROL","overrides":{"package.index":"index@version:1","package.version":1}},{"id":"exp","variant_type":"EXPERIMENTAL","overrides":{}}],"context":{}});
    *upstream_data.lock().unwrap() = json!([source_json]);
    let endpoint = state.env.public_url.clone();
    diesel::sql_query("INSERT INTO hyperotaserver.files(app_id,org_id,version,url,file_path,size,checksum) VALUES($1,$2,1,$3,'index',1,'sha256')").bind::<Text,_>(app).bind::<Text,_>(&org).bind::<Text,_>(endpoint).execute(&mut c).unwrap();
    let exps = control_center::experiments(&state, &org, app)
        .await
        .unwrap()
        .1;
    assert_eq!(exps.len(), 1);
    let snapshot = control_center::snapshot(&exps[0]);
    let resume = super::super::operations::Operation {
        id: Uuid::new_v4(),
        state: "planned".into(),
        data: json!({"source":snapshot,"transition_expected":snapshot,"stage":"discarded","preview":{"action":"discarded","blocked":null,"reconciled_keys":[],"resulting_package_version":1}}),
    };
    write_lock::locked_inner(&state, &org, app, false, async {
        super::super::operations::save(&state, &org, app, "rollback", "resume-release", &resume)
            .await
    })
    .await
    .unwrap();
    for _ in 0..2 {
        let response = write_lock::locked_inner(
            &state,
            &org,
            app,
            false,
            super::super::rollback::run(
                &state,
                &auth("maker@test", &org, app),
                &org,
                app,
                "resume-release",
                "resume crash",
            ),
        )
        .await
        .unwrap();
        assert_eq!(
            response_json(response).await.unwrap()["action"],
            "discarded"
        );
    }
    assert_eq!(
        super::super::operations::load(&state, &org, app, Some("resume-release"))
            .await
            .unwrap()[0]
            .state,
        "completed"
    );
    let terminal=diesel::sql_query("SELECT payload AS data FROM hyperotaserver.release_events WHERE org_id=$1 AND release_id='resume-release' AND action='rolled_back'").bind::<Text,_>(&org).load::<Row>(&mut c).unwrap();
    assert_eq!(terminal.len(), 1);
    // The actual operation-list route exposes no upstream IDs or overrides.
    diesel::sql_query("INSERT INTO hyperotaserver.release_operations(id,org_id,app_id,kind,source_release_id,state,data) VALUES($1,$2,$3,'write','','unresolved',$4)").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Jsonb,_>(json!({"workspace":"private-workspace","expected":{"secret":"variant"},"before":{"secret":"config"}})).execute(&mut c).unwrap();
    let reader: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get().uri("/operations").to_request(),
    )
    .await;
    assert_eq!(reader["operations"].as_array().unwrap().len(), 1);
    let row = reader["operations"][0].as_object().unwrap();
    assert_eq!(row.len(), 3);
    assert!(row.contains_key("operation_id"));
    assert_eq!(row["code"], "unresolved");
    for (sub, role) in [("reader@test", "read"), ("writer@test", "write")] {
        state
            .authz_provider
            .add_organisation_user(&state, "maker@test", &org, sub, role)
            .await
            .unwrap();
        assert!(!state
            .authz_provider
            .enforce_permission(&state, sub, &org, None, "release", "recover")
            .await
            .unwrap());
    }
    // Check an ordinary org admin, rather than a super-admin exemption.
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, "admin@test", "admin")
        .await
        .unwrap();
    assert!(state
        .authz_provider
        .enforce_permission(&state, "admin@test", &org, None, "release", "recover")
        .await
        .unwrap());
    upstream.stop(true).await;
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn third_pass_completed_emergency() {
    let (state, upstream, upstream_data) = fixture().await;
    let org = format!("scratch-{}", Uuid::new_v4());
    let app = "resume-test";
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, "checker@test", "admin")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, app, "maker@test")
        .await
        .unwrap();
    {
        let mut c = state.db_pool.get().unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,$2,$1)").bind::<Text,_>(&org).bind::<Text,_>(app).execute(&mut c).unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,$2,$3)").bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Jsonb,_>(json!({"enabled":true,"emergency_rollback":true,"makers":["maker@test"],"checkers":["checker@test","maker@test"]})).execute(&mut c).unwrap();
    }
    let source = json!({"id":"source","name":format!("{app}-{org}-release-exp"),"override_keys":[],"created_at":"2026-01-01T00:00:00Z","created_by":"test","last_modified":"2026-01-01T00:00:01Z","last_modified_by":"test","status":"CONCLUDED","traffic_percentage":100,"experiment_type":"DEFAULT","description":"","change_reason":"","variants":[{"id":"exp","variant_type":"EXPERIMENTAL","overrides":{}}],"chosen_variant":"exp","context":{}});
    let mut replacement = source.clone();
    replacement["id"] = json!("replacement");
    replacement["last_modified"] = json!("2026-01-01T00:00:02Z");
    *upstream_data.lock().unwrap() = json!([source, replacement]);
    let op = super::super::operations::Operation {
        id: Uuid::new_v4(),
        state: "completed".into(),
        data: json!({"source":{"id":"source"},"replacement_release_id":"replacement","preview":{"reconciled_keys":{},"blocked":null},"result":{"new_release_id":"replacement","rolled_back_to_package_version":1}}),
    };
    super::super::write_lock::locked_inner(
        &state,
        &org,
        app,
        false,
        super::super::operations::save(&state, &org, app, "rollback", "source", &op),
    )
    .await
    .unwrap();
    let check_url = {
        let mut u = url::Url::parse(&state.release_write_db_url).unwrap();
        u.query_pairs_mut().append_pair("connect_timeout", "3");
        u.to_string()
    };
    diesel::PgConnection::establish(&check_url).unwrap();
    let actor = auth("checker@test", &org, app);
    let result = super::super::write_lock::locked_inner(
        &state,
        &org,
        app,
        true,
        emergency(&state, &actor, "source", "repair missing review", true),
    )
    .await
    .unwrap();
    assert!(result.status().is_success());
    let reviews = rows(&state, &org, app, "reviews").await.unwrap();
    assert_eq!(reviews.len(), 1);
    assert_eq!(reviews[0]["new_release_id"], "replacement");
    // Recovery goes through the real scoped admin route and audit transaction.
    use actix_web::{dev::Service, test, HttpMessage};
    let admin = actor.clone();
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                req.extensions_mut().insert(admin.clone());
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    let request = || {
        test::TestRequest::post()
            .uri("/operations/rollback/source/abandon")
            .set_json(json!({"reason":"discarded replacement inspected"}))
            .to_request()
    };
    assert_eq!(test::call_service(&service, request()).await.status(), 409);
    let mut partial = op.clone();
    partial.state = "planned".into();
    super::super::write_lock::locked_inner(
        &state,
        &org,
        app,
        false,
        super::super::operations::save(&state, &org, app, "rollback", "source", &partial),
    )
    .await
    .unwrap();
    upstream_data.lock().unwrap()[1]["status"] = json!("DISCARDED");
    let response = test::call_service(&service, request()).await;
    assert_eq!(
        response.status(),
        200,
        "{:?}",
        test::read_body(response).await
    );
    let remaining = super::super::operations::load(&state, &org, app, Some("source"))
        .await
        .unwrap();
    assert!(remaining.is_empty(),"abandonment must clear the source row so a fresh operation cannot rediscover the discarded replacement by its old operation ID");
    assert_eq!(
        super::super::operations::rollback_parent(&state, &org, app, "replacement")
            .await
            .unwrap(),
        Some("source".into()),
        "archived replacements must retain lineage after their active row is cleared"
    );
    let mut c = state.db_pool.get().unwrap();
    let events=diesel::sql_query("SELECT payload AS data FROM hyperotaserver.release_events WHERE org_id=$1 AND action='rollback_abandoned'").bind::<Text,_>(&org).load::<Row>(&mut c).unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].data["replacement_release_id"], "replacement");
    assert!(
        events[0].data.get("previous").is_none(),
        "reader-visible audit events must not expose private journal snapshots"
    );
    assert_eq!(events[0].data["previous_state"], "planned");

    upstream.stop(true).await;
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn third_pass_pool_exhaustion() {
    use actix_web::ResponseError;
    let (state, upstream, data) = fixture().await;
    let org = format!("scratch-pool-{}", Uuid::new_v4());
    let app = "test-pool";
    let held: Vec<_> = (0..8).map(|_| state.db_pool.get().unwrap()).collect();
    let error = crate::utils::workspace::get_workspace_name_for_application_db(
        state.db_pool.clone(),
        app.into(),
        org.clone(),
    )
    .await
    .unwrap_err();
    assert_eq!(
        error.status_code(),
        actix_web::http::StatusCode::SERVICE_UNAVAILABLE
    );
    let service = actix_web::test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .service(super::super::serve_release),
    )
    .await;
    let response = actix_web::test::call_service(
        &service,
        actix_web::test::TestRequest::get()
            .uri(&format!("/{org}/{app}"))
            .to_request(),
    )
    .await;
    assert_eq!(response.status(), 404);
    let body = actix_web::test::read_body(response).await;
    assert!(
        String::from_utf8_lossy(&body).contains("keep current code"),
        "{:?}",
        body
    );

    drop(held);
    // Cold strict resolve against an injected HTTP 503 also means no update.
    {
        let mut c = state.db_pool.get().unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,$2,$1)").bind::<Text,_>(&org).bind::<Text,_>(app).execute(&mut c).unwrap();
        diesel::sql_query(
            "INSERT INTO hyperotaserver.serving_policies(org_id,app_id,strict) VALUES($1,$2,true)",
        )
        .bind::<Text, _>(&org)
        .bind::<Text, _>(app)
        .execute(&mut c)
        .unwrap();
    }
    *data.lock().unwrap() = json!({"strict_fail":true});
    let response = actix_web::test::call_service(
        &service,
        actix_web::test::TestRequest::get()
            .uri(&format!("/{org}/{app}"))
            .to_request(),
    )
    .await;
    assert_eq!(response.status(), 404);
    let body = actix_web::test::read_body(response).await;
    assert!(
        String::from_utf8_lossy(&body).contains("keep current code"),
        "{:?}",
        body
    );

    upstream.stop(true).await;
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn third_pass_emergency_ramp_and_conclude_retry_by_another_checker() {
    for stage in ["ramp", "conclude"] {
        let (state, upstream, data) = fixture().await;
        let org = format!("scratch-{}", Uuid::new_v4());
        let app = "partial-emergency";
        state
            .authz_provider
            .create_organisation(&state, &org, "maker@test")
            .await
            .unwrap();
        state
            .authz_provider
            .add_organisation_user(&state, "maker@test", &org, "checker@test", "admin")
            .await
            .unwrap();
        state
            .authz_provider
            .create_application(&state, &org, app, "maker@test")
            .await
            .unwrap();
        {
            let mut c = state.db_pool.get().unwrap();
            diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,$2,$1)").bind::<Text,_>(&org).bind::<Text,_>(app).execute(&mut c).unwrap();
            diesel::sql_query("INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,$2,$3)").bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Jsonb,_>(json!({"enabled":true,"emergency_rollback":true,"makers":["maker@test"],"checkers":["checker@test","maker@test"]})).execute(&mut c).unwrap();
        }
        {
            let mut c = state.db_pool.get().unwrap();
            diesel::sql_query("INSERT INTO hyperotaserver.files(id,org_id,app_id,version,url,file_path,size,checksum,metadata,created_at) VALUES($1,$2,$3,1,$4,'index',7,'f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d','{}',now())").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(app).bind::<Text,_>(format!("{}/artifact",state.env.public_url)).execute(&mut c).unwrap();
        }
        let source = json!({"id":"source","name":format!("{app}-{org}-release-exp"),"override_keys":[],"created_at":"1970-01-01T00:00:01Z","created_by":"test","last_modified":"1970-01-01T00:00:01Z","last_modified_by":"test","status":"CONCLUDED","traffic_percentage":50,"experiment_type":"DEFAULT","description":"","change_reason":"","variants":[{"id":"exp","variant_type":"EXPERIMENTAL","overrides":{"package.version":2}}],"chosen_variant":"exp","context":{"platform":"ios"}});
        let mut replacement = source.clone();
        replacement["id"] = json!("replacement");
        replacement["last_modified"] = json!("1970-01-01T00:00:02Z");
        replacement["chosen_variant"] = Value::Null;
        replacement["status"] = json!(if stage == "ramp" {
            "CREATED"
        } else {
            "INPROGRESS"
        });
        replacement["traffic_percentage"] = json!(if stage == "ramp" { 0 } else { 50 });
        let mut observed = super::super::control_center::tests::make("replacement", 2, "ios");
        observed.status = if stage == "ramp" {
            ExperimentStatusType::Created
        } else {
            ExperimentStatusType::Inprogress
        };
        observed.traffic_percentage = if stage == "ramp" { 0 } else { 50 };
        observed.chosen_variant = None;
        observed.variants[0].overrides.insert(
            "package.version".into(),
            aws_smithy_types::Document::Number(aws_smithy_types::Number::PosInt(2)),
        );
        *data.lock().unwrap() =
            json!({"rows":[source,replacement],"fail_stage":stage,"failed":false});
        let op = super::super::operations::Operation {
            id: Uuid::new_v4(),
            state: "planned".into(),
            data: json!({"source":{"id":"source"},"replacement_release_id":"replacement","observed":control_center::snapshot(&observed),"preview":{"action":"rereleased","resulting_package_version":1,"reconciled_keys":{},"overrides":{"EXPERIMENTAL":{"package.index":"index@version:1"}},"blocked":null}}),
        };
        super::super::write_lock::locked_inner(
            &state,
            &org,
            app,
            false,
            super::super::operations::save(&state, &org, app, "rollback", "source", &op),
        )
        .await
        .unwrap();
        let first = auth("checker@test", &org, app);
        let failure = super::super::write_lock::locked_inner(
            &state,
            &org,
            app,
            true,
            emergency(&state, &first, "source", "initial emergency", true),
        )
        .await;
        assert!(failure.is_err(), "{stage} must fail before retry");
        assert_eq!(
            data.lock().unwrap()["failed"],
            true,
            "{stage} did not reach injected fault: {failure:?}"
        );
        let second = auth("maker@test", &org, app);
        let response = super::super::write_lock::locked_inner(
            &state,
            &org,
            app,
            true,
            emergency(&state, &second, "source", "resume emergency", true),
        )
        .await
        .unwrap();
        assert!(response.status().is_success());
        let reviews = rows(&state, &org, app, "reviews").await.unwrap();
        assert_eq!(reviews.len(), 1);
        assert_eq!(reviews[0]["actor"], "maker@test");
        assert_eq!(
            data.lock().unwrap()["rows"].as_array().unwrap().len(),
            2,
            "retry created a duplicate replacement"
        );
        // The audit rows of the rollback say which package version they concern.
        let mut c = state.db_pool.get().unwrap();
        let events=diesel::sql_query("SELECT payload AS data FROM hyperotaserver.release_events WHERE org_id=$1 AND action IN ('ramped','concluded','rolled_back')").bind::<Text,_>(&org).load::<Row>(&mut c).unwrap();
        assert!(events.len() >= 2, "{stage}: {} events", events.len());
        for e in &events {
            assert_eq!(e.data["package_version"], 2, "{stage}: {}", e.data);
        }

        upstream.stop(true).await;
    }
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL; no live services or credentials"]
async fn postgres_org_reader_overview_includes_apps() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, _) = fixture().await;
    let org = format!("scratch-{}", Uuid::new_v4());
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, "test-app", "maker@test")
        .await
        .unwrap();
    for role in ["read", "write"] {
        let subject = format!("{role}@test");
        state
            .authz_provider
            .add_organisation_user(&state, "maker@test", &org, &subject, role)
            .await
            .unwrap();
        let mut actor = auth(&subject, &org, "test-app");
        actor.is_super_admin = false;
        actor.application = None;
        let service = test::init_service(
            actix_web::App::new()
                .app_data(state.clone())
                .wrap_fn(move |req, srv| {
                    req.extensions_mut().insert(actor.clone());
                    srv.call(req)
                })
                .service(crate::control_center::add_routes()),
        )
        .await;
        let overview: Value = test::call_and_read_body_json(
            &service,
            test::TestRequest::get().uri("/overview").to_request(),
        )
        .await;
        assert_eq!(
            overview["organisations"][0]["ungrouped"][0]["application"], "test-app",
            "{overview}"
        );
    }
    upstream.stop(true).await;
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_interrupted_approval_is_recoverable_without_reexecution() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, data) = fixture().await;
    let org = format!("scratch-{}", Uuid::new_v4());
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, "checker@test", "admin")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, "test-app", "maker@test")
        .await
        .unwrap();
    let id = Uuid::new_v4();
    let request = json!({"id":id,"status":"executing","requester":"maker@test","action":"create","payload":{}});
    {
        let mut c = state.db_pool.get().unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,'test-app',$2)").bind::<Text,_>(&org).bind::<Jsonb,_>(json!({"enabled":true,"checkers":["checker@test"]})).execute(&mut c).unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.deployment_requests(id,org_id,app_id,status,data) VALUES($1,$2,'test-app','executing',$3)").bind::<SqlUuid,_>(id).bind::<Text,_>(&org).bind::<Jsonb,_>(request).execute(&mut c).unwrap();
    }
    let o = org.clone();
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                req.extensions_mut()
                    .insert(auth("checker@test", &o, "test-app"));
                srv.call(req)
            })
            .configure(routes),
    )
    .await;
    let recovered: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::post()
            .uri(&format!("/deployment-requests/{id}/approve"))
            .set_json(json!({"reason":"Inspect interrupted execution"}))
            .to_request(),
    )
    .await;
    assert_eq!(recovered["status"], "failed", "{recovered}");
    assert!(recovered["decision_reason"]
        .as_str()
        .unwrap()
        .contains("Interrupted execution reconciled"));
    assert_eq!(
        *data.lock().unwrap(),
        json!([]),
        "recovery must not dispatch another create"
    );
    assert_eq!(
        find(&state, &org, "test-app", id).await.unwrap()["status"],
        "failed"
    );
    upstream.stop(true).await;
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_deployments_feed_contract() {
    use actix_web::{dev::Service, test, HttpMessage};
    use diesel::connection::SimpleConnection;
    let (state, upstream, _) = fixture().await;
    let org = format!("scratch-nav-{}", Uuid::new_v4());
    let other = format!("scratch-other-{}", Uuid::new_v4());
    for o in [&org, &other] {
        state
            .authz_provider
            .create_organisation(&state, o, "maker@test")
            .await
            .unwrap();
        for app in ["web", "ios", "broken"] {
            state
                .authz_provider
                .create_application(&state, o, app, "maker@test")
                .await
                .unwrap();
        }
    }
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, "nav-reader@test", "read")
        .await
        .unwrap();
    let mut actor = auth("nav-reader@test", &org, "");
    actor.is_super_admin = false;
    actor.application = None;
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                req.extensions_mut().insert(actor.clone());
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    let mut c = state.db_pool.get().unwrap();
    let group = Uuid::new_v4();
    diesel::sql_query(
        "INSERT INTO hyperotaserver.app_groups(id,org_id,name) VALUES($1,$2,'Mobile')",
    )
    .bind::<SqlUuid, _>(group)
    .bind::<Text, _>(&org)
    .execute(&mut c)
    .unwrap();
    diesel::sql_query("INSERT INTO hyperotaserver.app_group_members(group_id,org_id,app_id,platform) VALUES($1,$2,'ios','ios')").bind::<SqlUuid,_>(group).bind::<Text,_>(&org).execute(&mut c).unwrap();
    for o in [&org, &other] {
        for (i, action) in [
            "created",
            "ramped",
            "requested",
            "approved",
            "rejected",
            "expired",
            "cache_invalidation_failed",
            "emergency_rollback",
            "policy_changed",
            "cache_retried",
        ]
        .iter()
        .enumerate()
        {
            diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload,created_at) VALUES($1,$2,$3,'r1',$4,'maker@test','{\"package_version\":42,\"traffic_percentage\":50}',now()-($5::int * interval '1 minute'))")
        .bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(o).bind::<Text,_>(if i%2==0{"ios"}else{"web"}).bind::<Text,_>(*action).bind::<diesel::sql_types::Integer,_>(i as i32).execute(&mut c).unwrap();
        }
    }
    let first: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri("/deployments?limit=3")
            .to_request(),
    )
    .await;
    assert_eq!(first["partial"], false, "{first}");
    assert_eq!(first["items"].as_array().unwrap().len(), 3);
    assert!(first["items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|e| e["org"] == org && e["actor"] == "maker@test"));
    let cursor = first["next_cursor"].as_str().unwrap();
    diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,'ios','new','created','maker@test','{}')").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).execute(&mut c).unwrap();
    let mut ids = first["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["event_id"].clone())
        .collect::<Vec<_>>();
    let mut next = Some(cursor.to_owned());
    while let Some(cursor) = next {
        let page: Value = test::call_and_read_body_json(
            &service,
            test::TestRequest::get()
                .uri(&format!("/deployments?limit=3&cursor={cursor}"))
                .to_request(),
        )
        .await;
        assert_eq!(page["partial"], false, "{page}");
        assert!(page["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|e| e["release_id"] != "new"));
        ids.extend(
            page["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|e| e["event_id"].clone()),
        );
        next = page["next_cursor"].as_str().map(str::to_owned);
    }
    let unique = ids
        .iter()
        .map(Value::to_string)
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(ids.len(), 10);
    assert_eq!(unique.len(), 10);
    for query in [
        format!("org={other}"),
        format!("org={org}&group={}", Uuid::new_v4()),
        "app=missing".into(),
    ] {
        let page: Value = test::call_and_read_body_json(
            &service,
            test::TestRequest::get()
                .uri(&format!("/deployments?{query}"))
                .to_request(),
        )
        .await;
        assert_eq!(page["items"], json!([]), "{page}");
    }
    let filtered:Value=test::call_and_read_body_json(&service,test::TestRequest::get().uri(&format!("/deployments?org={org}&group={group}&app=ios&platform=ios&actor=maker%40test&action=created&action=cache_failed&since=2020-01-01T00%3A00%3A00Z")).to_request()).await;
    assert_eq!(filtered["items"].as_array().unwrap().len(), 3, "{filtered}");
    assert!(filtered["items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|e| e["group"] == group.to_string() && e["app"] == "ios"));
    let overview: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri(&format!("/overview?org={org}&group={group}&app=ios"))
            .to_request(),
    )
    .await;
    assert_eq!(overview["organisations"].as_array().unwrap().len(), 1);
    assert_eq!(
        overview["organisations"][0]["groups"][0]["members"]
            .as_array()
            .unwrap()
            .len(),
        1,
        "{overview}"
    );
    assert_eq!(overview["organisations"][0]["ungrouped"], json!([]));
    for query in [
        "limit=201",
        "since=no",
        "group=no",
        "action=no",
        "platform=no",
        "cursor=no",
    ] {
        let response = test::call_service(
            &service,
            test::TestRequest::get()
                .uri(&format!("/deployments?{query}"))
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), 400, "{query}");
    }
    // Inject a genuine Postgres failure for one app; other authorized apps survive.
    diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,'broken','r','created','maker@test','{}')").bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).execute(&mut c).unwrap();
    c.batch_execute("ALTER TABLE hyperotaserver.release_events RENAME TO nav_test_events; CREATE FUNCTION hyperotaserver.nav_fail() RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected app failure'; END $$; CREATE VIEW hyperotaserver.release_events AS SELECT id,org_id,app_id,release_id,action,CASE WHEN app_id='broken' THEN hyperotaserver.nav_fail() ELSE actor END AS actor,payload,created_at FROM hyperotaserver.nav_test_events").unwrap();
    let partial: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get().uri("/deployments").to_request(),
    )
    .await;
    c.batch_execute("DROP VIEW hyperotaserver.release_events; DROP FUNCTION hyperotaserver.nav_fail(); ALTER TABLE hyperotaserver.nav_test_events RENAME TO release_events").unwrap();
    assert_eq!(partial["partial"], true, "{partial}");
    assert!(!partial["items"].as_array().unwrap().is_empty());
    assert_eq!(partial["errors"][0]["app"], "broken", "{partial}");
    upstream.stop(true).await;
}

// The audit row is written in the journal's `confirmed` transaction. If that transaction
// cannot commit (here: the event insert is made to fail), the journal entry must stay
// unresolved, and the next writer must confirm it AND record the event, exactly once.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_release_audit_commits_with_the_journal() {
    use super::operations::Audit;
    let (state, upstream, data) = fixture().await;
    let org = format!("scratch-audit-{}", Uuid::new_v4());
    let app = "audit-app";
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, app, "maker@test")
        .await
        .unwrap();
    let mut c = state.db_pool.get().unwrap();
    diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,$2,$1)").bind::<Text,_>(&org).bind::<Text,_>(app).execute(&mut c).unwrap();
    let source = json!({"id":"source","name":format!("{app}-{org}-release-exp"),"override_keys":[],"created_at":"1970-01-01T00:00:01Z","created_by":"test","last_modified":"1970-01-01T00:00:01Z","last_modified_by":"test","status":"CONCLUDED","traffic_percentage":50,"experiment_type":"DEFAULT","description":"","change_reason":"","variants":[{"id":"exp","variant_type":"EXPERIMENTAL","overrides":{}}],"chosen_variant":"exp","context":{"platform":"ios"}});
    let mut release = source.clone();
    release["id"] = json!("release-1");
    release["last_modified"] = json!("1970-01-01T00:00:02Z");
    release["chosen_variant"] = Value::Null;
    release["status"] = json!("CREATED");
    release["traffic_percentage"] = json!(0);
    *data.lock().unwrap() = json!({"rows":[source,release]});
    let actor = auth("maker@test", &org, app);
    let ramp =
        |attempt: i32| {
            let percent = 50; // the fake upstream always applies 50
            let (state, actor, org) = (state.clone(), actor.clone(), org.clone());
            async move {
                write_lock::locked_inner(&state, &org, app, false, async {
                    let call = state
                        .release_superposition_client
                        .ramp_experiment()
                        .org_id("scratch")
                        .workspace_id(&org)
                        .id("release-1")
                        .traffic_percentage(percent)
                        .change_reason(write_lock::user_reason("audit test")?)
                        .send();
                    let audit = Audit::new(
                        &actor,
                        "ramped",
                        json!({"traffic_percentage":percent,"attempt":attempt}),
                    );
                    Box::pin(write_lock::mutate_ramp(
                    json!({"id":"release-1","status":"INPROGRESS","traffic_percentage":percent}),
                    Some(audit), call)).await.map(|_| ())
                })
                .await
            }
        };
    let events = |c: &mut PgConnection| {
        diesel::sql_query("SELECT payload AS data FROM hyperotaserver.release_events WHERE org_id=$1 AND app_id=$2 AND action='ramped' AND release_id='release-1'")
        .bind::<Text,_>(&org).bind::<Text,_>(app).load::<Row>(c).unwrap()
    };
    let states = |c: &mut PgConnection| {
        #[derive(QueryableByName)]
        struct S {
            #[diesel(sql_type = Text)]
            state: String,
        }
        diesel::sql_query("SELECT state FROM hyperotaserver.release_operations WHERE org_id=$1 AND app_id=$2 AND kind='write' ORDER BY created_at")
            .bind::<Text,_>(&org).bind::<Text,_>(app).load::<S>(c).unwrap().into_iter().map(|s| s.state).collect::<Vec<_>>()
    };

    // 1. Normal path: one event, written with the journal's confirmation.
    ramp(1).await.unwrap();
    let rows = events(&mut c);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].data["attempt"], 1);
    assert!(rows[0].data["journal_operation_id"].as_str().is_some());
    assert_eq!(states(&mut c), ["confirmed"]);

    // 2. The event insert fails: the confirmation must not commit either.
    // The upstream still shows the release as not ramped (the fake applies the next call).
    *data.lock().unwrap() = json!({"rows":[source, release]});
    diesel::sql_query("CREATE OR REPLACE FUNCTION public.deny_audit_scratch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$").execute(&mut c).unwrap();
    diesel::sql_query(format!("CREATE TRIGGER deny_audit_scratch BEFORE INSERT ON hyperotaserver.release_events FOR EACH ROW WHEN (NEW.org_id = '{org}' AND NEW.action = 'ramped') EXECUTE FUNCTION public.deny_audit_scratch()")).execute(&mut c).unwrap();
    let failed = ramp(2).await;
    assert!(
        failed.is_err(),
        "the journal must not confirm without its audit row"
    );
    assert_eq!(events(&mut c).len(), 1, "no event, no confirmation");
    assert_eq!(states(&mut c), ["confirmed", "unresolved"]);
    diesel::sql_query("DROP TRIGGER deny_audit_scratch ON hyperotaserver.release_events")
        .execute(&mut c)
        .unwrap();
    diesel::sql_query("DROP FUNCTION public.deny_audit_scratch()")
        .execute(&mut c)
        .unwrap();

    // 3. Upstream did apply the change: the next writer's reconcile confirms the entry and
    //    records the original actor's event with it, once, even when reconciled twice.
    for _ in 0..2 {
        write_lock::locked_inner(&state, &org, app, true, async { Ok(()) })
            .await
            .unwrap();
    }
    let rows = events(&mut c);
    assert_eq!(rows.len(), 2);
    let recovered = rows
        .iter()
        .find(|r| r.data["attempt"] == 2)
        .expect("reconciled event");
    assert_eq!(recovered.data["reconciled_after_ambiguous_result"], true);
    assert_eq!(states(&mut c), ["confirmed", "confirmed"]);
    #[derive(QueryableByName)]
    struct A {
        #[diesel(sql_type = Text)]
        actor: String,
    }
    let actors = diesel::sql_query(
        "SELECT actor FROM hyperotaserver.release_events WHERE org_id=$1 AND action='ramped'",
    )
    .bind::<Text, _>(&org)
    .load::<A>(&mut c)
    .unwrap();
    assert!(actors.iter().all(|a| a.actor == "maker@test"));
    upstream.stop(true).await;
}

// Request/operation outcomes and operator-recovered writes appear in the feed, so a failed
// approval never reads as "Approved" and a recovered release is not missing.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_deployments_feed_outcomes_and_recovered_writes() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, _) = fixture().await;
    let org = format!("scratch-outcome-{}", Uuid::new_v4());
    let reader = format!("outcome-{}@test", Uuid::new_v4());
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, "web", "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, &reader, "read")
        .await
        .unwrap();
    let mut actor = auth(&reader, &org, "");
    actor.is_super_admin = false;
    actor.application = None;
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                req.extensions_mut().insert(actor.clone());
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    let mut c = state.db_pool.get().unwrap();
    let insert = |c: &mut PgConnection, release: &str, action: &str, payload: Value, age: i32| {
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload,created_at) VALUES($1,$2,'web',$3,$4,'checker@test',$5,now()-($6::int * interval '1 minute'))")
            .bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(release).bind::<Text,_>(action).bind::<Jsonb,_>(payload).bind::<diesel::sql_types::Integer,_>(age).execute(c).unwrap();
    };
    let request = |status: &str, why: &str| json!({"action":"conclude","status":status,"decision_reason":why,"payload":{"release_id":"r9"}});
    insert(&mut c, "r9", "approved", request("executing", ""), 8);
    insert(
        &mut c,
        "r9",
        "failed",
        request("failed", "upstream refused"),
        7,
    );
    insert(&mut c, "r9", "executed", request("executed", ""), 6);
    insert(&mut c, "r8", "stale", request("stale", ""), 5);
    insert(
        &mut c,
        "r7",
        "cancelled",
        request("cancelled", "changed my mind"),
        4,
    );
    insert(
        &mut c,
        "r6",
        "rollback_abandoned",
        json!({"reason":"inspected"}),
        3,
    );
    insert(
        &mut c,
        "r6",
        "emergency_acknowledged",
        json!({"reason":"reviewed"}),
        2,
    );
    // Never feed actions: still excluded.
    insert(&mut c, "", "compatibility_exception", json!({}), 1);
    insert(&mut c, "r1", "cache_invalidated", json!({}), 1);
    // Operator recovery: new-style row carries resolved_action; an older row is mapped
    // through its journal entry; did_not_apply and unmappable operations stay out.
    let journal = |c: &mut PgConnection, expected: Value| {
        let id = Uuid::new_v4();
        diesel::sql_query("INSERT INTO hyperotaserver.release_operations(id,org_id,app_id,kind,source_release_id,state,data) VALUES($1,$2,'web','write','','confirmed',$3)")
            .bind::<SqlUuid,_>(id).bind::<Text,_>(&org).bind::<Jsonb,_>(json!({"expected":expected})).execute(c).unwrap();
        id
    };
    let ramp = journal(
        &mut c,
        json!({"id":"r5","status":"INPROGRESS","traffic_percentage":50}),
    );
    let create = journal(&mut c, json!({"status":"CREATED","description":"x"}));
    let update = journal(&mut c, json!({"id":"r4","variants":{}}));
    let skipped = journal(&mut c, json!({"id":"r3","status":"CONCLUDED"}));
    insert(
        &mut c,
        "r5",
        "operation_resolved",
        json!({"operation_id":ramp,"finding":"applied","reason":"verified upstream"}),
        20,
    );
    insert(
        &mut c,
        "r5b",
        "operation_resolved",
        json!({"operation_id":Uuid::new_v4(),"finding":"applied","resolved_action":"concluded","reason":"new style"}),
        19,
    );
    insert(
        &mut c,
        "",
        "operation_resolved",
        json!({"operation_id":create,"finding":"applied","reason":"created while unreachable"}),
        18,
    );
    insert(
        &mut c,
        "r4",
        "operation_resolved",
        json!({"operation_id":update,"finding":"applied","reason":"draft edit"}),
        17,
    );
    insert(
        &mut c,
        "r3",
        "operation_resolved",
        json!({"operation_id":skipped,"finding":"did_not_apply","reason":"nothing happened"}),
        16,
    );

    let get = |query: String| {
        test::call_and_read_body_json::<_, _, Value>(
            &service,
            test::TestRequest::get()
                .uri(&format!("/deployments?org={org}&limit=200{query}"))
                .to_request(),
        )
    };
    let all = get(String::new()).await;
    assert_eq!(all["partial"], false, "{all}");
    // A healthy page still says what the feed cannot promise.
    assert_eq!(all["audit_completeness"]["complete"], false);
    assert_eq!(
        all["audit_completeness"]["best_effort_actions"],
        json!(["cache_failed"])
    );
    assert!(all["audit_completeness"]["transactional_actions"]
        .as_array()
        .unwrap()
        .contains(&json!("ramped")));
    assert!(!all["audit_completeness"]["notes"]
        .as_array()
        .unwrap()
        .is_empty());
    let by_action = |v: &Value, a: &str| {
        v["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["action"] == a)
            .cloned()
            .collect::<Vec<_>>()
    };
    let names = all["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["action"].as_str().unwrap().to_owned())
        .collect::<Vec<_>>();
    for gone in [
        "compatibility_exception",
        "cache_invalidated",
        "operation_resolved",
    ] {
        assert!(
            !names.iter().any(|n| n == gone),
            "{gone} must not be a feed action: {names:?}"
        );
    }
    let failed = by_action(&all, "failed");
    assert_eq!(failed.len(), 1);
    assert_eq!(
        failed[0]["summary"],
        "conclude request failed: upstream refused"
    );
    assert_eq!(failed[0]["recovered"], false);
    assert_eq!(by_action(&all, "executed").len(), 1);
    assert_eq!(by_action(&all, "stale").len(), 1);
    assert_eq!(
        by_action(&all, "cancelled")[0]["summary"],
        "conclude request cancelled: changed my mind"
    );
    assert_eq!(
        by_action(&all, "rollback_abandoned")[0]["summary"],
        "inspected"
    );
    assert_eq!(by_action(&all, "emergency_acknowledged").len(), 1);
    // The approval is still there, but is no longer the last word on its request.
    assert_eq!(by_action(&all, "approved").len(), 1);

    let ramped = by_action(&all, "ramped");
    assert_eq!(ramped.len(), 1, "{all}");
    assert_eq!(ramped[0]["recovered"], true);
    assert_eq!(ramped[0]["release_id"], "r5");
    assert!(ramped[0]["summary"]
        .as_str()
        .unwrap()
        .starts_with("Confirmed by an operator"));
    assert_eq!(by_action(&all, "concluded").len(), 1);
    assert_eq!(by_action(&all, "concluded")[0]["release_id"], "r5b");
    assert_eq!(
        by_action(&all, "created").len(),
        1,
        "an operator-confirmed create is a created event"
    );
    assert_eq!(by_action(&all, "created")[0]["release_id"], Value::Null);
    assert!(
        !all["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["release_id"] == "r4" || e["release_id"] == "r3"),
        "draft edits and did_not_apply findings are not deployments"
    );
    // The new actions are valid filters.
    let only = get("&action=failed&action=stale".into()).await;
    assert_eq!(only["items"].as_array().unwrap().len(), 2, "{only}");
    let recovered_only = get("&action=ramped".into()).await;
    assert_eq!(recovered_only["items"].as_array().unwrap().len(), 1);
    upstream.stop(true).await;
}

// The first page's snapshot comes from the database clock, not this process's clock.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_feed_snapshot_is_the_database_clock() {
    use actix_web::{dev::Service, test, HttpMessage};
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    let (state, upstream, _) = fixture().await;
    let org = format!("scratch-snap-{}", Uuid::new_v4());
    let reader = format!("snap-{}@test", Uuid::new_v4());
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, "web", "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, &reader, "read")
        .await
        .unwrap();
    let mut actor = auth(&reader, &org, "");
    actor.is_super_admin = false;
    actor.application = None;
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                req.extensions_mut().insert(actor.clone());
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    let mut c = state.db_pool.get().unwrap();
    for i in 0..3 {
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload,created_at) VALUES($1,$2,'web','r','created','maker@test','{}',now()-($3::int * interval '1 minute'))")
            .bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<diesel::sql_types::Integer,_>(i).execute(&mut c).unwrap();
    }
    let before = crate::utils::db::db_now(state.db_pool.clone())
        .await
        .unwrap();
    let page: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri(&format!("/deployments?org={org}&limit=1"))
            .to_request(),
    )
    .await;
    let after = crate::utils::db::db_now(state.db_pool.clone())
        .await
        .unwrap();
    let cursor: Value = serde_json::from_slice(
        &URL_SAFE_NO_PAD
            .decode(page["next_cursor"].as_str().unwrap())
            .unwrap(),
    )
    .unwrap();
    let snapshot: DateTime<Utc> = serde_json::from_value(cursor["snapshot"].clone()).unwrap();
    assert!(
        before <= snapshot && snapshot <= after,
        "{before} <= {snapshot} <= {after}"
    );
    upstream.stop(true).await;
}

// Deleting an organisation keeps its audit rows; a recreated organisation of the same
// name must not read them.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_recreated_organisation_does_not_see_the_previous_tenants_audit() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, _) = fixture().await;
    let org = format!("recreate-{}", &Uuid::new_v4().simple().to_string()[..12]);
    let owner = format!("owner-{}@test", Uuid::new_v4());
    let mut actor = auth(&owner, &org, "web");
    actor.is_super_admin = false;
    actor.application = None;
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                req.extensions_mut().insert(actor.clone());
                srv.call(req)
            })
            .service(
                actix_web::web::scope("/organisations").service(crate::organisation::add_routes()),
            )
            .service(crate::control_center::add_routes()),
    )
    .await;
    let create = || {
        test::TestRequest::post()
            .uri("/organisations/create")
            .set_json(json!({"name":org}))
            .to_request()
    };
    let mut c = state.db_pool.get().unwrap();
    let event = |c: &mut PgConnection, release: &str| {
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,'web',$3,'created','old-tenant@test','{\"reason\":\"secret of the previous tenant\"}')")
        .bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(release).execute(c).unwrap()
    };
    let feed = || async {
        test::call_and_read_body_json::<_, _, Value>(
            &service,
            test::TestRequest::get()
                .uri(&format!("/deployments?org={org}"))
                .to_request(),
        )
        .await
    };

    // First tenant: creates the org and an app, and has history.
    assert!(test::call_service(&service, create())
        .await
        .status()
        .is_success());
    state
        .authz_provider
        .create_application(&state, &org, "web", &owner)
        .await
        .unwrap();
    event(&mut c, "old-release");
    assert_eq!(feed().await["items"].as_array().unwrap().len(), 1);

    // Delete it. The audit rows stay in the table.
    let deleted = test::call_service(
        &service,
        test::TestRequest::delete()
            .uri(&format!("/organisations/{org}"))
            .to_request(),
    )
    .await;
    assert!(
        deleted.status().is_success(),
        "{:?}",
        test::read_body(deleted).await
    );
    #[derive(QueryableByName)]
    struct N {
        #[diesel(sql_type = diesel::sql_types::BigInt)]
        n: i64,
    }
    let kept = diesel::sql_query(
        "SELECT count(*) AS n FROM hyperotaserver.release_events WHERE org_id=$1",
    )
    .bind::<Text, _>(&org)
    .get_result::<N>(&mut c)
    .unwrap();
    assert_eq!(kept.n, 1, "history is retained, not deleted");

    // A new tenant takes the same name and app name: it sees nothing of the old one.
    assert!(test::call_service(&service, create())
        .await
        .status()
        .is_success());
    state
        .authz_provider
        .create_application(&state, &org, "web", &owner)
        .await
        .unwrap();
    let empty = feed().await;
    assert_eq!(empty["items"], json!([]), "{empty}");
    assert!(!empty.to_string().contains("secret of the previous tenant"));
    // Its own events do show.
    event(&mut c, "new-release");
    let fresh = feed().await;
    let releases = fresh["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["release_id"].clone())
        .collect::<Vec<_>>();
    assert_eq!(releases, [json!("new-release")], "{fresh}");
    upstream.stop(true).await;
}

// Feed reads wait on a permit, not on a pool connection, and the permits leave at least one
// connection for every other handler. Deterministic: with every permit taken, a feed request
// queues without holding a single connection, and finishes complete once permits return.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_feed_reads_never_take_the_whole_pool() {
    use actix_web::{dev::Service, test, HttpMessage};
    use std::sync::atomic::{AtomicBool, Ordering};
    // The shipped default pool size.
    let (state, upstream, _) = fixture_with_pool(4).await;
    assert_eq!(
        state.feed_read_permits.available_permits(),
        3,
        "one of four connections stays free of the feed"
    );
    let org = format!("scratch-pool-{}", Uuid::new_v4());
    let reader = format!("pool-{}@test", Uuid::new_v4());
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, &reader, "read")
        .await
        .unwrap();
    let mut c = state.db_pool.get().unwrap();
    for i in 0..6 {
        let app = format!("app{i}");
        state
            .authz_provider
            .create_application(&state, &org, &app, "maker@test")
            .await
            .unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,'r','created','maker@test','{}')")
            .bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(&app).execute(&mut c).unwrap();
    }
    drop(c);
    let mut actor = auth(&reader, &org, "");
    actor.is_super_admin = false;
    actor.application = None;
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                req.extensions_mut().insert(actor.clone());
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    // Three reads "in flight": every permit is taken.
    let held = state
        .feed_read_permits
        .clone()
        .acquire_many_owned(3)
        .await
        .unwrap();
    let done = AtomicBool::new(false);
    let request = async {
        let page: Value = test::call_and_read_body_json(
            &service,
            test::TestRequest::get()
                .uri(&format!("/deployments?org={org}"))
                .to_request(),
        )
        .await;
        done.store(true, Ordering::SeqCst);
        page
    };
    let observer = async {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        assert!(!done.load(Ordering::SeqCst), "reads must wait for a permit");
        // The queued request holds no connection: the whole pool is still available.
        let all = (0..4)
            .map(|_| {
                state
                    .db_pool
                    .get_timeout(std::time::Duration::from_millis(100))
            })
            .collect::<Vec<_>>();
        assert!(
            all.iter().all(|r| r.is_ok()),
            "a queued feed request must not hold pool connections"
        );
        drop(all);
        drop(held);
    };
    let (page, _) = tokio::join!(request, observer);
    assert_eq!(page["partial"], false, "{page}");
    assert_eq!(page["items"].as_array().unwrap().len(), 6, "{page}");
    assert_eq!(
        state.feed_read_permits.available_permits(),
        3,
        "permits are returned"
    );
    upstream.stop(true).await;
}

// Who can read what: the feed authorizes every application on its own. Org-level readers see
// every application, application-level readers only theirs (a group is only a filter, never a
// grant), and a member without release access, a non-member and a removed member see nothing.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_deployments_feed_reader_scopes() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, _) = fixture().await;
    let org = format!("scratch-scope-{}", Uuid::new_v4());
    let tag = Uuid::new_v4().simple().to_string();
    let who = |name: &str| format!("{name}-{tag}@test");
    let (org_reader, app_reader, group_reader, no_release, stranger, removed) = (
        who("org-reader"),
        who("app-reader"),
        who("group-reader"),
        who("no-release"),
        who("stranger"),
        who("removed"),
    );
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    for app in ["a1", "a2", "b1", "c1"] {
        state
            .authz_provider
            .create_application(&state, &org, app, "maker@test")
            .await
            .unwrap();
    }
    // A member role that grants nothing on releases.
    state
        .authz_provider
        .upsert_custom_role(
            &state,
            "maker@test",
            &org,
            None,
            "files_only",
            &["file.read".to_string()],
        )
        .await
        .unwrap();
    for (sub, role) in [
        (&org_reader, "read"),
        (&app_reader, "files_only"),
        (&group_reader, "files_only"),
        (&no_release, "files_only"),
        (&removed, "read"),
    ] {
        state
            .authz_provider
            .add_organisation_user(&state, "maker@test", &org, sub, role)
            .await
            .unwrap();
    }
    for app in ["a1"] {
        state
            .authz_provider
            .add_application_user(&state, "maker@test", &org, app, &app_reader, "read")
            .await
            .unwrap();
    }
    // The app reader is also listed on b1 with a role that grants nothing on releases: the
    // access summary names the application, but its release permission must still be checked.
    state
        .authz_provider
        .upsert_custom_role(
            &state,
            "maker@test",
            &org,
            Some("b1"),
            "files_only",
            &["file.read".to_string()],
        )
        .await
        .unwrap();
    state
        .authz_provider
        .add_application_user(&state, "maker@test", &org, "b1", &app_reader, "files_only")
        .await
        .unwrap();
    let summary = state
        .authz_provider
        .get_user_access_summary(&state, &app_reader)
        .await
        .unwrap();
    assert!(
        summary.organisations[0]
            .applications
            .iter()
            .any(|a| a.application == "b1"),
        "b1 is listed in the summary"
    );
    for app in ["a1", "a2"] {
        state
            .authz_provider
            .add_application_user(&state, "maker@test", &org, app, &group_reader, "read")
            .await
            .unwrap();
    }
    let mut c = state.db_pool.get().unwrap();
    let (g, h) = (Uuid::new_v4(), Uuid::new_v4());
    for (id, name) in [(g, "Group G"), (h, "Group H")] {
        diesel::sql_query("INSERT INTO hyperotaserver.app_groups(id,org_id,name) VALUES($1,$2,$3)")
            .bind::<SqlUuid, _>(id)
            .bind::<Text, _>(&org)
            .bind::<Text, _>(name)
            .execute(&mut c)
            .unwrap();
    }
    for (group, app) in [(g, "a1"), (g, "a2"), (h, "b1")] {
        diesel::sql_query("INSERT INTO hyperotaserver.app_group_members(group_id,org_id,app_id,platform) VALUES($1,$2,$3,'web')").bind::<SqlUuid,_>(group).bind::<Text,_>(&org).bind::<Text,_>(app).execute(&mut c).unwrap();
    }
    for app in ["a1", "a2", "b1", "c1"] {
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,$3,$3,'created','maker@test','{}')")
            .bind::<SqlUuid,_>(Uuid::new_v4()).bind::<Text,_>(&org).bind::<Text,_>(app).execute(&mut c).unwrap();
    }
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(|req, srv| {
                let sub = req
                    .headers()
                    .get("x-test-actor")
                    .and_then(|s| s.to_str().ok())
                    .unwrap_or("")
                    .to_owned();
                let mut actor = auth(&sub, "", "");
                actor.is_super_admin = false;
                actor.organisation = None;
                actor.application = None;
                req.extensions_mut().insert(actor);
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    let apps = |sub: &str, query: String| {
        let (sub, uri) = (
            sub.to_owned(),
            format!("/deployments?org={org}&limit=200{query}"),
        );
        let service = &service;
        async move {
            let page: Value = test::call_and_read_body_json(
                service,
                test::TestRequest::get()
                    .uri(&uri)
                    .insert_header(("x-test-actor", sub))
                    .to_request(),
            )
            .await;
            assert_eq!(page["partial"], false, "{page}");
            let mut apps = page["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|e| e["app"].as_str().unwrap().to_owned())
                .collect::<Vec<_>>();
            apps.sort();
            apps
        }
    };
    let all = ["a1", "a2", "b1", "c1"];
    // Organisation-level reader: every application, and every scope narrows it.
    assert_eq!(apps(&org_reader, String::new()).await, all);
    assert_eq!(apps(&org_reader, format!("&group={g}")).await, ["a1", "a2"]);
    assert_eq!(apps(&org_reader, "&app=c1".into()).await, ["c1"]);

    // Application-level reader: only the application they were granted.
    assert_eq!(apps(&app_reader, String::new()).await, ["a1"]);
    assert_eq!(apps(&app_reader, "&app=a1".into()).await, ["a1"]);
    assert!(
        apps(&app_reader, "&app=a2".into()).await.is_empty(),
        "another app of the same group"
    );
    assert!(apps(&app_reader, "&app=c1".into()).await.is_empty());
    // Their group contains an app they cannot read: the group scope does not widen access.
    assert_eq!(apps(&app_reader, format!("&group={g}")).await, ["a1"]);
    assert!(apps(&app_reader, format!("&group={h}")).await.is_empty());

    // Group-level reader (every application of group G, nothing else).
    assert_eq!(apps(&group_reader, String::new()).await, ["a1", "a2"]);
    assert_eq!(
        apps(&group_reader, format!("&group={g}")).await,
        ["a1", "a2"]
    );
    assert!(apps(&group_reader, format!("&group={h}")).await.is_empty());
    assert!(apps(&group_reader, "&app=b1".into()).await.is_empty());

    // Denied: a member whose role grants nothing on releases, and someone outside the org.
    for sub in [&no_release, &stranger] {
        assert!(apps(sub, String::new()).await.is_empty(), "{sub}");
        assert!(apps(sub, format!("&group={g}")).await.is_empty(), "{sub}");
        assert!(apps(sub, "&app=a1".into()).await.is_empty(), "{sub}");
    }
    // Removing a membership removes access on the next request.
    assert_eq!(apps(&removed, String::new()).await, all);
    state
        .authz_provider
        .remove_organisation_user(&state, "maker@test", &org, &removed)
        .await
        .unwrap();
    assert!(apps(&removed, String::new()).await.is_empty());

    // A cursor is bound to its filters: changing the scope, or the reader's filters, is refused.
    let first: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri(&format!("/deployments?org={org}&limit=1"))
            .insert_header(("x-test-actor", org_reader.clone()))
            .to_request(),
    )
    .await;
    let cursor = first["next_cursor"].as_str().unwrap().to_owned();
    for changed in [
        format!("org={org}&app=a1"),
        format!("org={org}&action=created"),
        format!("org={org}&platform=web"),
    ] {
        let response = test::call_service(
            &service,
            test::TestRequest::get()
                .uri(&format!("/deployments?{changed}&limit=1&cursor={cursor}"))
                .insert_header(("x-test-actor", org_reader.clone()))
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), 400, "{changed}");
    }
    upstream.stop(true).await;
}

// Deleting an organisation must not leave its release-control state to a new organisation
// of the same name: policy (makers/checkers), requests, groups, protections, operations.
#[derive(QueryableByName)]
struct Total {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    n: i64,
}
fn rows_for(c: &mut PgConnection, table: &str, org: &str) -> i64 {
    diesel::sql_query(format!(
        "SELECT count(*) AS n FROM hyperotaserver.{table} WHERE org_id=$1"
    ))
    .bind::<Text, _>(org)
    .get_result::<Total>(c)
    .unwrap()
    .n
}
// The same people (super admins in this fixture) are re-added to the new organisation:
// the worst case for inheritance, since membership and permission checks then pass.
macro_rules! scratch_org_service {
    ($state:expr, $org:expr) => {{
        use actix_web::{dev::Service, HttpMessage};
        let o: String = $org.to_owned();
        actix_web::test::init_service(
            actix_web::App::new()
                .app_data($state.clone())
                .wrap_fn(move |req, srv| {
                    let sub = req
                        .headers()
                        .get("x-test-actor")
                        .and_then(|s| s.to_str().ok())
                        .unwrap_or("checker@test");
                    req.extensions_mut().insert(auth(sub, &o, "test-app"));
                    srv.call(req)
                })
                .service(
                    actix_web::web::scope("/organisations")
                        .service(crate::organisation::add_routes()),
                )
                .service(crate::control_center::add_routes()),
        )
        .await
    }};
}
async fn open_org_with_policy(state: &web::Data<AppState>, org: &str, first: bool) {
    state
        .authz_provider
        .add_organisation_user(state, "maker@test", org, "checker@test", "admin")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(state, org, "test-app", "maker@test")
        .await
        .unwrap();
    let mut c = state.db_pool.get().unwrap();
    if first {
        diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,'test-app',$1)").bind::<Text, _>(org).execute(&mut c).unwrap();
    }
    diesel::sql_query(
        "INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,'test-app',$2)",
    )
    .bind::<Text, _>(org)
    .bind::<Jsonb, _>(
        json!({"enabled":true,"makers":["maker@test"],"checkers":["checker@test","maker@test"]}),
    )
    .execute(&mut c)
    .unwrap();
}
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_recreated_organisation_inherits_no_release_control_state() {
    use actix_web::test;
    let (state, upstream, _) = fixture().await;
    let org = format!(
        "scratch-reuse-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    let service = scratch_org_service!(state, org);
    let create = || {
        test::TestRequest::post()
            .uri("/organisations/create")
            .insert_header(("x-test-actor", "maker@test"))
            .set_json(json!({"name":org}))
            .to_request()
    };

    // First tenant: policy, a pending request, a group, a protection and an operation.
    assert!(test::call_service(&service, create())
        .await
        .status()
        .is_success());
    open_org_with_policy(&state, &org, true).await;
    let raised: Value = test::call_and_read_body_json(&service, test::TestRequest::post().uri("/deployment-requests").insert_header(("x-test-actor", "maker@test"))
        .set_json(json!({"action":"set_strict_serving","payload":{"body":{"strict":true}},"reason":"old tenant"})).to_request()).await;
    let old_id = raised["id"].as_str().expect("raised").to_owned();
    let group = Uuid::new_v4();
    {
        let mut c = state.db_pool.get().unwrap();
        diesel::sql_query(
            "INSERT INTO hyperotaserver.app_groups(id,org_id,name) VALUES($1,$2,'old group')",
        )
        .bind::<SqlUuid, _>(group)
        .bind::<Text, _>(&org)
        .execute(&mut c)
        .unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.app_group_members(group_id,org_id,app_id,platform) VALUES($1,$2,'test-app','android')").bind::<SqlUuid, _>(group).bind::<Text, _>(&org).execute(&mut c).unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.release_protections(org_id,app_id,release_id,data) VALUES($1,'test-app','r1','{\"rollback_sensitive\":\"security\"}')").bind::<Text, _>(&org).execute(&mut c).unwrap();
        diesel::sql_query("INSERT INTO hyperotaserver.release_operations(id,org_id,app_id,kind,source_release_id,state,data) VALUES($1,$2,'test-app','write','r1','unresolved','{}')").bind::<SqlUuid, _>(Uuid::new_v4()).bind::<Text, _>(&org).execute(&mut c).unwrap();
        for t in [
            "approval_policies",
            "deployment_requests",
            "app_groups",
            "app_group_members",
            "release_protections",
            "release_operations",
        ] {
            assert_eq!(rows_for(&mut c, t, &org), 1, "{t} before delete");
        }
    }

    // Delete: the control rows go with the organisation; audit history stays.
    let deleted = test::call_service(
        &service,
        test::TestRequest::delete()
            .uri(&format!("/organisations/{org}"))
            .to_request(),
    )
    .await;
    assert!(
        deleted.status().is_success(),
        "{:?}",
        test::read_body(deleted).await
    );
    {
        let mut c = state.db_pool.get().unwrap();
        for t in [
            "approval_policies",
            "deployment_requests",
            "app_groups",
            "app_group_members",
            "release_protections",
            "release_operations",
        ] {
            assert_eq!(rows_for(&mut c, t, &org), 0, "{t} after delete");
        }
        assert!(
            rows_for(&mut c, "release_events", &org) >= 1,
            "audit history is retained"
        );
    }

    // A new tenant takes the name, re-adds the same people and the same app name.
    assert!(test::call_service(&service, create())
        .await
        .status()
        .is_success());
    state
        .authz_provider
        .add_organisation_user(&state, "maker@test", &org, "checker@test", "admin")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, "test-app", "maker@test")
        .await
        .unwrap();
    {
        // The old workspace mapping was retired with the old tenant: the new application
        // brings its own, under a workspace name of its own.
        let mut c = state.db_pool.get().unwrap();
        assert_eq!(
            count_where(&mut c, "workspace_names", "organization_id", &org),
            0,
            "the old mapping is not inherited"
        );
        diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,'test-app',$2)").bind::<Text, _>(&org).bind::<Text, _>(format!("{org}-second")).execute(&mut c).unwrap();
    }
    let policy: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri("/approval-policy")
            .to_request(),
    )
    .await;
    assert_eq!(policy["enabled"], false, "no inherited policy: {policy}");
    assert_eq!(policy["makers"], json!([]), "{policy}");
    assert_eq!(policy["checkers"], json!([]), "{policy}");
    let queue: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri("/deployment-requests")
            .to_request(),
    )
    .await;
    assert_eq!(
        queue["requests"],
        json!([]),
        "no inherited requests: {queue}"
    );
    let groups: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri(&format!("/groups?org={org}"))
            .to_request(),
    )
    .await;
    assert!(
        !groups.to_string().contains("old group")
            && !groups.to_string().contains(&group.to_string()),
        "{groups}"
    );
    {
        let mut c = state.db_pool.get().unwrap();
        for t in [
            "approval_policies",
            "deployment_requests",
            "app_groups",
            "app_group_members",
            "release_protections",
            "release_operations",
        ] {
            assert_eq!(rows_for(&mut c, t, &org), 0, "{t} after recreate");
        }
    }
    // The old request id cannot be approved, rejected or read, even by the same checker.
    for decision in ["approve", "reject", "cancel"] {
        let response = test::call_service(
            &service,
            test::TestRequest::post()
                .uri(&format!("/deployment-requests/{old_id}/{decision}"))
                .set_json(json!({"reason":"x"}))
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), 404, "{decision}");
    }
    let read = test::call_service(
        &service,
        test::TestRequest::get()
            .uri(&format!("/deployment-requests/{old_id}"))
            .to_request(),
    )
    .await;
    assert_eq!(read.status(), 404);
    // The new organisation is open: its own policy and requests work from a clean slate.
    open_org_with_policy_row_only(&state, &org).await;
    let own = test::call_service(&service, test::TestRequest::post().uri("/deployment-requests").insert_header(("x-test-actor", "maker@test"))
        .set_json(json!({"action":"set_strict_serving","payload":{"body":{"strict":true}},"reason":"new tenant"})).to_request()).await;
    assert!(
        own.status().is_success(),
        "{:?}",
        test::read_body(own).await
    );
    upstream.stop(true).await;
}
async fn open_org_with_policy_row_only(state: &web::Data<AppState>, org: &str) {
    let mut c = state.db_pool.get().unwrap();
    diesel::sql_query(
        "INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,'test-app',$2)",
    )
    .bind::<Text, _>(org)
    .bind::<Jsonb, _>(
        json!({"enabled":true,"makers":["maker@test"],"checkers":["checker@test","maker@test"]}),
    )
    .execute(&mut c)
    .unwrap();
}

// A request approved while the organisation is being deleted must never run, and an
// organisation cannot be deleted while a request is mid-execution.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_organisation_delete_never_races_an_execution() {
    use actix_web::test;
    let (state, upstream, _) = fixture().await;
    let org = format!(
        "scratch-race-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    let service = scratch_org_service!(state, org);
    assert!(test::call_service(
        &service,
        test::TestRequest::post()
            .uri("/organisations/create")
            .insert_header(("x-test-actor", "maker@test"))
            .set_json(json!({"name":org}))
            .to_request()
    )
    .await
    .status()
    .is_success());
    open_org_with_policy(&state, &org, true).await;
    let raise = || {
        test::TestRequest::post().uri("/deployment-requests").insert_header(("x-test-actor", "maker@test"))
        .set_json(json!({"action":"set_strict_serving","payload":{"body":{"strict":true}},"reason":"race"})).to_request()
    };
    let raised: Value = test::call_and_read_body_json(&service, raise()).await;
    let id = raised["id"].as_str().unwrap().to_owned();
    let status = |id: &str| {
        let mut c = state.db_pool.get().unwrap();
        #[derive(QueryableByName)]
        struct S {
            #[diesel(sql_type = Text)]
            status: String,
        }
        diesel::sql_query("SELECT status FROM hyperotaserver.deployment_requests WHERE id=$1")
            .bind::<SqlUuid, _>(Uuid::parse_str(id).unwrap())
            .get_result::<S>(&mut c)
            .unwrap()
            .status
    };

    // 1. Mid-execution: deletion is refused, nothing is lost, the organisation stays open.
    {
        let mut c = state.db_pool.get().unwrap();
        diesel::sql_query(
            "UPDATE hyperotaserver.deployment_requests SET status='executing' WHERE id=$1",
        )
        .bind::<SqlUuid, _>(Uuid::parse_str(&id).unwrap())
        .execute(&mut c)
        .unwrap();
    }
    let refused = test::call_service(
        &service,
        test::TestRequest::delete()
            .uri(&format!("/organisations/{org}"))
            .to_request(),
    )
    .await;
    assert_eq!(refused.status(), 409);
    assert!(state
        .authz_provider
        .organisation_exists(&state, &org)
        .await
        .unwrap());
    {
        let mut c = state.db_pool.get().unwrap();
        assert_eq!(rows_for(&mut c, "approval_policies", &org), 1);
        assert_eq!(rows_for(&mut c, "deployment_requests", &org), 1);
        diesel::sql_query(
            "UPDATE hyperotaserver.deployment_requests SET status='pending' WHERE id=$1",
        )
        .bind::<SqlUuid, _>(Uuid::parse_str(&id).unwrap())
        .execute(&mut c)
        .unwrap();
        let closed = diesel::sql_query("SELECT count(*) AS n FROM hyperotaserver.organisation_epochs WHERE org_id=$1 AND closed_at IS NOT NULL").bind::<Text, _>(&org).get_result::<Total>(&mut c).unwrap().n;
        assert_eq!(closed, 0, "a refused delete leaves the organisation open");
    }

    // 2. Deletion has started (closed) but the authz delete has not happened yet: the
    //    request is still pending and approvable on paper, and must not start executing.
    crate::organisation::cleanup::close(&state, &org)
        .await
        .unwrap();
    let approve = test::call_service(
        &service,
        test::TestRequest::post()
            .uri(&format!("/deployment-requests/{id}/approve"))
            .set_json(json!({"reason":"late"}))
            .to_request(),
    )
    .await;
    assert_eq!(approve.status(), 409);
    assert_eq!(
        test::read_body_json::<Value, _>(approve).await["code"],
        "organisation_deleted"
    );
    assert_eq!(status(&id), "pending", "it never reached executing");

    // 3. The delete failed: the organisation reopens and the request is approvable again.
    crate::organisation::cleanup::reopen(&state, &org)
        .await
        .unwrap();
    let ok = test::call_service(
        &service,
        test::TestRequest::post()
            .uri(&format!("/deployment-requests/{id}/approve"))
            .set_json(json!({"reason":"ok"}))
            .to_request(),
    )
    .await;
    assert!(ok.status().is_success(), "{:?}", test::read_body(ok).await);
    assert_eq!(status(&id), "executed");
    upstream.stop(true).await;
}

// If the purge after a delete failed (or the organisation was deleted before purging
// existed), creating the name again removes the leftovers before the new tenant can use them.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_creating_an_organisation_purges_leftovers_of_an_interrupted_delete() {
    use actix_web::test;
    let (state, upstream, _) = fixture().await;
    let org = format!(
        "scratch-left-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    let service = scratch_org_service!(state, org);
    open_org_with_policy_row_only(&state, &org).await;
    {
        let mut c = state.db_pool.get().unwrap();
        diesel::sql_query(
            "INSERT INTO hyperotaserver.app_groups(id,org_id,name) VALUES($1,$2,'left behind')",
        )
        .bind::<SqlUuid, _>(Uuid::new_v4())
        .bind::<Text, _>(&org)
        .execute(&mut c)
        .unwrap();
        assert_eq!(rows_for(&mut c, "approval_policies", &org), 1);
    }
    assert!(test::call_service(
        &service,
        test::TestRequest::post()
            .uri("/organisations/create")
            .insert_header(("x-test-actor", "maker@test"))
            .set_json(json!({"name":org}))
            .to_request()
    )
    .await
    .status()
    .is_success());
    let mut c = state.db_pool.get().unwrap();
    for t in ["approval_policies", "app_groups"] {
        assert_eq!(rows_for(&mut c, t, &org), 0, "{t} purged by creation");
    }
    upstream.stop(true).await;
}

// The approval queue lists the requests the caller may act on: organisation-level readers
// see every application, application-level readers only theirs, everyone else nothing.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_request_queue_lists_what_the_caller_may_read() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, _) = fixture().await;
    let org = format!(
        "scratch-queue-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    let tag = Uuid::new_v4().simple().to_string();
    let who = |n: &str| format!("{n}-{tag}@test");
    let (org_write, org_read, app_only, files_only, stranger) = (
        who("org-write"),
        who("org-read"),
        who("app-only"),
        who("files-only"),
        who("stranger"),
    );
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    for app in ["a1", "a2"] {
        state
            .authz_provider
            .create_application(&state, &org, app, "maker@test")
            .await
            .unwrap();
    }
    state
        .authz_provider
        .upsert_custom_role(
            &state,
            "maker@test",
            &org,
            None,
            "files_only",
            &["file.read".to_string()],
        )
        .await
        .unwrap();
    for (sub, role) in [
        (&org_write, "write"),
        (&org_read, "read"),
        (&app_only, "files_only"),
        (&files_only, "files_only"),
    ] {
        state
            .authz_provider
            .add_organisation_user(&state, "maker@test", &org, sub, role)
            .await
            .unwrap();
    }
    state
        .authz_provider
        .add_application_user(&state, "maker@test", &org, "a1", &app_only, "read")
        .await
        .unwrap();
    {
        let mut c = state.db_pool.get().unwrap();
        for app in ["a1", "a2"] {
            let id = Uuid::new_v4();
            let data = json!({"id":id,"org":org,"application":app,"action":"ramp","status":"pending","payload":{},"expires_at":Utc::now()+chrono::Duration::hours(1)});
            diesel::sql_query("INSERT INTO hyperotaserver.deployment_requests(id,org_id,app_id,status,data) VALUES($1,$2,$3,'pending',$4)")
                .bind::<SqlUuid, _>(id).bind::<Text, _>(&org).bind::<Text, _>(app).bind::<Jsonb, _>(&data).execute(&mut c).unwrap();
        }
    }
    let o = org.clone();
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(move |req, srv| {
                let sub = req
                    .headers()
                    .get("x-test-actor")
                    .and_then(|s| s.to_str().ok())
                    .unwrap_or("")
                    .to_owned();
                let mut actor = auth(&sub, &o, "");
                actor.is_super_admin = false;
                actor.application = None;
                req.extensions_mut().insert(actor);
                srv.call(req)
            })
            .configure(routes),
    )
    .await;
    let listed = |sub: &str| {
        let (sub, service) = (sub.to_owned(), &service);
        async move {
            let page: Value = test::call_and_read_body_json(
                service,
                test::TestRequest::get()
                    .uri("/deployment-requests?status=pending")
                    .insert_header(("x-test-actor", sub))
                    .to_request(),
            )
            .await;
            let mut apps = page["requests"]
                .as_array()
                .unwrap()
                .iter()
                .map(|r| r["application"].as_str().unwrap().to_owned())
                .collect::<Vec<_>>();
            apps.sort();
            apps
        }
    };
    assert_eq!(
        listed(&org_write).await,
        ["a1", "a2"],
        "org-level maker/checker"
    );
    assert_eq!(listed(&org_read).await, ["a1", "a2"], "org-level reader");
    assert_eq!(listed(&app_only).await, ["a1"], "application-level reader");
    assert!(
        listed(&files_only).await.is_empty(),
        "a role without release.read"
    );
    assert!(listed(&stranger).await.is_empty(), "not a member");
    upstream.stop(true).await;
}

// Real events carry the package version they concern. Rows written before that was
// recorded get it at read time from another event of the same release, where one exists.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_feed_events_carry_a_package_version() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, _) = fixture().await;
    let org = format!(
        "scratch-version-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, "app", "maker@test")
        .await
        .unwrap();
    let mut c = state.db_pool.get().unwrap();
    // (release, action, payload, minutes ago)
    let rows: [(&str, &str, Value, i32); 8] = [
        ("legacy", "created", json!({}), 50),
        ("legacy", "ramped", json!({"traffic_percentage":25}), 40),
        // The request flow records the version on the request's own events.
        ("legacy", "requested", json!({"package_version":3}), 30),
        ("new", "created", json!({"package_version":7}), 20),
        (
            "new",
            "ramped",
            json!({"traffic_percentage":25,"from_target":0,"package_version":7}),
            10,
        ),
        // A string version recorded by a client of an older build, and a null one.
        ("unknown", "created", json!({"package_version":null}), 9),
        ("other", "created", json!({}), 8),
        ("other", "concluded", json!({"package_version":"4"}), 7),
    ];
    for (release, action, payload, ago) in rows {
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload,created_at) VALUES($1,$2,'app',$3,$4,'maker@test',$5,now()-($6::int * interval '1 minute'))")
            .bind::<SqlUuid, _>(Uuid::new_v4()).bind::<Text, _>(&org).bind::<Text, _>(release).bind::<Text, _>(action)
            .bind::<Jsonb, _>(&payload).bind::<diesel::sql_types::Integer, _>(ago).execute(&mut c).unwrap();
    }
    // A different application with the same release id and another version must not leak.
    state
        .authz_provider
        .create_application(&state, &org, "other-app", "maker@test")
        .await
        .unwrap();
    diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES($1,$2,'other-app','unknown','created','maker@test','{\"package_version\":99}')")
        .bind::<SqlUuid, _>(Uuid::new_v4()).bind::<Text, _>(&org).execute(&mut c).unwrap();
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(|req, srv| {
                req.extensions_mut().insert(auth("maker@test", "", ""));
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    let page: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri(&format!("/deployments?org={org}&app=app&limit=50"))
            .to_request(),
    )
    .await;
    assert_eq!(page["partial"], false, "{page}");
    let version = |release: &str, action: &str| {
        let item = page["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["release_id"] == release && e["action"] == action)
            .unwrap_or_else(|| panic!("{release}/{action} in {page}"));
        item["package_version"].clone()
    };
    assert_eq!(
        version("new", "created"),
        json!("7"),
        "recorded on the event"
    );
    assert_eq!(version("new", "ramped"), json!("7"));
    assert_eq!(
        version("legacy", "created"),
        json!("3"),
        "filled in from the request's event"
    );
    assert_eq!(version("legacy", "ramped"), json!("3"));
    assert_eq!(version("legacy", "requested"), json!("3"));
    assert_eq!(
        version("other", "created"),
        json!("4"),
        "filled in from a string version"
    );
    assert_eq!(
        version("unknown", "created"),
        Value::Null,
        "nothing to derive it from, and another app's release is not used"
    );
    let ramped = page["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["release_id"] == "new" && e["action"] == "ramped")
        .unwrap();
    assert_eq!(ramped["from_target"], 0);
    upstream.stop(true).await;
}

// Two requests on one release: every row of each says which request it belongs to, so a client can pair an
// approval with its own outcome. Rows without a recorded request carry null, never a guess from the release.
// Policy changes say which policy changed.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_feed_events_carry_the_request_they_belong_to() {
    use actix_web::{dev::Service, test, HttpMessage};
    let (state, upstream, _) = fixture().await;
    let org = format!(
        "scratch-reqid-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    state
        .authz_provider
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    state
        .authz_provider
        .create_application(&state, &org, "app", "maker@test")
        .await
        .unwrap();
    let mut c = state.db_pool.get().unwrap();
    let (r1, r2) = (Uuid::new_v4(), Uuid::new_v4());
    // (action, payload, minutes ago)
    let rows: Vec<(&str, Value, i32)> = vec![
        ("created", json!({"package_version":1}), 60),
        (
            "requested",
            json!({"id":r1,"status":"pending","package_version":1}),
            50,
        ),
        (
            "approved",
            json!({"id":r1,"status":"executing","package_version":1}),
            45,
        ),
        (
            "ramped",
            json!({"traffic_percentage":50,"package_version":1,"approval":{"request_id":r1}}),
            44,
        ),
        (
            "executed",
            json!({"id":r1,"status":"executed","package_version":1}),
            43,
        ),
        (
            "requested",
            json!({"id":r2,"status":"pending","package_version":1}),
            30,
        ),
        (
            "cancelled",
            json!({"id":r2,"status":"cancelled","package_version":1}),
            20,
        ),
        // A rollout made without any request, and an id that is not a request id.
        ("concluded", json!({"package_version":1}), 10),
        ("failed", json!({"id":"not-a-uuid"}), 9),
    ];
    for (action, payload, ago) in rows {
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload,created_at) VALUES($1,$2,'app','rel',$3,'maker@test',$4,now()-($5::int * interval '1 minute'))")
            .bind::<SqlUuid, _>(Uuid::new_v4()).bind::<Text, _>(&org).bind::<Text, _>(action)
            .bind::<Jsonb, _>(&payload).bind::<diesel::sql_types::Integer, _>(ago).execute(&mut c).unwrap();
    }
    for (payload, ago) in [
        (
            json!({"policy":"strict_serving","before":{"strict":false},"after":{"strict":true}}),
            8,
        ),
        (
            json!({"before":{"enabled":false},"after":{"enabled":true}}),
            7,
        ),
    ] {
        diesel::sql_query("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload,created_at) VALUES($1,$2,'app','','policy_changed','maker@test',$3,now()-($4::int * interval '1 minute'))")
            .bind::<SqlUuid, _>(Uuid::new_v4()).bind::<Text, _>(&org).bind::<Jsonb, _>(&payload)
            .bind::<diesel::sql_types::Integer, _>(ago).execute(&mut c).unwrap();
    }
    let service = test::init_service(
        actix_web::App::new()
            .app_data(state.clone())
            .wrap_fn(|req, srv| {
                req.extensions_mut().insert(auth("maker@test", "", ""));
                srv.call(req)
            })
            .service(crate::control_center::add_routes()),
    )
    .await;
    let page: Value = test::call_and_read_body_json(
        &service,
        test::TestRequest::get()
            .uri(&format!("/deployments?org={org}&app=app&limit=50"))
            .to_request(),
    )
    .await;
    assert_eq!(page["partial"], false, "{page}");
    let items = page["items"].as_array().unwrap();
    let ids = |action: &str| {
        items
            .iter()
            .filter(|e| e["action"] == action)
            .map(|e| e["request_id"].clone())
            .collect::<Vec<_>>()
    };
    assert_eq!(ids("requested"), vec![json!(r2), json!(r1)], "newest first");
    assert_eq!(ids("approved"), vec![json!(r1)]);
    assert_eq!(ids("executed"), vec![json!(r1)]);
    assert_eq!(ids("cancelled"), vec![json!(r2)]);
    assert_eq!(
        ids("ramped"),
        vec![json!(r1)],
        "a write made by an approved request records it"
    );
    assert_eq!(ids("created"), vec![Value::Null]);
    assert_eq!(
        ids("concluded"),
        vec![Value::Null],
        "a write with no request has none"
    );
    assert_eq!(
        ids("failed"),
        vec![Value::Null],
        "an id that is not a request id is not one"
    );
    let summaries = items
        .iter()
        .filter(|e| e["action"] == "policy_changed")
        .map(|e| e["summary"].as_str().unwrap().to_owned())
        .collect::<Vec<_>>();
    assert_eq!(
        summaries,
        vec![
            "Approval policy turned on",
            "Serving policy: strict serving turned on"
        ]
    );
    upstream.stop(true).await;
}

// ---- Application creation and organisation re-creation --------------------------------

fn count_where(c: &mut PgConnection, table: &str, column: &str, value: &str) -> i64 {
    diesel::sql_query(format!(
        "SELECT count(*) AS n FROM hyperotaserver.{table} WHERE {column}=$1"
    ))
    .bind::<Text, _>(value)
    .get_result::<Total>(c)
    .unwrap()
    .n
}
fn app_grants(c: &mut PgConnection, org: &str, app: &str) -> i64 {
    diesel::sql_query("SELECT count(*) AS n FROM hyperotaserver.authz_memberships WHERE scope='app' AND organisation=$1 AND application=$2").bind::<Text, _>(org).bind::<Text, _>(app).get_result::<Total>(c).unwrap().n
}

// A create that fails after the first steps leaves nothing behind: no grants, no workspace
// mapping, no serving policy. A name that is taken is refused before anything is written.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_failed_application_create_leaves_no_application() {
    use actix_web::test;
    let (state, upstream, upstream_data) = fixture().await;
    let org = format!(
        "scratch-appcreate-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    let service = scratch_org_service!(state, org);
    assert!(test::call_service(
        &service,
        test::TestRequest::post()
            .uri("/organisations/create")
            .insert_header(("x-test-actor", "maker@test"))
            .set_json(json!({"name":org}))
            .to_request()
    )
    .await
    .status()
    .is_success());
    let create = |app: &str| {
        test::TestRequest::post()
            .uri("/organisations/applications/create")
            .insert_header(("x-test-actor", "maker@test"))
            .set_json(json!({"application":app}))
            .to_request()
    };
    let mut c = state.db_pool.get().unwrap();

    // The workspace service is down: every step after the grants fails.
    *upstream_data.lock().unwrap() = json!({"strict_fail": true});
    for _ in 0..2 {
        let response = test::call_service(&service, create("ghost")).await;
        assert_eq!(
            response.status(),
            500,
            "{:?}",
            test::read_body(response).await
        );
        assert_eq!(
            count_where(&mut c, "workspace_names", "organization_id", &org),
            0,
            "workspace mapping"
        );
        assert_eq!(
            count_where(&mut c, "serving_policies", "org_id", &org),
            0,
            "serving policy"
        );
        assert_eq!(app_grants(&mut c, &org, "ghost"), 0, "grants");
    }
    // ...so the retry meets no leftover ("already exists") of the first attempt.
    state
        .authz_provider
        .create_application(&state, &org, "ghost", "maker@test")
        .await
        .expect("no leftover grants");
    state
        .authz_provider
        .delete_application(&state, &org, "ghost")
        .await
        .unwrap();

    // A taken name is refused with 409 and nothing is touched.
    diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,'taken',$2)").bind::<Text, _>(&org).bind::<Text, _>(format!("{org}-taken")).execute(&mut c).unwrap();
    let response = test::call_service(&service, create("taken")).await;
    assert_eq!(
        response.status(),
        409,
        "{:?}",
        test::read_body(response).await
    );
    assert_eq!(
        count_where(&mut c, "workspace_names", "organization_id", &org),
        1
    );
    assert_eq!(
        app_grants(&mut c, &org, "taken"),
        0,
        "a refused create grants nothing"
    );
    upstream.stop(true).await;
}

// Deleting an organisation retires its application data under a tombstone: a new
// organisation of the same name, and an app of the same name in it, start empty.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_recreated_organisation_gets_fresh_applications() {
    use actix_web::test;
    let (state, upstream, upstream_data) = fixture().await;
    let org = format!(
        "scratch-retire-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    let service = scratch_org_service!(state, org);
    let post = |uri: &str, body: Value| {
        test::TestRequest::post()
            .uri(uri)
            .insert_header(("x-test-actor", "maker@test"))
            .set_json(body)
            .to_request()
    };
    assert!(
        test::call_service(&service, post("/organisations/create", json!({"name":org})))
            .await
            .status()
            .is_success()
    );
    open_org_with_policy(&state, &org, true).await; // workspace mapping 'test-app' + grants + policy
    let mut c = state.db_pool.get().unwrap();
    let sql = |q: &str, c: &mut PgConnection| {
        diesel::sql_query(q.replace("$ORG", &format!("'{org}'")))
            .execute(c)
            .unwrap();
    };
    sql("INSERT INTO hyperotaserver.packages_v2(version,app_id,org_id,index,files) VALUES(1,'test-app',$ORG,'index',ARRAY[]::text[])", &mut c);
    sql("INSERT INTO hyperotaserver.files(app_id,org_id,version,url,file_path,size,checksum) VALUES('test-app',$ORG,1,'u','index',1,'c')", &mut c);
    sql("INSERT INTO hyperotaserver.blocked_packages(org_id,app_id,package_version,source_release) VALUES($ORG,'test-app','1','r')", &mut c);
    sql("INSERT INTO hyperotaserver.serving_policies(org_id,app_id,strict) VALUES($ORG,'test-app',false)", &mut c);
    sql("INSERT INTO hyperotaserver.releases(org_id,app_id,package_version,config_version,created_by) VALUES($ORG,'test-app',1,'1','u')", &mut c);
    sql("INSERT INTO hyperotaserver.user_credentials(client_id,username,password,organisation,application) VALUES(gen_random_uuid(),'old','secret',$ORG,'test-app')", &mut c);
    sql(
        "INSERT INTO hyperotaserver.first_device_requests(org_id,app_id) VALUES($ORG,'test-app')",
        &mut c,
    );
    sql("INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload) VALUES(gen_random_uuid(),$ORG,'test-app','r','created','maker@test','{}')", &mut c);
    let old_workspace: String = {
        #[derive(QueryableByName)]
        struct W {
            #[diesel(sql_type = Text)]
            workspace_name: String,
        }
        diesel::sql_query(
            "SELECT workspace_name FROM hyperotaserver.workspace_names WHERE organization_id=$1",
        )
        .bind::<Text, _>(&org)
        .get_result::<W>(&mut c)
        .unwrap()
        .workspace_name
    };

    let deleted = test::call_service(
        &service,
        test::TestRequest::delete()
            .uri(&format!("/organisations/{org}"))
            .insert_header(("x-test-actor", "maker@test"))
            .to_request(),
    )
    .await;
    assert!(
        deleted.status().is_success(),
        "{:?}",
        test::read_body(deleted).await
    );
    assert!(
        test::call_service(&service, post("/organisations/create", json!({"name":org})))
            .await
            .status()
            .is_success()
    );

    // Nothing of the old tenant is reachable under the name any more...
    for (table, column) in crate::organisation::cleanup::RETIRED {
        assert_eq!(
            count_where(&mut c, table, column, &org),
            0,
            "{table} still has rows for the recreated organisation"
        );
    }
    assert_eq!(
        count_where(&mut c, "first_device_requests", "org_id", &org),
        0
    );
    // ...it is kept under one tombstone, with its audit history, for manual recovery.
    #[derive(QueryableByName)]
    struct T {
        #[diesel(sql_type = Text)]
        tombstone: String,
    }
    let tombstones = diesel::sql_query(
        "SELECT tombstone FROM hyperotaserver.organisation_retirements WHERE org_id=$1",
    )
    .bind::<Text, _>(&org)
    .load::<T>(&mut c)
    .unwrap();
    assert_eq!(tombstones.len(), 1);
    let tombstone = &tombstones[0].tombstone;
    for (table, column) in [
        ("workspace_names", "organization_id"),
        ("packages_v2", "org_id"),
        ("files", "org_id"),
        ("blocked_packages", "org_id"),
        ("serving_policies", "org_id"),
        ("releases", "org_id"),
        ("user_credentials", "organisation"),
    ] {
        assert_eq!(
            count_where(&mut c, table, column, tombstone),
            1,
            "{table} retired"
        );
    }
    #[derive(QueryableByName)]
    struct W {
        #[diesel(sql_type = Text)]
        workspace_name: String,
    }
    let kept = diesel::sql_query(
        "SELECT workspace_name FROM hyperotaserver.workspace_names WHERE organization_id=$1",
    )
    .bind::<Text, _>(tombstone)
    .get_result::<W>(&mut c)
    .unwrap();
    assert_eq!(
        kept.workspace_name, old_workspace,
        "the old workspace mapping is kept, not deleted"
    );
    assert_eq!(
        count_where(&mut c, "release_events", "org_id", &org),
        1,
        "audit history is kept"
    );

    // Re-using the app name no longer collides with the old mapping: creation proceeds
    // to the workspace service (down here), fails there, and leaves nothing behind.
    *upstream_data.lock().unwrap() = json!({"strict_fail": true});
    let response = test::call_service(
        &service,
        post(
            "/organisations/applications/create",
            json!({"application":"test-app"}),
        ),
    )
    .await;
    let status = response.status();
    let body = String::from_utf8(test::read_body(response).await.to_vec()).unwrap();
    assert_eq!(status, 500, "{body}");
    assert!(
        !body.contains("duplicate") && !body.contains("already exists"),
        "{body}"
    );
    assert_eq!(
        count_where(&mut c, "workspace_names", "organization_id", &org),
        0
    );
    assert_eq!(app_grants(&mut c, &org, "test-app"), 0);
    diesel::sql_query("INSERT INTO hyperotaserver.workspace_names(organization_id,application_id,workspace_name) VALUES($1,'test-app',$2)").bind::<Text, _>(&org).bind::<Text, _>(format!("{org}-fresh")).execute(&mut c).expect("the name is free for a fresh workspace");
    upstream.stop(true).await;
}

// Promoting a member to organisation admin grants them application admin on every
// application (grant_admin_on_all_org_apps). Those grants must go when they are demoted.
#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn postgres_org_role_downgrade_removes_automatic_app_admin_grants() {
    let (state, upstream, _) = fixture().await;
    let org = format!(
        "scratch-downgrade-{}",
        &Uuid::new_v4().simple().to_string()[..12]
    );
    let tag = Uuid::new_v4().simple().to_string();
    let (user, other) = (
        format!("downgrade-{tag}@test"),
        format!("bystander-{tag}@test"),
    );
    let authz = &state.authz_provider;
    authz
        .create_organisation(&state, &org, "maker@test")
        .await
        .unwrap();
    for app in ["a1", "a2", "a3"] {
        authz
            .create_application(&state, &org, app, "maker@test")
            .await
            .unwrap();
    }
    for sub in [&user, &other] {
        authz
            .add_organisation_user(&state, "maker@test", &org, sub, "write")
            .await
            .unwrap();
    }
    authz
        .add_application_user(&state, "maker@test", &org, "a3", &other, "read")
        .await
        .unwrap();
    // A second explicit admin of a2, so that the user's read grant there is not protected
    // by the "an application keeps one admin" rule and must be kept for its own reason.
    let peer = format!("peer-{tag}@test");
    authz
        .add_organisation_user(&state, "maker@test", &org, &peer, "write")
        .await
        .unwrap();
    authz
        .add_application_user(&state, "maker@test", &org, "a2", &peer, "admin")
        .await
        .unwrap();
    let mut c = state.db_pool.get().unwrap();
    #[derive(QueryableByName)]
    struct R {
        #[diesel(sql_type = Text)]
        application: String,
        #[diesel(sql_type = Text)]
        role_key: String,
    }
    let app_roles = |c: &mut PgConnection, sub: &str| {
        let mut rows = diesel::sql_query("SELECT application, role_key FROM hyperotaserver.authz_memberships WHERE scope='app' AND organisation=$1 AND subject=$2")
            .bind::<Text, _>(&org).bind::<Text, _>(sub).load::<R>(c).unwrap().into_iter().map(|r| (r.application, r.role_key)).collect::<Vec<_>>();
        rows.sort();
        rows
    };
    let admin_on = |c: &mut PgConnection, sub: &str| {
        app_roles(c, sub)
            .into_iter()
            .filter(|(_, r)| r == "admin")
            .map(|(a, _)| a)
            .collect::<Vec<_>>()
    };
    let user_listed = |app: &'static str, sub: String| {
        let (state, org) = (state.clone(), org.clone());
        async move {
            state
                .authz_provider
                .list_application_users(&state, &org, app)
                .await
                .unwrap()
                .iter()
                .any(|u| u.username == sub)
        }
    };
    assert!(
        app_roles(&mut c, &user).is_empty(),
        "an organisation write member holds no application grants"
    );

    // Promotion grants admin everywhere, automatically.
    authz
        .update_organisation_user(&state, "maker@test", &org, &user, "admin")
        .await
        .unwrap();
    assert_eq!(admin_on(&mut c, &user), ["a1", "a2", "a3"]);
    // One grant is then made explicit, below admin.
    authz
        .update_application_user(&state, "maker@test", &org, "a2", &user, "read")
        .await
        .unwrap();
    assert_eq!(admin_on(&mut c, &user), ["a1", "a3"]);

    // Moving between admin and owner keeps what admins have.
    authz
        .update_organisation_user(&state, "maker@test", &org, &user, "owner")
        .await
        .unwrap();
    authz
        .update_organisation_user(&state, "maker@test", &org, &user, "admin")
        .await
        .unwrap();
    assert_eq!(
        admin_on(&mut c, &user).len(),
        3,
        "owner/admin both hold admin on every app"
    );

    // Downgrade: the automatic admin grants are removed; the explicit one below admin stays.
    authz
        .update_application_user(&state, "maker@test", &org, "a2", &user, "read")
        .await
        .unwrap();
    authz
        .update_organisation_user(&state, "maker@test", &org, &user, "write")
        .await
        .unwrap();
    assert!(
        admin_on(&mut c, &user).is_empty(),
        "{:?}",
        app_roles(&mut c, &user)
    );
    assert_eq!(
        app_roles(&mut c, &user),
        [("a2".to_string(), "read".to_string())],
        "the explicit read grant is kept"
    );
    assert!(!user_listed("a1", user.clone()).await && user_listed("a2", user.clone()).await);
    // Casbin agrees with the table: managing a1's users is an application-admin permission.
    assert!(!authz
        .enforce_permission(
            &state,
            &user,
            &org,
            Some("a1"),
            "application_user",
            "create"
        )
        .await
        .unwrap());

    // Demotion of someone who was never an admin, and everyone else's grants, are untouched.
    authz
        .update_organisation_user(&state, "maker@test", &org, &other, "read")
        .await
        .unwrap();
    assert_eq!(
        app_roles(&mut c, &other),
        [("a3".to_string(), "read".to_string())]
    );
    assert_eq!(
        admin_on(&mut c, "maker@test"),
        ["a1", "a2", "a3"],
        "the creator keeps administering"
    );

    // Admin -> read, and again after a second promotion: the cleanup is repeatable.
    authz
        .update_organisation_user(&state, "maker@test", &org, &user, "admin")
        .await
        .unwrap();
    assert_eq!(admin_on(&mut c, &user), ["a1", "a2", "a3"]);
    assert!(authz
        .enforce_permission(
            &state,
            &user,
            &org,
            Some("a1"),
            "application_user",
            "create"
        )
        .await
        .unwrap());
    authz
        .update_organisation_user(&state, "maker@test", &org, &user, "read")
        .await
        .unwrap();
    assert!(admin_on(&mut c, &user).is_empty());
    upstream.stop(true).await;
}
