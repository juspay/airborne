use std::{
    collections::HashMap,
    sync::{Arc, OnceLock},
    time::{Duration, Instant},
};

use async_trait::async_trait;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, TokenData, Validation};
use log::{debug, warn};
use openidconnect::{
    core::{CoreAuthenticationFlow, CoreClient, CoreProviderMetadata, CoreTokenResponse},
    AuthorizationCode, ClientId, ClientSecret, ConfigurationError, CsrfToken, IssuerUrl, Nonce,
    OAuth2TokenResponse, PkceCodeChallenge, PkceCodeVerifier, RedirectUrl, RefreshToken,
    ResourceOwnerPassword, ResourceOwnerUsername, Scope, TokenResponse as OidcTokenResponseTrait,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::{
    types as airborne_types,
    types::{ABError, AppState, AuthnProviderKind, Environment},
    user::types::{LoginFailure, TokenResponse, UserCredentials, UserToken},
};

pub mod auth0;
pub mod keycloak;
pub mod oidc;
pub mod okta;

const OIDC_CACHE_TTL: Duration = Duration::from_secs(300);
const OAUTH_PKCE_STATE_TTL: Duration = Duration::from_secs(600);

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthnTokenClaims {
    pub sub: String,
    pub preferred_username: Option<String>,
    pub email: Option<String>,
    pub iss: Option<String>,
}

#[derive(Clone, Debug)]
pub struct OidcProviderMetadata {
    pub issuer: String,
}

#[derive(Clone, Debug)]
pub struct OAuthUrlResponse {
    pub auth_url: String,
    pub state: String,
}

#[derive(Clone)]
struct CachedOidcData {
    fetched_at: Instant,
    provider_metadata: CoreProviderMetadata,
    jwks: JsonWebKeySet,
}

#[derive(Clone)]
struct CachedPkceData {
    created_at: Instant,
    code_verifier: String,
}

#[derive(Clone, Debug, Deserialize)]
struct JsonWebKeySet {
    keys: Vec<JsonWebKey>,
}

#[derive(Clone, Debug, Deserialize)]
struct JsonWebKey {
    kid: Option<String>,
    kty: String,
    alg: Option<String>,
    n: Option<String>,
    e: Option<String>,
}

static OIDC_CACHE: OnceLock<RwLock<HashMap<String, CachedOidcData>>> = OnceLock::new();
static OAUTH_PKCE_CACHE: OnceLock<RwLock<HashMap<String, CachedPkceData>>> = OnceLock::new();
static OIDC_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

fn oidc_cache() -> &'static RwLock<HashMap<String, CachedOidcData>> {
    OIDC_CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

fn oauth_pkce_cache() -> &'static RwLock<HashMap<String, CachedPkceData>> {
    OAUTH_PKCE_CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

fn oidc_http_client() -> &'static Client {
    OIDC_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Failed to build OIDC HTTP client")
    })
}

fn rewrite_to_external_endpoint(
    endpoint: &str,
    internal_issuer: &str,
    external_issuer: &str,
) -> String {
    let internal = internal_issuer.trim_end_matches('/');
    let external = external_issuer.trim_end_matches('/');
    if let Some(stripped_endpoint) = endpoint.strip_prefix(internal) {
        format!("{}{}", external, stripped_endpoint)
    } else {
        endpoint.to_string()
    }
}

fn provider_metadata_to_jwks(
    provider_metadata: &CoreProviderMetadata,
) -> airborne_types::Result<JsonWebKeySet> {
    let serialized = serde_json::to_value(provider_metadata.jwks()).map_err(|error| {
        ABError::InternalServerError(format!("Failed to serialize OIDC JWKS: {error}"))
    })?;
    serde_json::from_value(serialized).map_err(|error| {
        ABError::InternalServerError(format!("Failed to deserialize OIDC JWKS: {error}"))
    })
}

