use chrono::{DateTime, Utc};
use diesel::deserialize::Queryable;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::utils::db::schema::hyperotaserver::{
    authz_memberships, authz_role_bindings, builds, cleanup_outbox, configs, files, packages,
    packages_v2, release_views, releases, user_credentials, webhook_deliveries, webhooks,
    workspace_names,
};
use crate::utils::semver::SemVer;

#[derive(Insertable, Debug)]
#[diesel(table_name = packages)]
pub struct PackageEntry {
    pub version: i32,
    pub app_id: String,
    pub org_id: String,
    pub index: serde_json::Value,
    pub important: serde_json::Value,
    pub lazy: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub properties: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub resources: serde_json::Value,
}

#[derive(Queryable, Insertable, Debug, Selectable)]
#[diesel(table_name = configs)]
pub struct ConfigEntry {
    pub org_id: String,
    pub app_id: String,
    pub version: i32,
    pub config_version: String,
    pub release_config_timeout: i32,
    pub package_timeout: i32,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub tenant_info: serde_json::Value,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub properties: serde_json::Value,
}

#[derive(Queryable, Insertable, Debug)]
#[diesel(table_name = cleanup_outbox)]
pub struct CleanupOutboxEntry {
    pub transaction_id: String,
    pub entity_name: String,
    pub entity_type: String,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub state: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub attempts: i32,
    pub last_attempt: Option<DateTime<Utc>>,
}

#[derive(Queryable, Insertable, Debug, Selectable)]
#[diesel(table_name = releases)]
pub struct ReleaseEntry {
    pub id: uuid::Uuid,
    pub org_id: String,
    pub app_id: String,
    pub package_version: i32,
    pub config_version: String,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub metadata: serde_json::Value,
}

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = workspace_names)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct WorkspaceName {
    pub id: i32,
    pub organization_id: String,
    pub application_id: String,
    pub workspace_name: String,
    // pub created_at: DateTime<Utc>,
}

#[derive(Insertable, Selectable)]
#[diesel(table_name = workspace_names)]
pub struct NewWorkspaceName<'a> {
    pub organization_id: &'a str,
    pub application_id: &'a str,
    pub workspace_name: &'a str,
}

#[derive(Queryable, QueryableByName, Debug, Selectable, Serialize, Deserialize, Clone)]
#[diesel(table_name = files)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct FileEntry {
    pub id: uuid::Uuid,
    pub app_id: String,
    pub org_id: String,
    pub version: i32,
    pub tag: Option<String>,
    pub url: String,
    pub file_path: String,
    pub size: i64,
    pub checksum: String,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = files)]
pub struct NewFileEntry {
    pub app_id: String,
    pub org_id: String,
    pub version: i32,
    pub tag: Option<String>,
    pub url: String,
    pub file_path: String,
    pub size: i64,
    pub checksum: String,
    #[diesel(sql_type = diesel::sql_types::Jsonb)]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Queryable, Debug, Selectable, Serialize, Deserialize, Clone)]
#[diesel(table_name = packages_v2)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct PackageV2Entry {
    pub id: uuid::Uuid,
    pub index: String,
    pub app_id: String,
    pub org_id: String,
    pub version: i32,
    pub tag: Option<String>,
    pub files: Vec<Option<String>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = packages_v2)]
pub struct NewPackageV2Entry {
    pub index: String,
    pub app_id: String,
    pub org_id: String,
    pub version: i32,
    pub tag: Option<String>,
    pub files: Vec<Option<String>>,
}

#[derive(Queryable, Insertable, Debug, Selectable)]
#[diesel(table_name = release_views)]
pub struct ReleaseViewEntry {
    pub id: uuid::Uuid,
    pub app_id: String,
    pub org_id: String,
    pub name: String,
    pub dimensions: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Queryable, Insertable, Debug, Selectable)]
#[diesel(table_name = builds)]
pub struct BuildEntry {
    pub id: uuid::Uuid,
    pub build_version: SemVer,
    pub organisation: String,
    pub application: String,
    pub release_id: String,
    pub created_at: DateTime<Utc>,
    pub major_version: i32,
    pub minor_version: i32,
    pub patch_version: i32,
    pub status: String,
}

#[derive(Insertable)]
#[diesel(table_name = builds)]
pub struct NewBuildEntry {
    pub build_version: SemVer,
    pub organisation: String,
    pub application: String,
    pub release_id: String,
    pub major_version: i32,
    pub minor_version: i32,
    pub patch_version: i32,
    pub status: String,
}

