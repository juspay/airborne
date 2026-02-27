use aws_smithy_runtime_api::client::interceptors::context::BeforeTransmitInterceptorContextMut;
use aws_smithy_runtime_api::client::interceptors::Intercept;
use aws_smithy_runtime_api::client::runtime_components::RuntimeComponents;
use aws_smithy_types::config_bag::ConfigBag;
use http::header::{HeaderValue, COOKIE};

#[derive(Debug, Clone)]
pub struct CookieIntercept {
    cookie: String,
}

impl CookieIntercept {
    pub fn new(cookie: impl Into<String>) -> Self {
        Self {
            cookie: cookie.into(),
        }
    }
}

impl Intercept for CookieIntercept {
    fn modify_before_signing(
        &self,
        context: &mut BeforeTransmitInterceptorContextMut<'_>,
        _runtime_components: &RuntimeComponents,
        _cfg: &mut ConfigBag,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let req = context.request_mut();

        // Add/overwrite Cookie header.
        req.headers_mut()
            .insert(COOKIE, HeaderValue::from_str(&self.cookie)?);

        Ok(())
    }

    fn name(&self) -> &'static str {
        "CookieIntercept"
    }
}