fn map_configuration_error(context: &str, error: ConfigurationError) -> ABError {
    ABError::InternalServerError(format!("{context}: {error}"))
}

fn purge_expired_pkce_entries(cache: &mut HashMap<String, CachedPkceData>) {
    cache.retain(|_, value| value.created_at.elapsed() <= OAUTH_PKCE_STATE_TTL);
}

async fn save_pkce_verifier(oauth_state: String, code_verifier: String) {
    let cache = oauth_pkce_cache();
    let mut write_guard = cache.write().await;
    purge_expired_pkce_entries(&mut write_guard);
    write_guard.insert(
        oauth_state,
        CachedPkceData {
            created_at: Instant::now(),
            code_verifier,
        },
    );
}

async fn consume_pkce_verifier(oauth_state: Option<&str>) -> airborne_types::Result<String> {
    let oauth_state = oauth_state
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ABError::BadRequest("Missing OAuth state parameter".to_string()))?;

    let cache = oauth_pkce_cache();
    let mut write_guard = cache.write().await;
    purge_expired_pkce_entries(&mut write_guard);

    let pkce_entry = write_guard
        .remove(oauth_state)
        .ok_or_else(|| ABError::Unauthorized("Invalid or expired OAuth state".to_string()))?;

    Ok(pkce_entry.code_verifier)
}

async fn fetch_oidc_data(
    env: &Environment,
    force_refresh: bool,
) -> airborne_types::Result<CachedOidcData> {
    let cache_key = env.authn_issuer_url.trim_end_matches('/').to_string();
    let cache = oidc_cache();

    if !force_refresh {
        let read_guard = cache.read().await;
        if let Some(cached) = read_guard.get(&cache_key) {
            if cached.fetched_at.elapsed() < OIDC_CACHE_TTL {
                return Ok(cached.clone());
            }
        }
    }

    let issuer_url = IssuerUrl::new(cache_key.clone()).map_err(|error| {
        ABError::InternalServerError(format!("Invalid OIDC issuer URL '{cache_key}': {error}"))
    })?;
    let provider_metadata = CoreProviderMetadata::discover_async(issuer_url, oidc_http_client())
        .await
        .map_err(|error| {
            ABError::InternalServerError(format!(
                "Failed to discover OIDC provider metadata: {error}"
            ))
        })?;
    let jwks = provider_metadata_to_jwks(&provider_metadata)?;
    let new_data = CachedOidcData {
        fetched_at: Instant::now(),
        provider_metadata,
        jwks,
    };
    let mut write_guard = cache.write().await;
    write_guard.insert(cache_key, new_data.clone());
    Ok(new_data)
}

pub async fn get_oidc_provider_metadata(
    env: &Environment,
) -> airborne_types::Result<OidcProviderMetadata> {
    let oidc_data = fetch_oidc_data(env, false).await?;

    Ok(OidcProviderMetadata {
        issuer: oidc_data.provider_metadata.issuer().url().to_string(),
    })
}

fn is_supported_algorithm(algorithm: Algorithm) -> bool {
    matches!(
        algorithm,
        Algorithm::RS256 | Algorithm::RS384 | Algorithm::RS512
    )
}

fn build_validation(
    algorithm: Algorithm,
    metadata: &OidcProviderMetadata,
    env: &Environment,
) -> Validation {
    let mut validation = Validation::new(algorithm);
    validation.set_audience(&[env.authn_client_id.as_str()]);
    validation.set_issuer(&[metadata.issuer.as_str()]);
    validation.validate_exp = true;
    validation.leeway = env.authn_clock_skew_secs;
    validation
}

