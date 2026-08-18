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

use std::cell::Cell;
use std::future::{ready, Ready};
use std::rc::Rc;

use actix_web::{
    body::{BoxBody, MessageBody},
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    http::{header, Method},
    web::Data,
    Error, HttpMessage, HttpResponse,
};
use futures::future::LocalBoxFuture;

use crate::middleware::auth::AuthResponse;
use crate::types::AppState;

/// Cap on the API response we copy into `data.response`. Matches the cap dispatch applies
/// to the *webhook's* response (`dispatch::MAX_RESPONSE_BODY`). A bigger body is sent as
/// `null` rather than truncated — half a JSON document is worse than none.
const MAX_RESPONSE_BODY: usize = 64 * 1024;

tokio::task_local! {
    static WEBHOOK_EVENT: Cell<Option<(&'static str, &'static str)>>;
}

/// Stamp the current request's `(resource, action)` so `WebhookEmit` can emit it on
/// success. Called by the `#[authz]` macro on every guarded handler. A no-op outside a
/// `WebhookEmit`-wrapped request (e.g. public routes), so it is always safe to call.
pub fn record_event(resource: &'static str, action: &'static str) {
    let _ = WEBHOOK_EVENT.try_with(|cell| cell.set(Some((resource, action))));
}

/// Events emitted explicitly by their handlers (richer payloads / delays); the
/// middleware must not also emit them.
const EXPLICIT_EVENTS: &[&str] = &["release.conclude"];

pub struct WebhookEmit;

impl<S, B> Transform<S, ServiceRequest> for WebhookEmit
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    // Boxed, not `B`: emitting means reading the handler's response body, which requires
    // collecting it and handing the request a fresh body built from the same bytes.
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type InitError = ();
    type Transform = WebhookEmitMw<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(WebhookEmitMw {
            service: Rc::new(service),
        }))
    }
}

pub struct WebhookEmitMw<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for WebhookEmitMw<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let method = req.method().clone();
        Box::pin(WEBHOOK_EVENT.scope(Cell::new(None), async move {
            let res = service.call(req).await?.map_into_boxed_body();

            let event = WEBHOOK_EVENT.try_with(|c| c.get()).ok().flatten();
            let Some((resource, action)) = event.filter(|_| res.status().is_success()) else {
                return Ok(res);
            };
            if !should_emit(&method, resource, action) {
                return Ok(res);
            }

            // Only now do we pay to buffer the body — every other request (uploads,
            // downloads, reads) passes through untouched.
            let (http_req, http_res) = res.into_parts();
            let is_json = http_res
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .is_some_and(|ct| ct.starts_with("application/json"));
            let (http_res, body) = http_res.into_parts();
            let bytes = actix_web::body::to_bytes(body).await.unwrap_or_default();

            let response = if is_json && bytes.len() <= MAX_RESPONSE_BODY {
                serde_json::from_slice::<serde_json::Value>(&bytes).ok()
            } else {
                None
            };
            emit(&http_req, resource, action, response);

            // Same bytes back out — the client sees a byte-identical response.
            let http_res: HttpResponse<BoxBody> = http_res.set_body(BoxBody::new(bytes));
            Ok(ServiceResponse::new(http_req, http_res))
        }))
    }
}

/// Cheap pre-check, run before we consider buffering the response body.
fn should_emit(method: &Method, resource: &str, action: &str) -> bool {
    if action == "read" || resource == "webhook" {
        return false;
    }
    if !matches!(
        *method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    ) {
        return false;
    }
    !EXPLICIT_EVENTS.contains(&format!("{resource}.{action}").as_str())
}

/// Build the payload and hand it to the emitter. `response` is the handler's JSON body,
/// or `None` when it was absent, non-JSON, or over [`MAX_RESPONSE_BODY`].
fn emit(
    req: &actix_web::HttpRequest,
    resource: &str,
    action: &str,
    response: Option<serde_json::Value>,
) {
    let event = format!("{resource}.{action}");
    let Some(state) = req.app_data::<Data<AppState>>() else {
        return;
    };
    if state.kronos.is_none() {
        return;
    }

    // Extract actor + org/app + path params, then release the extensions borrow.
    let (org, app, actor, params) = {
        let ext = req.extensions();
        let Some(auth) = ext.get::<AuthResponse>() else {
            return;
        };
        // An org is always required; an application is not. Without one the event is
        // org-level (`application.create`, `organisation_user.*`) and only org-scoped
        // webhooks can receive it.
        let Some(org) = auth.organisation.as_ref() else {
            return;
        };
        let mut app = auth.application.as_ref().map(|a| a.name.clone());
        // An org-level action never belongs to an application, even if the caller sent a
        // stray `x-application` header — don't let that misroute it to app webhooks.
        if super::is_org_only_event(&event) {
            app = None;
        }
        let mut params = serde_json::Map::new();
        for (k, v) in req.match_info().iter() {
            params.insert(k.to_string(), serde_json::Value::String(v.to_string()));
        }
        (org.name.clone(), app, auth.sub.clone(), params)
    };

    let data = serde_json::json!({
        "actor": actor,
        "resource": resource,
        "action": action,
        "params": params,
        "response": response,
    });
    crate::webhook::emit_event(state, org, app, event, data, 0);
}
