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
    let url = std::env::var("TEST_DATABASE_URL").expect("disposable TEST_DATABASE_URL required");
    assert!(url.contains("scratch"), "only disposable scratch databases");
    let mut conn = diesel::PgConnection::establish(&url).unwrap();
    conn.run_pending_migrations(crate::MIGRATIONS).unwrap();
    let pool = crate::utils::db::DbPool::builder()
        .max_size(8)
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
        let source = json!({"id":"source","name":format!("{app}-{org}-release-exp"),"override_keys":[],"created_at":"1970-01-01T00:00:01Z","created_by":"test","last_modified":"1970-01-01T00:00:01Z","last_modified_by":"test","status":"CONCLUDED","traffic_percentage":50,"experiment_type":"DEFAULT","description":"","change_reason":"","variants":[{"id":"exp","variant_type":"EXPERIMENTAL","overrides":{}}],"chosen_variant":"exp","context":{"platform":"ios"}});
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