fn decode_with_jwks(
    token: &str,
    algorithm: Algorithm,
    kid: Option<&str>,
    metadata: &OidcProviderMetadata,
    env: &Environment,
    jwks: &JsonWebKeySet,
) -> airborne_types::Result<TokenData<AuthnTokenClaims>> {
    let mut candidates: Vec<&JsonWebKey> = jwks
        .keys
        .iter()
        .filter(|jwk| jwk.kty.eq_ignore_ascii_case("RSA") && jwk.n.is_some() && jwk.e.is_some())
        .collect();

    if let Some(expected_kid) = kid {
        let kid_filtered: Vec<&JsonWebKey> = candidates
            .iter()
            .copied()
            .filter(|jwk| jwk.kid.as_deref() == Some(expected_kid))
            .collect();
        if !kid_filtered.is_empty() {
            candidates = kid_filtered;
        }
    }

    if candidates.is_empty() {
        return Err(ABError::Unauthorized(
            "No valid RSA keys found in OIDC JWKS".to_string(),
        ));
    }

    let validation = build_validation(algorithm, metadata, env);
    let mut last_error = None;

    for jwk in candidates {
        if let Some(jwk_alg) = jwk.alg.as_deref() {
            let expected = match algorithm {
                Algorithm::RS256 => "RS256",
                Algorithm::RS384 => "RS384",
                Algorithm::RS512 => "RS512",
                _ => "",
            };
            if !expected.is_empty() && !jwk_alg.eq_ignore_ascii_case(expected) {
                continue;
            }
        }

        let key = DecodingKey::from_rsa_components(
            jwk.n.as_deref().unwrap_or_default(),
            jwk.e.as_deref().unwrap_or_default(),
        )
        .map_err(|error| {
            ABError::InternalServerError(format!(
                "Failed to build decoding key from OIDC JWKS: {error}"
            ))
        })?;

        match decode::<AuthnTokenClaims>(token, &key, &validation) {
            Ok(token_data) => return Ok(token_data),
            Err(error) => {
                last_error = Some(error);
            }
        }
    }

    Err(ABError::Unauthorized(format!(
        "Failed to verify OIDC token: {}",
        last_error
            .map(|err| err.to_string())
            .unwrap_or_else(|| "no suitable verification key found".to_string())
    )))
}

pub async fn verify_authn_token(
    token: &str,
    env: &Environment,
) -> airborne_types::Result<TokenData<AuthnTokenClaims>> {
    let header = decode_header(token)?;
    let algorithm = header.alg;
    if !is_supported_algorithm(algorithm) {
        return Err(ABError::Unauthorized(format!(
            "Unsupported OIDC token signing algorithm: {:?}",
            algorithm
        )));
    }

    let metadata = get_oidc_provider_metadata(env).await?;
    let kid = header.kid.as_deref();
    let first_fetch = fetch_oidc_data(env, false).await?;

    match decode_with_jwks(token, algorithm, kid, &metadata, env, &first_fetch.jwks) {
        Ok(token_data) => Ok(token_data),
        Err(first_error) => {
            // Retry once with a forced JWKS refresh to handle key rotation.
            warn!(
                "OIDC token verification failed on cached JWKS: {}",
                first_error
            );
            let refreshed = fetch_oidc_data(env, true).await?;
            match decode_with_jwks(token, algorithm, kid, &metadata, env, &refreshed.jwks) {
                Ok(token_data) => {
                    debug!("OIDC token verification succeeded after JWKS refresh");
                    Ok(token_data)
                }
                Err(second_error) => Err(second_error),
            }
        }
    }
}

#[async_trait]
pub trait AuthNProvider: Send + Sync {
    fn kind(&self) -> AuthnProviderKind;

    fn supports_password_login(&self) -> bool;

    fn supports_signup(&self) -> bool;

    fn supports_oidc_authorize(&self) -> bool {
        true
    }

    fn is_oidc_login_enabled(&self, _state: &AppState) -> bool {
        self.supports_oidc_authorize()
    }

    fn ensure_password_login_supported(&self) -> airborne_types::Result<()> {
        if self.supports_password_login() {
            Ok(())
        } else {
            Err(ABError::BadRequest(
                "Password login is not supported for configured AuthN provider".to_string(),
            ))
        }
    }

