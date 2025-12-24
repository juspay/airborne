pub mod types;

use crate::{
    middleware::auth::{validate_user, Auth, AuthResponse, ADMIN, READ},
    run_blocking,
    token::types::*,
    types as airborne_types,
    types::{ABError, AppState, ListResponse},
    user::{login_implementation, types::User, types::UserCredentials},
    utils::{
        db::{
            models::UserCredentialsEntry,
            schema::hyperotaserver::user_credentials::{
                application as cred_app, client_id as uid, created_at, organisation as cred_org,
                table as user_credentials_table, username,
            },
        },
        encryption::{decrypt_string, encrypt_string, generate_random_key},
    },
};

use actix_web::{
    delete, get, post,
    web::{self, Json, ReqData},
    Scope,
};
use chrono::{DateTime, Utc};
use diesel::prelude::*;

pub fn add_scopes(path: &str) -> Scope {
    Scope::new(path).service(issue_token).service(
        Scope::new("")
            .wrap(Auth)
            .service(create_token)
            .service(list_tokens)
            .service(delete_token),
    )
}

#[post("")]
async fn create_token(
    req: Json<UserCredentials>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<Token>> {
    let key = generate_random_key().await?;
    let auth_response = auth_response.into_inner();

    if auth_response.username != req.name {
        return Err(ABError::Unauthorized("Username mismatch".to_string()));
    }

    let (org_name, app_name) = match validate_user(auth_response.organisation.clone(), ADMIN) {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), ADMIN)
                .map(|app_name| (org_name, app_name))
        }),
    }?;

    let url = state.env.keycloak_url.clone();
    let client_id = state.env.client_id.clone();
    let secret = state.env.secret.clone();
    let realm = state.env.realm.clone();
    let url = format!("{}/realms/{}/protocol/openid-connect/token", url, realm);
    let client = reqwest::Client::new();
    let params = [
        ("client_id", client_id),
        ("client_secret", secret),
        ("grant_type", "password".to_string()),
        ("username", req.name.clone()),
        ("password", req.password.clone()),
    ];

    let response = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))?;

    if response.status().is_success() {
        let client_uid = uuid::Uuid::new_v4();
        let encrypted_pass = encrypt_string(&req.password.clone(), &key).await?;

        let new_cred = UserCredentialsEntry {
            client_id: client_uid,
            username: req.name.clone(),
            password: encrypted_pass,
            organisation: org_name,
            application: app_name,
            created_at: Utc::now(),
        };
        let pool = state.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            diesel::insert_into(user_credentials_table)
                .values(&new_cred)
                .execute(&mut conn)
                .map_err(|e: diesel::result::Error| {
                    ABError::InternalServerError(format!("DB insert failed: {}", e))
                })?;
            Ok(())
        })?;

        Ok(Json(Token {
            client_id: client_uid,
            client_secret: key,
        }))
    } else {
        Err(ABError::Forbidden("Invalid Credentials".to_string()))
    }
}

#[delete("{client_id}")]
async fn delete_token(
    client_id: web::Path<uuid::Uuid>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<DeleteTokenResponse>> {
    let auth_response = auth_response.into_inner();
    let (_organisation, _application) =
        match validate_user(auth_response.organisation.clone(), ADMIN) {
            Ok(org_name) => auth_response
                .application
                .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
                .map(|access| (org_name, access.name)),
            Err(_) => {
                validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
                    validate_user(auth_response.application.clone(), ADMIN)
                        .map(|app_name| (org_name, app_name))
                })
            }
        }?;
    let pool = state.db_pool.clone();
    run_blocking!({
        let mut conn = pool.get()?;
        diesel::delete(user_credentials_table.filter(uid.eq(*client_id)))
            .execute(&mut conn)
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to delete user credentials: {}", e))
            })?;
        Ok(())
    })?;

    Ok(Json(DeleteTokenResponse { success: true }))
}

#[get("list")]
async fn list_tokens(
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<ListResponse<Vec<TokenListEntry>>>> {
    let auth_response = auth_response.into_inner();
    let (organisation, application) = match validate_user(auth_response.organisation.clone(), ADMIN)
    {
        Ok(org_name) => auth_response
            .application
            .ok_or_else(|| ABError::Forbidden("No Access".to_string()))
            .map(|access| (org_name, access.name)),
        Err(_) => validate_user(auth_response.organisation.clone(), READ).and_then(|org_name| {
            validate_user(auth_response.application.clone(), ADMIN)
                .map(|app_name| (org_name, app_name))
        }),
    }?;
    let pool = state.db_pool.clone();
    let result = run_blocking!({
        let mut conn = pool.get()?;
        let results = user_credentials_table
            .filter(
                username
                    .eq(&auth_response.username)
                    .and(cred_org.eq(organisation))
                    .and(cred_app.eq(application)),
            )
            .select((uid, created_at))
            .load::<(uuid::Uuid, DateTime<Utc>)>(&mut conn)
            .map_err(|e| ABError::InternalServerError(format!("DB fetch failed: {}", e)))?;
        Ok(results)
    })?;
    let tokens = result
        .into_iter()
        .map(|(id, created)| TokenListEntry {
            client_id: id,
            created_at: created,
        })
        .collect::<Vec<TokenListEntry>>();

    Ok(Json(ListResponse { data: tokens }))
}

#[post("issue")]
async fn issue_token(
    req: Json<Token>,
    state: web::Data<AppState>,
) -> airborne_types::Result<Json<User>> {
    let pool = state.db_pool.clone();
    let client_id = req.client_id;
    let user = run_blocking!({
        let mut conn = pool.get()?;
        let user = user_credentials_table
            .filter(uid.eq(&client_id))
            .first::<UserCredentialsEntry>(&mut conn)
            .map_err(|e| {
                ABError::InternalServerError(format!("Failed to load user credentials: {}", e))
            })?;
        Ok(user)
    })?;

    let decrypted_pass = decrypt_string(&user.password, &req.client_secret).await?;
    login_implementation(
        UserCredentials {
            name: user.username.clone(),
            password: decrypted_pass.clone(),
        },
        state,
    )
    .await
}
