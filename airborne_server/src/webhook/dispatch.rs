// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::time::Instant;

use actix_web::{web, HttpRequest, HttpResponse};
use bytes::Bytes;
use futures_util::{Stream, StreamExt};
use reqwest::redirect::Policy;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::run_blocking;
use crate::types::{ABError, AppState, Environment, Result};
use crate::utils::db::models::{WebhookDeliveryEntry, WebhookEntry};
use crate::webhook::types::WebhookAttempt;
use crate::webhook::{sign, store};

const MAX_RESPONSE_BODY: usize = 64 * 1024;

#[derive(Debug, Deserialize)]
struct DispatchInput {
    delivery_id: String,
}

/// Result of a single outbound POST attempt.
struct AttemptRecord {
    success: bool,
    request_url: String,
    request_headers: serde_json::Value,
    request_body: String,
    response_status: Option<i32>,
    response_headers: Option<serde_json::Value>,
    response_body: Option<String>,
    error: Option<String>,
    duration_ms: i32,
}

/// `POST /internal/webhooks/dispatch` — called by the Kronos worker. Guarded by the
/// internal bearer secret. Returns 200 to stop Kronos retrying (success/exhausted/
/// cancelled) or 500 to make it retry with backoff.
pub async fn dispatch_handler(
    req: HttpRequest,
    body: web::Bytes,
    state: web::Data<AppState>,
) -> HttpResponse {
    if !state.env.kronos_enabled {
        return HttpResponse::ServiceUnavailable().body("webhooks disabled");
    }

    // Verify the internal callback secret.
    let provided = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .unwrap_or("");
    if provided.is_empty() || provided != state.env.webhook_internal_secret {
        log::warn!("webhook dispatch: unauthorized internal callback");
        return HttpResponse::Unauthorized().finish();
    }

    let input: DispatchInput = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => return HttpResponse::BadRequest().body(format!("bad dispatch input: {e}")),
    };
    let delivery_id = match Uuid::parse_str(&input.delivery_id) {
        Ok(id) => id,
        Err(e) => return HttpResponse::BadRequest().body(format!("bad delivery_id: {e}")),
    };

    match execute_delivery(&state, delivery_id).await {
        Ok(true) => HttpResponse::Ok().json(json!({ "status": "done" })),
        Ok(false) => {
            // Not terminal — signal Kronos to retry with backoff.
            HttpResponse::InternalServerError().json(json!({ "status": "retry" }))
        }
        Err(e) => {
            log::error!("webhook dispatch delivery {delivery_id} errored: {e:?}");
            HttpResponse::InternalServerError().json(json!({ "status": "error" }))
        }
    }
}

/// `POST /internal/webhooks/maintenance` — called by the recurring Kronos job.
/// Deletes deliveries older than the retention window and schedules the next run.
pub async fn maintenance_handler(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    let Some(kronos) = state.kronos.clone() else {
        return HttpResponse::ServiceUnavailable().body("webhooks disabled");
    };
    let provided = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .unwrap_or("");
    if provided.is_empty() || provided != state.env.webhook_internal_secret {
        return HttpResponse::Unauthorized().finish();
    }

    let retention_days = state.env.webhook_delivery_retention_days;
    let deleted =
        match crate::webhook::maintenance::delete_old_deliveries(&state.db_pool, retention_days)
            .await
        {
            Ok(n) => n,
            Err(e) => {
                log::error!("webhook retention failed: {e:?}");
                return HttpResponse::InternalServerError().finish();
            }
        };
    log::info!("webhook retention: removed {deleted} deliveries older than {retention_days} days");

    // Self-reschedule the next daily maintenance run.
    if let Err(e) =
        crate::webhook::schedule_maintenance(kronos.as_ref(), &state.env.kronos_workspace, 86_400)
            .await
    {
        log::warn!("failed to schedule next webhook maintenance: {e:?}");
    }
    HttpResponse::Ok().json(json!({ "deleted": deleted }))
}

