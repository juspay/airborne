// Review regressions using a disposable PostgreSQL database and HTTP fixture.
use super::*;
use diesel_migrations::MigrationHarness;

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
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn q10_auxiliary_write_serializes_policy_enablement() {
    let (state, upstream, _) = fixture().await;
    let org = format!("scratch-{}", Uuid::new_v4());
    let app = "auxiliary";
    let admitted = tokio::sync::Notify::new();
    let finish = tokio::sync::Notify::new();
    let writer = auxiliary_write(&state, &org, app, async {
        admitted.notify_one();
        finish.notified().await;
        Ok(())
    });
    let enable = async {
        admitted.notified().await;
        let conflict = write_lock::locked_inner(&state, &org, app, false, async { Ok(()) }).await;
        assert!(
            conflict.is_err(),
            "policy enablement crossed an admitted auxiliary mutation"
        );
        write_lock::locked_inner(&state, &org, "other-app", false, async { Ok(()) })
            .await
            .unwrap();
        finish.notify_one();
    };
    let (result, ()) = tokio::join!(writer, enable);
    result.unwrap();
    write_lock::locked_inner(&state,&org,app,false,async {
        let (org,app) = (org.clone(),app.to_owned());
        write_lock::store(move |c| {
            diesel::sql_query("INSERT INTO hyperotaserver.approval_policies(org_id,app_id,data) VALUES($1,$2,'{\"enabled\":true}')").bind::<Text,_>(org).bind::<Text,_>(app).execute(c)?;
            Ok(())
        }).await
    }).await.unwrap();
    let ran = std::cell::Cell::new(false);
    let denied = auxiliary_write(&state, &org, app, async {
        ran.set(true);
        Ok(())
    })
    .await;
    assert!(denied.is_err());
    assert!(!ran.get());
    upstream.stop(true).await;
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn q10_failed_emergency_leaves_retry_for_original_checker() {
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
        let invalid = super::super::write_lock::locked_inner(
            &state,
            &org,
            app,
            false,
            emergency(&state, &first, "source", &"x".repeat(256), true),
        )
        .await;
        assert!(invalid.is_err());
        assert!(rows(&state, &org, app, "reviews").await.unwrap().is_empty());

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
        let second = auth("checker@test", &org, app);
        assert!(
            rows(&state, &org, app, "reviews").await.unwrap().is_empty(),
            "failed attempt consumed emergency path"
        );
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
        assert_eq!(reviews[0]["actor"], "checker@test");
        assert_eq!(
            data.lock().unwrap()["rows"].as_array().unwrap().len(),
            2,
            "retry created a duplicate replacement"
        );
        upstream.stop(true).await;
    }
}

#[actix_web::test]
#[ignore = "requires disposable TEST_DATABASE_URL"]
async fn q10_stalled_read_releases_the_writer_session() {
    let (state, upstream, _) = fixture().await;
    let org = format!("scratch-{}", Uuid::new_v4());
    let admitted = tokio::sync::Notify::new();
    let stalled = write_lock::locked_inner(&state, &org, "stalled", false, async {
        admitted.notify_one();
        write_lock::bounded_read(std::future::pending::<Result<()>>()).await?
    });
    let healthy = async {
        admitted.notified().await;
        write_lock::locked_inner(&state, &org, "healthy", false, async { Ok(()) })
            .await
            .unwrap();
        assert!(
            write_lock::locked_inner(&state, &org, "stalled", false, async { Ok(()) })
                .await
                .is_err()
        );
    };
    let (expired, ()) = tokio::time::timeout(std::time::Duration::from_secs(17), async {
        tokio::join!(stalled, healthy)
    })
    .await
    .expect("stalled upstream retained writer beyond read budget");
    assert!(expired.is_err());
    // The timed-out read released both its physical advisory session and writer admission.
    write_lock::locked_inner(&state, &org, "stalled", false, async { Ok(()) })
        .await
        .unwrap();
    upstream.stop(true).await;
}