    fn ensure_signup_supported(&self) -> airborne_types::Result<()> {
        if self.supports_signup() {
            Ok(())
        } else {
            Err(ABError::BadRequest(
                "User registration is not supported for configured AuthN provider".to_string(),
            ))
        }
    }

    fn ensure_oidc_login_enabled(&self, state: &AppState) -> airborne_types::Result<()> {
        if self.is_oidc_login_enabled(state) {
            Ok(())
        } else {
            Err(ABError::BadRequest(
                "OIDC login is not supported for configured AuthN provider".to_string(),
            ))
        }
    }

    async fn get_oauth_url(
        &self,
        state: &AppState,
        offline: bool,
        _idp_hint: Option<&str>,
    ) -> airborne_types::Result<OAuthUrlResponse> {
        build_oauth_url_common(state, offline, &[], &["email", "profile"]).await
    }

    async fn exchange_code_for_token(
        &self,
        state: &AppState,
        code: &str,
        oauth_state: Option<&str>,
    ) -> airborne_types::Result<TokenResponse> {
        exchange_code_for_token_common(state, code, oauth_state).await
    }

    async fn login_with_password(
        &self,
        state: &AppState,
        credentials: &UserCredentials,
    ) -> airborne_types::Result<UserToken> {
        self.ensure_password_login_supported()?;
        password_login_common(state, credentials, None).await
    }

    async fn login_with_password_for_pat(
        &self,
        state: &AppState,
        credentials: &UserCredentials,
    ) -> airborne_types::Result<UserToken> {
        self.login_with_password(state, credentials).await
    }

    async fn signup_with_password(
        &self,
        _state: &AppState,
        _credentials: &UserCredentials,
    ) -> airborne_types::Result<UserToken> {
        self.ensure_signup_supported()?;
        Err(ABError::BadRequest(
            "User registration is not supported for configured AuthN provider".to_string(),
        ))
    }

    async fn refresh_access_token(
        &self,
        state: &AppState,
        refresh_token: &str,
    ) -> airborne_types::Result<UserToken> {
        refresh_access_token_common(state, refresh_token).await
    }

    async fn verify_access_token(
        &self,
        state: &AppState,
        access_token: &str,
    ) -> airborne_types::Result<TokenData<AuthnTokenClaims>> {
        verify_authn_token(access_token, &state.env).await
    }

    fn supports_service_accounts(&self) -> bool {
        false
    }

    async fn create_service_account_user(
        &self,
        _state: &AppState,
        _username: &str,
        _email: &str,
        _password: &str,
    ) -> airborne_types::Result<UserToken> {
        Err(ABError::BadRequest(
            "Service accounts are not supported for configured AuthN provider".to_string(),
        ))
    }

    async fn delete_user(&self, _state: &AppState, _username: &str) -> airborne_types::Result<()> {
        Err(ABError::BadRequest(
            "User deletion is not supported for configured AuthN provider".to_string(),
        ))
    }
}

pub fn build_authn_provider(kind: AuthnProviderKind) -> Arc<dyn AuthNProvider> {
    match kind {
        AuthnProviderKind::Keycloak => Arc::new(keycloak::KeycloakAuthNProvider),
        AuthnProviderKind::Oidc => Arc::new(oidc::OidcAuthNProvider),
        AuthnProviderKind::Okta => Arc::new(okta::OktaAuthNProvider),
        AuthnProviderKind::Auth0 => Arc::new(auth0::Auth0AuthNProvider),
    }
}

fn redirect_uri(state: &AppState) -> String {
    format!("{}/oauth/callback", state.env.public_url)
}

fn oidc_redirect_url(state: &AppState) -> airborne_types::Result<RedirectUrl> {
    RedirectUrl::new(redirect_uri(state))
        .map_err(|error| ABError::InternalServerError(format!("Invalid redirect URI: {error}")))
}