/// Execute one delivery attempt. Returns `true` if Kronos should stop retrying
/// (delivered, exhausted, or cancelled), `false` if it should retry.
pub async fn execute_delivery(state: &web::Data<AppState>, delivery_id: Uuid) -> Result<bool> {
    if !state.env.kronos_enabled {
        return Err(ABError::InternalServerError("webhooks disabled".into()));
    }

    let delivery = match store::get_delivery_by_id(&state.db_pool, delivery_id).await {
        Ok(d) => d,
        // Delivery was deleted (e.g. its webhook was removed) — stop retrying.
        Err(ABError::NotFound(_)) => return Ok(true),
        Err(e) => return Err(e),
    };
    if matches!(
        delivery.status.as_str(),
        "succeeded" | "cancelled" | "exhausted"
    ) {
        return Ok(true);
    }

    // Load the webhook; if it's gone or disabled, cancel the delivery and stop.
    let webhook = match store::get_webhook_by_id(&state.db_pool, delivery.webhook_id).await {
        Ok(w) if w.enabled => w,
        _ => {
            store::set_delivery_status(&state.db_pool, delivery_id, "cancelled")
                .await
                .ok();
            return Ok(true);
        }
    };

    let attempt_number = delivery.attempt_count + 1;
    let record = deliver_once(
        &state.env,
        state.master_encryption_key.as_deref(),
        &webhook,
        &delivery,
    )
    .await;

    let last_status = record.response_status;
    let new_status = if record.success {
        "succeeded"
    } else if attempt_number >= delivery.max_attempts {
        "exhausted"
    } else {
        "failed"
    };

    let attempt = WebhookAttempt {
        attempt_number,
        request_url: record.request_url,
        request_headers: record.request_headers,
        request_body: record.request_body,
        response_status: record.response_status,
        response_headers: record.response_headers,
        response_body: record.response_body,
        error: record.error,
        duration_ms: Some(record.duration_ms),
        attempted_at: chrono::Utc::now().to_rfc3339(),
    };
    // Append this attempt to the delivery's history (a JSONB array on the row).
    let mut attempts: Vec<WebhookAttempt> =
        serde_json::from_value(delivery.attempts.clone()).unwrap_or_default();
    attempts.push(attempt);
    let attempts_json = serde_json::to_value(&attempts).unwrap_or_else(|_| json!([]));

    store::record_attempt(
        &state.db_pool,
        delivery_id,
        attempts_json,
        new_status,
        attempt_number,
        last_status,
    )
    .await?;

    Ok(record.success || new_status == "exhausted")
}

/// Deliver a delivery's payload once: sign, SSRF-guard, POST, and return the raw
/// attempt result (used by both the Kronos-driven path and the inline test path).
async fn deliver_once(
    env: &Environment,
    encryption_key: Option<&str>,
    webhook: &WebhookEntry,
    delivery: &WebhookDeliveryEntry,
) -> AttemptRecord {
    let url = webhook.url.clone();
    let body = serde_json::to_string(&delivery.payload).unwrap_or_else(|_| "{}".to_string());

    // Decrypt the signing secret and compute the signature over the exact bytes.
    // Optional HMAC signing: only when the webhook has a secret configured.
    let signature_header: Option<String> = match &webhook.secret_encrypted {
        Some(enc) => match sign::decrypt_secret(enc, encryption_key).await {
            Ok(secret) => {
                let ts = chrono::Utc::now().timestamp();
                match sign::sign_payload(&secret, ts, &body) {
                    Ok(sig) => Some(format!("t={ts},v1={sig}")),
                    Err(e) => {
                        return AttemptRecord::failed(url, body, format!("signing failed: {e}"))
                    }
                }
            }
            Err(e) => {
                return AttemptRecord::failed(url, body, format!("secret decrypt failed: {e}"))
            }
        },
        None => None,
    };

    // SSRF guard (blocking DNS resolution off the worker thread).
    if let Err(e) = validate_url_blocking(&url, env.webhook_allow_insecure).await {
        return AttemptRecord::failed(url, body, e.to_string());
    }

    // Build outbound headers.
    let mut headers = reqwest::header::HeaderMap::new();
    let mut stored_headers = serde_json::Map::new();
    let put = |headers: &mut reqwest::header::HeaderMap,
               stored: &mut serde_json::Map<String, serde_json::Value>,
               name: &str,
               value: String,
               redact: bool| {
        if let (Ok(hn), Ok(hv)) = (
            reqwest::header::HeaderName::from_bytes(name.as_bytes()),
            reqwest::header::HeaderValue::from_str(&value),
        ) {
            headers.insert(hn, hv);
            stored.insert(
                name.to_string(),
                json!(if redact { "***".to_string() } else { value }),
            );
        }
    };

    put(
        &mut headers,
        &mut stored_headers,
        "Content-Type",
        "application/json".into(),
        false,
    );
    put(
        &mut headers,
        &mut stored_headers,
        "X-Airborne-Event",
        delivery.event.clone(),
        false,
    );
    put(
        &mut headers,
        &mut stored_headers,
        "X-Airborne-Delivery",
        delivery.id.to_string(),
        false,
    );
    put(
        &mut headers,
        &mut stored_headers,
        "X-Airborne-Webhook-Id",
        webhook.id.to_string(),
        false,
    );
    put(
        &mut headers,
        &mut stored_headers,
        "X-Airborne-Attempt",
        (delivery.attempt_count + 1).to_string(),
        false,
    );
    if let Some(sig) = &signature_header {
        put(
            &mut headers,
            &mut stored_headers,
            "X-Airborne-Signature",
            sig.clone(),
            false,
        );
    }

    // Merge user custom headers (redacting anything secret-looking when stored).
    if let Some(obj) = webhook.custom_headers.as_object() {
        for (k, v) in obj {
            if let Some(val) = v.as_str() {
                let redact = is_sensitive_header(k);
                put(
                    &mut headers,
                    &mut stored_headers,
                    k,
                    val.to_string(),
                    redact,
                );
            }
        }
    }

    let method = reqwest::Method::from_bytes(webhook.method.to_uppercase().as_bytes())
        .unwrap_or(reqwest::Method::POST);

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(
            env.webhook_outbound_timeout_secs,
        ))
        .redirect(Policy::none())
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return AttemptRecord::failed_with_headers(
                url,
                serde_json::Value::Object(stored_headers),
                body,
                format!("http client build failed: {e}"),
            )
        }
    };

    let start = Instant::now();
    let resp = client
        .request(method, &url)
        .headers(headers)
        .body(body.clone())
        .send()
        .await;
    let duration_ms = start.elapsed().as_millis() as i32;
    let stored_headers = serde_json::Value::Object(stored_headers);

    match resp {
        Ok(r) => {
            let status = r.status().as_u16() as i32;
            let resp_headers = collect_response_headers(r.headers());
            let content_length = r.content_length();
            let text = read_limited_text(r.bytes_stream(), content_length)
                .await
                .unwrap_or_default();
            let truncated = truncate(&text);
            AttemptRecord {
                success: (200..300).contains(&status),
                request_url: url,
                request_headers: stored_headers,
                request_body: body,
                response_status: Some(status),
                response_headers: Some(resp_headers),
                response_body: Some(truncated),
                error: None,
                duration_ms,
            }
        }
        Err(e) => AttemptRecord {
            success: false,
            request_url: url,
            request_headers: stored_headers,
            request_body: body,
            response_status: None,
            response_headers: None,
            response_body: None,
            error: Some(format!("request failed: {e}")),
            duration_ms,
        },
    }
}

