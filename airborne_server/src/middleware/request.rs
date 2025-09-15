use actix_web::middleware::Next;
use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    Error,
};
use tracing::{info_span, Instrument};

pub async fn request_id_mw(
    mut req: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, Error> {
    let rid = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    req.headers_mut().insert(
        actix_web::http::header::HeaderName::from_static("x-request-id"),
        rid.parse().unwrap(),
    );

    let span = info_span!("http_request", request_id = %rid);

    // instrument the future so all logs during it are attached to the span
    let res = async move {
        let mut res = next.call(req).await?;
        // add request_id to response headers
        res.headers_mut().insert(
            actix_web::http::header::HeaderName::from_static("x-request-id"),
            rid.parse().unwrap(),
        );
        Ok::<_, actix_web::Error>(res)
    }
    .instrument(span)
    .await?;
    Ok(res)
}