fn oauth_token_type(token_response: &CoreTokenResponse) -> String {
    token_response.token_type().as_ref().to_string()
}

fn oauth_expires_in(token_response: &CoreTokenResponse) -> i64 {
    token_response
        .expires_in()
        .map(|duration| duration.as_secs().min(i64::MAX as u64) as i64)
        .unwrap_or_default()
}

fn to_public_token_response(token_response: &CoreTokenResponse) -> TokenResponse {
    TokenResponse {
        access_token: token_response.access_token().secret().to_string(),
        token_type: oauth_token_type(token_response),
        expires_in: oauth_expires_in(token_response),
        refresh_token: token_response
            .refresh_token()
            .map(|token| token.secret().to_string()),
        refresh_expires_in: None,
        id_token: token_response
            .id_token()
            .map(|id_token| id_token.to_string()),
    }
}

fn to_user_token(token_response: &CoreTokenResponse) -> airborne_types::Result<UserToken> {
    let refresh_token = token_response
        .refresh_token()
        .ok_or_else(|| {
            ABError::InternalServerError(
                "Authentication response missing refresh token".to_string(),
            )
        })?
        .secret()
        .to_string();

    Ok(UserToken {
        access_token: token_response.access_token().secret().to_string(),
        token_type: oauth_token_type(token_response),
        expires_in: oauth_expires_in(token_response),
        refresh_token,
        // refresh_expires_in is provider-specific and not part of core OAuth2/OIDC token response.
        refresh_expires_in: 0,
    })
}

pub async fn build_oauth_url_common(
    state: &AppState,
    offline: bool,
    extra_query_params: &[(&str, &str)],
    additional_scopes: &[&str],
) -> airborne_types::Result<OAuthUrlResponse> {
    let oidc_data = fetch_oidc_data(&state.env, false).await?;
    let client = CoreClient::from_provider_metadata(
        oidc_data.provider_metadata,
        ClientId::new(state.env.authn_client_id.clone()),
        Some(ClientSecret::new(state.env.authn_client_secret.clone())),
    )
    .set_redirect_uri(oidc_redirect_url(state)?);
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let mut authorization_request = client.authorize_url(
        CoreAuthenticationFlow::AuthorizationCode,
        CsrfToken::new_random,
        Nonce::new_random,
    );
    authorization_request = authorization_request.set_pkce_challenge(pkce_challenge);

    for scope in additional_scopes {
        authorization_request = authorization_request.add_scope(Scope::new((*scope).to_string()));
    }

    if offline {
        authorization_request =
            authorization_request.add_scope(Scope::new("offline_access".to_string()));
    }
    for (key, value) in extra_query_params {
        authorization_request =
            authorization_request.add_extra_param((*key).to_string(), (*value).to_string());
    }
    let (auth_url, csrf_state, _nonce) = authorization_request.url();
    let external_auth_url = rewrite_to_external_endpoint(
        auth_url.as_str(),
        &state.env.authn_issuer_url,
        &state.env.authn_external_issuer_url,
    );
    let oauth_state = csrf_state.secret().to_string();
    save_pkce_verifier(oauth_state.clone(), pkce_verifier.secret().to_string()).await;

    Ok(OAuthUrlResponse {
        auth_url: external_auth_url,
        state: oauth_state,
    })
}

pub async fn exchange_code_for_token_common(
    state: &AppState,
    code: &str,
    oauth_state: Option<&str>,
) -> airborne_types::Result<TokenResponse> {
    let pkce_verifier = consume_pkce_verifier(oauth_state).await?;
    let oidc_data = fetch_oidc_data(&state.env, false).await?;
    let client = CoreClient::from_provider_metadata(
        oidc_data.provider_metadata,
        ClientId::new(state.env.authn_client_id.clone()),
        Some(ClientSecret::new(state.env.authn_client_secret.clone())),
    )
    .set_redirect_uri(oidc_redirect_url(state)?);

    let token_response = client
        .exchange_code(AuthorizationCode::new(code.to_string()))
        .map_err(|error| {
            map_configuration_error(
                "OIDC client is missing token endpoint for code exchange",
                error,
            )
        })?
        .set_pkce_verifier(PkceCodeVerifier::new(pkce_verifier))
        .request_async(oidc_http_client())
        .await
        .map_err(|error| ABError::Unauthorized(format!("Token exchange failed: {error}")))?;

    Ok(to_public_token_response(&token_response))
}