impl AttemptRecord {
    fn failed(url: String, body: String, error: String) -> Self {
        AttemptRecord {
            success: false,
            request_url: url,
            request_headers: json!({}),
            request_body: body,
            response_status: None,
            response_headers: None,
            response_body: None,
            error: Some(error),
            duration_ms: 0,
        }
    }
    fn failed_with_headers(
        url: String,
        headers: serde_json::Value,
        body: String,
        error: String,
    ) -> Self {
        AttemptRecord {
            success: false,
            request_url: url,
            request_headers: headers,
            request_body: body,
            response_status: None,
            response_headers: None,
            response_body: None,
            error: Some(error),
            duration_ms: 0,
        }
    }
}

fn is_sensitive_header(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n == "authorization" || n.contains("secret") || n.contains("token") || n.contains("api-key")
}

fn collect_response_headers(headers: &reqwest::header::HeaderMap) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (k, v) in headers.iter() {
        map.insert(
            k.as_str().to_string(),
            json!(v.to_str().unwrap_or("<binary>")),
        );
    }
    serde_json::Value::Object(map)
}

async fn read_limited_text<S, E>(
    stream: S,
    content_length: Option<u64>,
) -> std::result::Result<String, E>
where
    S: Stream<Item = std::result::Result<Bytes, E>>,
{
    let read_limit = MAX_RESPONSE_BODY + 1;
    let capacity = content_length
        .unwrap_or(read_limit as u64)
        .min(read_limit as u64) as usize;
    let mut body = Vec::with_capacity(capacity);
    futures_util::pin_mut!(stream);

    while body.len() < read_limit {
        let Some(chunk) = stream.next().await else {
            break;
        };
        let chunk = chunk?;
        let remaining = read_limit - body.len();
        body.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
    }

    Ok(String::from_utf8_lossy(&body).into_owned())
}

fn truncate(s: &str) -> String {
    if s.len() <= MAX_RESPONSE_BODY {
        s.to_string()
    } else {
        let mut cutoff = MAX_RESPONSE_BODY;
        while !s.is_char_boundary(cutoff) {
            cutoff -= 1;
        }
        let mut out = s[..cutoff].to_string();
        out.push_str("…[truncated]");
        out
    }
}

async fn validate_url_blocking(url: &str, allow_insecure: bool) -> Result<()> {
    let url = url.to_string();
    run_blocking!({ crate::webhook::sign::validate_url(&url, allow_insecure) })
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;

    use futures_util::stream;

    use super::*;

    #[tokio::test]
    async fn response_body_read_is_bounded() {
        let chunks = stream::iter([
            Ok::<_, Infallible>(Bytes::from(vec![b'a'; MAX_RESPONSE_BODY])),
            Ok(Bytes::from_static(b"overflow")),
        ]);

        let text = read_limited_text(chunks, Some((MAX_RESPONSE_BODY + 8) as u64))
            .await
            .unwrap();

        assert_eq!(text.len(), MAX_RESPONSE_BODY + 1);
        assert_eq!(text.as_bytes()[MAX_RESPONSE_BODY], b'o');
    }

    #[test]
    fn truncate_keeps_short_body_unchanged() {
        assert_eq!(truncate("response"), "response");
    }

    #[test]
    fn truncate_snaps_to_utf8_char_boundary() {
        let mut input = "a".repeat(MAX_RESPONSE_BODY - 1);
        input.push('é');
        input.push('z');

        let expected = format!("{}…[truncated]", "a".repeat(MAX_RESPONSE_BODY - 1));
        assert_eq!(truncate(&input), expected);
    }
}
