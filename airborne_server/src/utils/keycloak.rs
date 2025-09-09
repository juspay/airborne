use crate::{
    middleware::auth::AuthResponse,
    types as airborne_types,
    types::{ABError, AppState, Environment},
};
use actix_web::{web, HttpMessage, HttpRequest};
use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use keycloak::{
    self,
    types::{GroupRepresentation, UserRepresentation},
    KeycloakAdmin, KeycloakAdminToken, KeycloakServiceAccountAdminTokenRetriever,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Claims {
    pub sub: String,                        // User ID
    pub preferred_username: Option<String>, // Name
    pub email: Option<String>,
    pub realm_access: Option<Roles>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Roles {
    pub roles: Vec<String>, // Roles assigned to the user
}

pub async fn get_token(
    env: Environment,
    client: Client,
) -> airborne_types::Result<KeycloakAdminToken> {
    // Move ENVs to App State
    let url = env.keycloak_url.clone();
    let client_id = env.client_id.clone();
    let secret = env.secret.clone();
    let realm = env.realm.clone();

    // See if keycloak admin can be in app state as well
    let token_retriever = KeycloakServiceAccountAdminTokenRetriever::create_with_custom_realm(
        &client_id, &secret, &realm, client,
    );

    // Fetch client level admin token
    Ok(token_retriever.acquire(&url).await?)
}

pub fn decode_jwt_token(
    token: &str,
    public_key: &str,
    audience: &str,
) -> airborne_types::Result<TokenData<Claims>> {
    let key = DecodingKey::from_rsa_pem(public_key.as_bytes())?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[audience]);
    Ok(decode::<Claims>(token, &key, &validation)?)
}

pub async fn find_user_by_username(
    admin: &KeycloakAdmin,
    realm: &str,
    username: &str,
) -> airborne_types::Result<Option<UserRepresentation>> {
    let users = admin
        .realm_users_get(
            realm,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(username.to_string()),
        )
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to find user by username: {}", e))
        })?;

    if users.is_empty() {
        return Ok(None);
    }

    Ok(Some(users[0].clone()))
}

pub async fn prepare_user_action(
    req: &HttpRequest,
    state: web::Data<AppState>,
) -> airborne_types::Result<(KeycloakAdmin, String)> {
    let auth_response = req
        .extensions()
        .get::<AuthResponse>()
        .cloned()
        .ok_or(ABError::Unauthorized("Token Parse Failed".to_string()))?;

    let admin_token = auth_response.admin_token.clone();
    let client = reqwest::Client::new();
    let admin = KeycloakAdmin::new(&state.env.keycloak_url.clone(), admin_token, client);
    let realm = state.env.realm.clone();

    Ok((admin, realm))
}

pub async fn find_org_group(
    admin: &KeycloakAdmin,
    realm: &str,
    org_name: &str,
) -> airborne_types::Result<Option<GroupRepresentation>> {
    let groups = admin
        .realm_groups_get(
            realm,
            None,
            Some(true),
            None,
            None,
            None,
            None,
            Some(org_name.to_string()),
        )
        .await?;

    if groups.is_empty() {
        return Ok(None);
    }

    Ok(Some(groups[0].clone()))
}

pub async fn find_role_subgroup(
    admin: &KeycloakAdmin,
    realm: &str,
    group_id: &str,
    role: &str,
) -> airborne_types::Result<Option<GroupRepresentation>> {
    let subgroups = admin
        .realm_groups_with_group_id_children_get(realm, group_id, None, None, None, None, None)
        .await?;

    for group in subgroups {
        if let Some(name) = &group.name {
            if name == role {
                return Ok(Some(group));
            }
        }
    }

    Ok(None)
}