pub async fn password_login_common(
    state: &AppState,
    credentials: &UserCredentials,
    scope: Option<&str>,
) -> airborne_types::Result<UserToken> {
    let oidc_data = fetch_oidc_data(&state.env, false).await?;
    let client = CoreClient::from_provider_metadata(
        oidc_data.provider_metadata,
        ClientId::new(state.env.authn_client_id.clone()),
        Some(ClientSecret::new(state.env.authn_client_secret.clone())),
    )
    .set_redirect_uri(oidc_redirect_url(state)?);
    let username = ResourceOwnerUsername::new(credentials.name.clone());
    let password = ResourceOwnerPassword::new(credentials.password.clone());
    let mut token_request = client
        .exchange_password(&username, &password)
        .map_err(|error| {
            map_configuration_error(
                "OIDC client is missing token endpoint for password login",
                error,
            )
        })?;

    if let Some(scope) = scope {
        for single_scope in scope.split_whitespace() {
            token_request = token_request.add_scope(Scope::new(single_scope.to_string()));
        }
    }

    let token_response = token_request
        .request_async(oidc_http_client())
        .await
        .map_err(|error| {
            let error_text = error.to_string();
            let login_err = LoginFailure {
                error: "Authentication failed".to_string(),
                error_description: error_text,
            };
            ABError::Unauthorized(login_err.error_description)
        })?;

    to_user_token(&token_response)
}

pub async fn refresh_access_token_common(
    state: &AppState,
    refresh_token: &str,
) -> airborne_types::Result<UserToken> {
    let oidc_data = fetch_oidc_data(&state.env, false).await?;
    let client = CoreClient::from_provider_metadata(
        oidc_data.provider_metadata,
        ClientId::new(state.env.authn_client_id.clone()),
        Some(ClientSecret::new(state.env.authn_client_secret.clone())),
    )
    .set_redirect_uri(oidc_redirect_url(state)?);
    let refresh = RefreshToken::new(refresh_token.to_string());

    let token_response = client
        .exchange_refresh_token(&refresh)
        .map_err(|error| {
            map_configuration_error(
                "OIDC client is missing token endpoint for refresh token flow",
                error,
            )
        })?
        .request_async(oidc_http_client())
        .await
        .map_err(|error| {
            let error_text = error.to_string();
            let login_err = LoginFailure {
                error: "Unknown error".to_string(),
                error_description: error_text,
            };
            ABError::Unauthorized(login_err.error_description)
        })?;

    to_user_token(&token_response)
}

#[cfg(test)]
mod tests {
    use super::rewrite_to_external_endpoint;

    #[test]
    fn rewrites_authorization_endpoint_to_external_issuer() {
        let rewritten = rewrite_to_external_endpoint(
            "http://internal-idp/realms/demo/protocol/openid-connect/auth",
            "http://internal-idp/realms/demo",
            "https://public-idp.example.com/realms/demo",
        );
        assert_eq!(
            rewritten,
            "https://public-idp.example.com/realms/demo/protocol/openid-connect/auth"
        );
    }

    #[test]
    fn keeps_authorization_endpoint_when_prefix_does_not_match() {
        let endpoint = "https://accounts.example.com/oauth2/v1/authorize";
        let rewritten = rewrite_to_external_endpoint(
            endpoint,
            "http://internal-idp/realms/demo",
            "https://public-idp.example.com/realms/demo",
        );
        assert_eq!(rewritten, endpoint);
    }
}
