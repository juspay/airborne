use actix_web::{
    dev::{ServiceRequest, ServiceResponse},
    http::{header::HeaderName, header::HeaderValue},
    middleware::Next,
    Error, HttpMessage,
};
use tracing::Span;
use tracing_actix_web::RootSpanBuilder;
use uuid::Uuid;

#[derive(Clone)]
struct RequestId(pub String);

pub struct WithRequestId;

impl RootSpanBuilder for WithRequestId {
    fn on_request_start(req: &ServiceRequest) -> Span {
        let req_id = req
            .headers()
            .get("x-request-id")
            .and_then(|h| h.to_str().ok())
            .map(str::to_owned)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        req.extensions_mut().insert(RequestId(req_id.clone()));

        let dimensions = req
            .headers()
            .get("x-dimension")
            .and_then(|h| h.to_str().ok())
            .map(str::to_owned)
            .unwrap_or_default();

        let org = req
            .headers()
            .get("x-organisation")
            .and_then(|h| h.to_str().ok())
            .map(str::to_owned)
            .or_else(|| req.match_info().get("org").map(str::to_owned))
            .or_else(|| req.match_info().get("organisation").map(str::to_owned))
            .unwrap_or_default();

        let app = req
            .headers()
            .get("x-application")
            .and_then(|h| h.to_str().ok())
            .map(str::to_owned)
            .or_else(|| req.match_info().get("app").map(str::to_owned))
            .or_else(|| req.match_info().get("application").map(str::to_owned))
            .unwrap_or_default();

        tracing::info_span!(
            "HTTP request",
            request_id = %req_id,
            dimensions = %dimensions,
            method = %req.method(),
            org_id = %org,
            app_id = %app,
            superposition_workspace = tracing::field::Empty,
            route  = %req.match_pattern().unwrap_or("<unmatched>".to_string()),
        )
    }

    fn on_request_end<B: actix_web::body::MessageBody>(
        _: Span,
        _: &Result<ServiceResponse<B>, Error>,
    ) {
    }
}

pub async fn req_id_header_mw<B>(
    req: ServiceRequest,
    next: Next<B>,
) -> Result<ServiceResponse<B>, Error> {
    let mut res = next.call(req).await?;

    let req_id = res.request().extensions().get::<RequestId>().cloned();
    if let Some(RequestId(id)) = req_id {
        res.headers_mut().insert(
            HeaderName::from_static("x-request-id"),
            HeaderValue::from_str(&id).unwrap_or(HeaderValue::from_static("invalid-req-id")),
        );
    }
    Ok(res)
}
