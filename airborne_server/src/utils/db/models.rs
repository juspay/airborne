use chrono::{DateTime, Utc};
use diesel::deserialize::Queryable;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::utils::db::schema::hyperotaserver::{
    application_settings, builds, cleanup_outbox, configs, files, packages, packages_v2,
    release_views, releases, user_credentials, workspace_names,
};
use crate::utils::semver::SemVer;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct File {
    pub url: String,
    #[serde(alias = "filePath")]
    pub file_path: String,
}

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

#[derive(Queryable, Debug, Selectable, Serialize, Deserialize, Clone)]
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
}

#[derive(Insertable)]
#[diesel(table_name = builds)]
pub struct NewBuildEntry {
    pub build_version: SemVer,
    pub organisation: String,
    pub application: String,
    pub release_id: String,
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

#[derive(Queryable, Insertable, Debug, Selectable, Serialize)]
#[diesel(table_name = application_settings)]
pub struct ApplicationSettingsEntry {
    pub id: uuid::Uuid,
    pub version: i32,
    pub org_id: String,
    pub app_id: String,
    pub maven_namespace: String,
    pub maven_artifact_id: String,
    pub maven_group_id: String,
    pub created_at: DateTime<Utc>,
}

impl ApplicationSettingsEntry {
    pub fn default(org_id: &str, app_id: &str) -> Self {
        ApplicationSettingsEntry {
            id: uuid::Uuid::new_v4(),
            version: 0,
            org_id: org_id.to_string(),
            app_id: app_id.to_string(),
            maven_namespace: "hyper-sdk".to_string(),
            maven_artifact_id: "airborne-assets".to_string(),
            maven_group_id: format!("{}.{}", org_id, app_id),
            created_at: chrono::Utc::now(),
        }
    }
}
