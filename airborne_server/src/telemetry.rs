// Copyright 2026 Juspay Technologies
// Licensed under the Apache License, Version 2.0.
// See http://www.apache.org/licenses/LICENSE-2.0

use crate::{
    middleware::auth::{require_org_and_app, AuthResponse},
    types::{ABError, AppState},
};
use actix_web::{get, post, web, HttpRequest, HttpResponse};
use airborne_authz_macros::authz;
use diesel::{
    prelude::*,
    sql_types::{BigInt, Integer, Jsonb, Text, Uuid as SqlUuid},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::net::IpAddr;
type Result<T> = crate::types::Result<T>;
#[derive(Serialize, Deserialize, Clone)]
pub struct Receipt {
    org: String,
    app: String,
    release: String,
    package: String,
    platform: String,
    native: String,
    created: i64,
    exp: usize,
    iat: usize,
}
#[derive(QueryableByName)]
struct Data {
    #[diesel(sql_type=Jsonb)]
    data: Value,
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=Integer)]
    count: i32,
}
fn key() -> Option<String> {
    std::env::var("TELEMETRY_SIGNING_KEY")
        .ok()
        .filter(|s| s.len() >= 32)
}
async fn db<T: Send + 'static>(
    state: &web::Data<AppState>,
    f: impl FnOnce(&mut diesel::PgConnection) -> Result<T> + Send + 'static,
) -> Result<T> {
    let pool = state.db_pool.clone();
    web::block(move || {
        let mut c = pool.get_timeout(std::time::Duration::from_secs(2))?;
        f(&mut c)
    })
    .await
    .map_err(|_| ABError::InternalServerError("Telemetry database unavailable".into()))?
}
type Cache = std::collections::HashMap<
    String,
    std::sync::Arc<tokio::sync::Mutex<Option<(std::time::Instant, Value)>>>,
>;
static CACHE: std::sync::LazyLock<tokio::sync::Mutex<Cache>> =
    std::sync::LazyLock::new(Default::default);
pub async fn invalidate(org: &str, app: &str) {
    let mut cache = CACHE.lock().await;
    for category in ["blocked", "receipts", "summary"] {
        cache.remove(&format!("{category}:{org}/{app}"));
    }
}
async fn cache_get(
    key: String,
    load: impl std::future::Future<Output = Result<Value>>,
) -> Result<Value> {
    tokio::time::timeout(std::time::Duration::from_secs(3), async {
        let entry = {
            let mut cache = CACHE.lock().await;
            if cache.len() >= 1024 {
                cache.retain(|_, v| std::sync::Arc::strong_count(v) > 1);
            }
            cache.entry(key).or_default().clone()
        };
        let mut cached = entry.lock().await;
        if let Some((at, value)) = cached.as_ref() {
            if at.elapsed().as_secs() < 30 {
                return Ok(value.clone());
            }
        }
        let value = load.await?;
        *cached = Some((std::time::Instant::now(), value.clone()));
        Ok(value)
    })
    .await
    .map_err(|_| ABError::InternalServerError("Telemetry lookup deadline".into()))?
}