#[derive(Queryable, Insertable, Debug, Selectable, Serialize)]
#[diesel(table_name = user_credentials)]
pub struct UserCredentialsEntry {
    pub client_id: uuid::Uuid,
    pub username: String,
    pub password: String,
    pub organisation: String,
    pub application: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Queryable, Insertable, Debug, Selectable, Clone)]
#[diesel(table_name = authz_memberships)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AuthzMembershipEntry {
    pub subject: String,
    pub scope: String,
    pub organisation: String,
    pub application: String,
    pub role_key: String,
    pub role_level: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = authz_memberships)]
pub struct NewAuthzMembershipEntry {
    pub subject: String,
    pub scope: String,
    pub organisation: String,
    pub application: String,
    pub role_key: String,
    pub role_level: i32,
}

#[derive(Queryable, Insertable, Debug, Selectable, Clone)]
#[diesel(table_name = authz_role_bindings)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AuthzRoleBindingEntry {
    pub scope: String,
    pub role_key: String,
    pub resource: String,
    pub action: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = authz_role_bindings)]
pub struct NewAuthzRoleBindingEntry {
    pub scope: String,
    pub role_key: String,
    pub resource: String,
    pub action: String,
}

// ---- Webhooks ----

/// A webhook configuration row. Not `Serialize` — it carries `secret_encrypted`,
/// which must never leak into an API response. Map to a response DTO instead.
#[derive(Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = webhooks)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct WebhookEntry {
    pub id: uuid::Uuid,
    // Selected by `as_select()` for table-completeness but never read in Rust: a webhook
    // is always queried already scoped by org, so this is not surfaced.
    #[allow(dead_code)]
    pub org_id: String,
    /// `None` => organisation-scoped (fires for every app in the org).
    pub app_id: Option<String>,
    pub name: String,
    pub description: String,
    pub url: String,
    pub method: String,
    pub events: serde_json::Value,
    pub secret_encrypted: Option<String>,
    pub custom_headers: serde_json::Value,
    pub enabled: bool,
    pub payload_version: String,
    pub max_retries: i32,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
}

#[derive(Insertable)]
#[diesel(table_name = webhooks)]
pub struct NewWebhookEntry {
    pub org_id: String,
    /// `None` => organisation-scoped.
    pub app_id: Option<String>,
    pub name: String,
    pub description: String,
    pub url: String,
    pub method: String,
    pub events: serde_json::Value,
    pub secret_encrypted: Option<String>,
    pub custom_headers: serde_json::Value,
    pub enabled: bool,
    pub payload_version: String,
    pub max_retries: i32,
    pub created_by: String,
    pub updated_by: String,
}

#[derive(AsChangeset, Default)]
#[diesel(table_name = webhooks)]
pub struct WebhookChangeset {
    pub description: Option<String>,
    pub url: Option<String>,
    pub method: Option<String>,
    pub events: Option<serde_json::Value>,
    pub custom_headers: Option<serde_json::Value>,
    pub enabled: Option<bool>,
    pub max_retries: Option<i32>,
    pub secret_encrypted: Option<Option<String>>,
    pub updated_by: Option<String>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Queryable, Selectable, Debug, Clone, Serialize)]
#[diesel(table_name = webhook_deliveries)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct WebhookDeliveryEntry {
    pub id: uuid::Uuid,
    pub webhook_id: uuid::Uuid,
    pub org_id: String,
    /// The app whose event triggered this delivery — not the webhook's scope. An
    /// org-scoped webhook's deliveries carry the triggering app here.
    pub app_id: Option<String>,
    pub event: String,
    pub payload: serde_json::Value,
    pub status: String,
    pub kronos_job_id: Option<String>,
    pub scheduled_for: DateTime<Utc>,
    pub attempt_count: i32,
    pub max_attempts: i32,
    pub last_status_code: Option<i32>,
    pub is_test: bool,
    pub idempotency_key: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Array of attempt objects (see `webhook::types::WebhookAttempt`).
    pub attempts: serde_json::Value,
}

#[derive(Insertable)]
#[diesel(table_name = webhook_deliveries)]
pub struct NewWebhookDeliveryEntry {
    pub id: uuid::Uuid,
    pub webhook_id: uuid::Uuid,
    pub org_id: String,
    pub app_id: Option<String>,
    pub event: String,
    pub payload: serde_json::Value,
    pub status: String,
    pub kronos_job_id: Option<String>,
    pub scheduled_for: DateTime<Utc>,
    pub max_attempts: i32,
    pub is_test: bool,
    pub idempotency_key: String,
}