pub async fn blocked(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Vec<String>> {
    let value = cache_get(format!("blocked:{org}/{app}"), async {
        Ok(json!(blocked_uncached(state, org, app).await?))
    })
    .await?;
    Ok(serde_json::from_value(value).unwrap_or_default())
}
async fn blocked_uncached(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
) -> Result<Vec<String>> {
    // Upgrade existing security markers before serving any manifest. Failure is closed;
    // an inaccessible historical release must not silently erase its exclusions.
    let (o, a) = (org.to_owned(), app.to_owned());
    let markers=db(state,move|c| Ok(diesel::sql_query("SELECT coalesce(jsonb_agg(release_id),'[]'::jsonb) AS data FROM hyperotaserver.release_protections WHERE org_id=$1 AND app_id=$2 AND data->>'rollback_sensitive'='security'").bind::<Text,_>(o).bind::<Text,_>(a).get_result::<Data>(c)?.data)).await?;
    if let Some(ids) = markers.as_array().filter(|a| !a.is_empty()) {
        let (_, exps) = crate::release::control_center::experiments(state, org, app).await?;
        for id in ids {
            let id = id.as_str().unwrap_or_default();
            let exp = exps.iter().find(|e| e.id == id).ok_or_else(|| {
                ABError::InternalServerError("Cannot resolve historical security marker".into())
            })?;
            let version = crate::release::control_center::version(exp).to_string();
            let (o, a, id) = (org.to_owned(), app.to_owned(), id.to_owned());
            db(state,move|c|{diesel::sql_query("INSERT INTO hyperotaserver.blocked_packages(org_id,app_id,package_version,source_release) SELECT org_id,app_id,version::text,$3 FROM hyperotaserver.packages_v2 WHERE org_id=$1 AND app_id=$2 AND version < $4::integer ON CONFLICT DO NOTHING").bind::<Text,_>(o).bind::<Text,_>(a).bind::<Text,_>(id).bind::<Text,_>(version).execute(c)?;Ok(())}).await?;
        }
    }
    let (o, a) = (org.to_owned(), app.to_owned());
    let v=db(state,move|c|Ok(diesel::sql_query("SELECT coalesce(jsonb_agg(package_version ORDER BY package_version),'[]'::jsonb) AS data FROM hyperotaserver.blocked_packages WHERE org_id=$1 AND app_id=$2").bind::<Text,_>(o).bind::<Text,_>(a).get_result::<Data>(c)?.data)).await?;
    Ok(serde_json::from_value(v).unwrap_or_default())
}
// Called only after config resolution. The token binds exactly the selected immutable package/config pair.
pub async fn served(
    state: &web::Data<AppState>,
    org: &str,
    app: &str,
    package: &str,
    config: &str,
    platform: Option<&str>,
    native: Option<&str>,
) -> Result<Option<Value>> {
    let Some(key) = key() else { return Ok(None) };
    let (Some(platform), Some(native)) = (platform, native) else {
        return Ok(None);
    };
    if !matches!(platform, "web" | "android" | "ios") || native.len() > 64 || native.is_empty() {
        return Ok(None);
    }
    let targets = cache_get(format!("receipts:{org}/{app}"), async {
        let (_, exps) = crate::release::control_center::experiments(state, org, app).await?;
        Ok(json!(exps.iter().flat_map(|e| e.variants.iter()
            .filter(|v| v.variant_type == superposition_sdk::types::VariantType::Experimental)
            .map(|v| json!({"id":e.id,"created":e.created_at.secs(),
                "package":crate::utils::document::document_to_json_value(v.overrides.get("package.version").unwrap_or(&aws_smithy_types::Document::Null)),
                "config":crate::utils::document::document_to_json_value(v.overrides.get("config.version").unwrap_or(&aws_smithy_types::Document::Null))})))
            .collect::<Vec<_>>()))
    }).await?;
    let e = targets.as_array().and_then(|rows| {
        rows.iter()
            .filter(|e| {
                e["package"].to_string().trim_matches('"') == package
                    && e["config"].as_str() == Some(config)
            })
            .max_by_key(|e| e["created"].as_i64())
    });
    let Some(e) = e else { return Ok(None) };
    let now = chrono::Utc::now().timestamp() as usize;
    let receipt = Receipt {
        org: org.into(),
        app: app.into(),
        release: e["id"].as_str().unwrap_or_default().into(),
        package: package.into(),
        platform: platform.into(),
        native: native.into(),
        created: e["created"].as_i64().unwrap_or_default(),
        iat: now,
        exp: now + 86400,
    };
    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &receipt,
        &jsonwebtoken::EncodingKey::from_secret(key.as_bytes()),
    )
    .map_err(|_| ABError::InternalServerError("Receipt signing failed".into()))?;
    Ok(Some(
        json!({"receipt":token,"expires_at":receipt.exp,"ingest_path":"/api/telemetry/reports","verification":"unverified"}),
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Batch {
    receipt: String,
    install_id: uuid::Uuid,
    events: Vec<Event>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Event {
    id: uuid::Uuid,
    kind: String,
}
fn ip_bucket(ip: IpAddr) -> String {
    match ip {
        IpAddr::V4(ip) => {
            let b = ip.octets();
            format!("{}.{}.{}", b[0], b[1], b[2])
        }
        IpAddr::V6(ip) => ip
            .to_ipv4_mapped()
            .map(|v| ip_bucket(IpAddr::V4(v)))
            .unwrap_or_else(|| hex::encode(&ip.octets()[..7])),
    }
}
#[post("/reports")]
pub async fn ingest(
    state: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<Batch>,
) -> Result<HttpResponse> {
    let Some(key) = key() else {
        return Ok(HttpResponse::ServiceUnavailable().insert_header(("x-amzn-errortype","ServiceUnavailableError")).json(json!({"code":"telemetry_unavailable","message":"Telemetry is disabled or unavailable"})));
    };
    if body.events.is_empty()
        || body.events.len() > 32
        || body.receipt.len() > 4096
        || body.events.iter().any(|e| {
            !matches!(
                e.kind.as_str(),
                "package_downloaded"
                    | "boot_started"
                    | "boot_success"
                    | "boot_failed"
                    | "rollback"
                    | "blocked_package"
            )
        })
    {
        return Err(ABError::BadRequest("Invalid telemetry batch".into()));
    }
    let receipt = jsonwebtoken::decode::<Receipt>(
        &body.receipt,
        &jsonwebtoken::DecodingKey::from_secret(key.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map_err(|_| ABError::BadRequest("Invalid or expired receipt".into()))?
    .claims;
    if std::env::var("TELEMETRY_RATE_LIMIT").as_deref() == Ok("true") {
        // Only exact, explicitly configured proxy addresses may supply the client IP.
        let peer = req
            .peer_addr()
            .ok_or_else(|| ABError::BadRequest("Missing peer".into()))?
            .ip();
        let trusted = std::env::var("TELEMETRY_TRUSTED_PROXIES")
            .unwrap_or_default()
            .split(',')
            .filter_map(|v| v.trim().parse::<IpAddr>().ok())
            .any(|ip| ip == peer);
        let ip = if trusted {
            req.headers()
                .get("x-forwarded-for")
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.split(',').next())
                .and_then(|h| h.trim().parse().ok())
                .unwrap_or(peer)
        } else {
            peer
        };
        let bucket = hex::encode(Sha256::digest(format!("{key}:{}", ip_bucket(ip))));
        let allowed=db(&state,move|c| {
        let minute=chrono::Utc::now().timestamp()/60;
        let n=diesel::sql_query("INSERT INTO hyperotaserver.telemetry_limits(bucket,minute,count) VALUES($1,$2,1) ON CONFLICT(bucket,minute) DO UPDATE SET count=LEAST(telemetry_limits.count+1,1000000) RETURNING count").bind::<Text,_>(&bucket).bind::<BigInt,_>(minute).get_result::<Count>(c)?.count;
        diesel::sql_query("DELETE FROM hyperotaserver.telemetry_limits WHERE minute < $1").bind::<BigInt,_>(minute-2).execute(c)?;
        Ok(n<=120)
    }).await?;
        if !allowed {
            return Ok(HttpResponse::TooManyRequests().insert_header(("x-amzn-errortype","TooManyRequestsError")).json(json!({"code":"telemetry_rate_limited","message":"Telemetry report limit reached; retry later"})));
        }
    }
    let body = body.into_inner();
    db(&state,move|c|c.transaction::<_,ABError,_>(|c|{
 diesel::sql_query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))").bind::<Text,_>(format!("telemetry:{}/{}",receipt.org,receipt.app)).execute(c)?;
 diesel::sql_query("DELETE FROM hyperotaserver.device_reports WHERE received_at < now()-interval '7 days'").execute(c)?;
 let versions=diesel::sql_query("SELECT count(DISTINCT native_version)::integer AS count FROM hyperotaserver.device_reports WHERE org_id=$1 AND app_id=$2 AND release_id=$3 AND native_version<>$4").bind::<Text,_>(&receipt.org).bind::<Text,_>(&receipt.app).bind::<Text,_>(&receipt.release).bind::<Text,_>(&receipt.native).get_result::<Count>(c)?.count;
 if versions>=32 {return Ok(())}
 let total=diesel::sql_query("SELECT count(*)::integer AS count FROM hyperotaserver.device_reports WHERE org_id=$1 AND app_id=$2").bind::<Text,_>(&receipt.org).bind::<Text,_>(&receipt.app).get_result::<Count>(c)?.count;
 if total>=50000 { return Ok(()) }
 for e in body.events {diesel::sql_query("INSERT INTO hyperotaserver.device_reports(org_id,app_id,release_id,package_version,native_version,platform,install_id,event_id,kind,release_created) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(event_id) DO NOTHING").bind::<Text,_>(&receipt.org).bind::<Text,_>(&receipt.app).bind::<Text,_>(&receipt.release).bind::<Text,_>(&receipt.package).bind::<Text,_>(&receipt.native).bind::<Text,_>(&receipt.platform).bind::<SqlUuid,_>(body.install_id).bind::<SqlUuid,_>(e.id).bind::<Text,_>(e.kind).bind::<BigInt,_>(receipt.created).execute(c)?;}
 Ok(())
 })).await?;
    Ok(HttpResponse::Accepted().json(json!({"accepted":true,"verification":"unverified"})))
}
// Pure advice. This function cannot dispatch a release write.
fn flag(current: &Value, baseline: Option<&Value>) -> Value {
    let n = |v: &Value, k: &str| v[k].as_f64().unwrap_or(0.0);
    let Some(b) = baseline else {
        let started = n(current, "boot_started");
        let failures = n(current, "boot_failed");
        return json!({"status":if failures >= 5.0 && failures / started.max(1.0) >= 0.10 {"suspicious_reports"} else if started >= 20.0 {"observed_only"} else {"insufficient_data"},"baseline_release_id":null,"minimum_boot_devices":20,"boot_failure_rate":failures/started.max(1.0),"boot_success_rate":n(current,"boot_success")/started.max(1.0),"automatic_action":"none"});
    };
    let denom = n(current, "boot_started");
    let bd = n(b, "boot_started");
    let enough = denom >= 20.0 && bd >= 20.0;
    let failure = n(current, "boot_failed") / denom.max(1.0);
    let bf = n(b, "boot_failed") / bd.max(1.0);
    let success = n(current, "boot_success") / denom.max(1.0);
    let bs = n(b, "boot_success") / bd.max(1.0);
    let crashes_up = n(current, "boot_failed") >= 5.0 && failure >= bf + 0.10;
    let successes_down = success <= bs - 0.10;
    json!({"status":if enough&&crashes_up&&successes_down{"seems_bad"}else if crashes_up{"suspicious_reports"}else if enough{"no_signal"}else{"insufficient_data"},"baseline_release_id":b["release_id"],"crashes_up":crashes_up,"successes_down":successes_down,"minimum_boot_devices":20,"boot_success_rate":success,"boot_failure_rate":failure,"baseline_success_rate":bs,"baseline_failure_rate":bf,"automatic_action":"none"})
}
pub async fn summary(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Value> {
    let value = cache_get(format!("summary:{org}/{app}"), async {
        Ok(json!(summary_uncached(state, org, app).await?))
    })
    .await?;
    Ok(value)
}
async fn summary_uncached(state: &web::Data<AppState>, org: &str, app: &str) -> Result<Value> {
    let (o, a) = (org.to_owned(), app.to_owned());
    let data=db(state,move|c|Ok(diesel::sql_query("SELECT coalesce(jsonb_agg(x ORDER BY x.release_created),'[]'::jsonb) AS data FROM (SELECT release_id,package_version,native_version,platform,min(release_created) AS release_created,count(DISTINCT install_id) AS reporting_devices,count(DISTINCT install_id) FILTER(WHERE kind='package_downloaded') AS package_downloaded,count(DISTINCT install_id) FILTER(WHERE kind='boot_started') AS boot_started,count(DISTINCT install_id) FILTER(WHERE kind='boot_success') AS boot_success,count(DISTINCT install_id) FILTER(WHERE kind='boot_failed') AS boot_failed,count(DISTINCT install_id) FILTER(WHERE kind='rollback') AS rollback,count(DISTINCT install_id) FILTER(WHERE kind='blocked_package') AS blocked_package,count(*) AS unverified_reports FROM (SELECT * FROM hyperotaserver.device_reports WHERE org_id=$1 AND app_id=$2 AND received_at>now()-interval '7 days' ORDER BY received_at DESC LIMIT 50000) recent GROUP BY GROUPING SETS ((release_id,package_version,native_version,platform),(release_id,package_version)) LIMIT 1000) x").bind::<Text,_>(o).bind::<Text,_>(a).get_result::<Data>(c)?.data)).await?;
    let all = data.as_array().cloned().unwrap_or_default();
    let totals: Vec<_> = all
        .iter()
        .filter(|r| r["platform"].is_null())
        .cloned()
        .collect();
    let rows: Vec<_> = all
        .into_iter()
        .filter(|r| !r["platform"].is_null())
        .collect();
    let mut previous = std::collections::HashMap::new();
    let releases = rows
        .iter()
        .map(|v| {
            let key = (v["platform"].to_string(), v["native_version"].to_string());
            let baseline = previous.get(&key);
            let mut row = v.clone();
            row["signal"] = flag(v, baseline);
            previous.insert(key, v.clone());
            row
        })
        .collect::<Vec<_>>();
    Ok(
        json!({"window_days":7,"verification":"unverified","automatic_action":"none","adoption_definition":"distinct installs acknowledging boot success within this window; not installed population","releases":releases,"release_totals":totals}),
    )
}
#[authz(resource="release",action="read",org_roles=["owner","admin","write","read"],app_roles=["admin","write","read"])]
#[get("/telemetry")]
pub async fn read(
    state: web::Data<AppState>,
    auth_response: web::ReqData<AuthResponse>,
) -> Result<web::Json<Value>> {
    let (o, a) = require_org_and_app(
        auth_response.organisation.clone(),
        auth_response.application.clone(),
    )?;
    let mut out = summary(&state, &o, &a).await?;
    // Security exclusions belong to this dedicated read only: `/overview` embeds the summary for every app on
    // every poll, and the exclusion lookup can reach Superposition. `null` means the lookup failed, never "none".
    out["blocked_package_versions"] = json!(blocked(&state, &o, &a).await.ok());
    Ok(web::Json(out))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn no_baseline_never_claims_health() {
        let current = json!({"boot_started":100,"boot_success":100,"boot_failed":0});
        assert_eq!(flag(&current, None)["status"], "observed_only");
        assert_eq!(
            flag(&json!({"boot_started":100,"boot_failed":20}), None)["status"],
            "suspicious_reports"
        );
        assert_eq!(
            flag(&json!({"boot_started":1}), None)["status"],
            "insufficient_data"
        );
        assert_eq!(flag(&current, None)["automatic_action"], "none");
    }
    #[test]
    fn bad_requires_both_signals_and_minimum() {
        let b =
            json!({"release_id":"baseline","boot_started":100,"boot_success":95,"boot_failed":2});
        let mut c = json!({"boot_started":100,"boot_success":95,"boot_failed":60});
        assert_eq!(flag(&c, Some(&b))["status"], "suspicious_reports");
        c["boot_success"] = json!(20);
        assert_eq!(flag(&c, Some(&b))["status"], "seems_bad");
        c["boot_started"] = json!(10);
        assert_ne!(flag(&c, Some(&b))["status"], "seems_bad");
    }
    #[test]
    fn telemetry_source_has_no_direct_release_mutations() {
        let source = include_str!("telemetry.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap();
        for forbidden in [
            "ramp_release",
            "conclude_release",
            "rollback_impl",
            "superposition_client.",
            "UPDATE hyperotaserver.release",
            "write_lock::",
        ] {
            assert!(!source.contains(forbidden), "{forbidden}");
        }
    }
    #[tokio::test]
    async fn slow_cache_key_does_not_stall_other_keys() {
        let slow = cache_get("test-slow".into(), async {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            Ok(json!(1))
        });
        let fast = async {
            tokio::task::yield_now().await;
            tokio::time::timeout(
                std::time::Duration::from_millis(50),
                cache_get("test-fast".into(), async { Ok(json!(2)) }),
            )
            .await
            .unwrap()
            .unwrap()
        };
        let (_, value) = tokio::join!(slow, fast);
        assert_eq!(value, json!(2));
    }
    #[test]
    fn mapped_ipv4_uses_ipv4_bucket() {
        assert_eq!(
            ip_bucket("::ffff:192.0.2.1".parse().unwrap()),
            ip_bucket("192.0.2.1".parse().unwrap())
        );
        assert_ne!(
            ip_bucket("::ffff:192.0.2.1".parse().unwrap()),
            ip_bucket("::ffff:192.0.3.1".parse().unwrap())
        );
    }
    #[test]
    fn ranges_are_separate() {
        assert_eq!(
            ip_bucket("192.0.2.1".parse().unwrap()),
            ip_bucket("192.0.2.254".parse().unwrap())
        );
        assert_ne!(
            ip_bucket("192.0.2.1".parse().unwrap()),
            ip_bucket("192.0.3.1".parse().unwrap())
        );
    }
}
