use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
    time::Duration,
};

use async_trait::async_trait;
use casbin::{CoreApi, DefaultModel, Enforcer, MgmtApi};
use diesel::{
    pg::PgConnection,
    prelude::*,
    r2d2::{ConnectionManager, Pool},
    upsert::excluded,
};
use diesel_adapter::DieselAdapter;
use log::{debug, info, warn};
use tokio::{sync::RwLock, time::sleep};

use crate::{
    middleware::auth::{AccessLevel, ADMIN, OWNER, READ, WRITE},
    provider::authz::{
        permission::{scoped_permission, EndpointPermissionBinding},
        ApplicationAccessSummary, AuthZProvider, AuthzAccessContext, AuthzPermissionAttribute,
        AuthzPermissionCheck, AuthzRoleDefinition, AuthzUserInfo, OrganisationAccessSummary,
        UserAccessSummary,
    },
    run_blocking, types as airborne_types,
    types::{ABError, AppState, AuthzProviderKind},
    utils::db::{
        models::{AuthzMembershipEntry, AuthzRoleBindingEntry, NewAuthzMembershipEntry},
        schema::hyperotaserver::{authz_memberships, authz_role_bindings},
    },
};

const POLICY_SCOPE_SYSTEM: &str = "system";
const POLICY_SCOPE_ORG: &str = "org";
const POLICY_SCOPE_APP: &str = "app";

const ROLE_SUPER_ADMIN: &str = "super_admin";
const ROLE_OWNER: &str = "owner";
const ROLE_ADMIN: &str = "admin";
const ROLE_WRITE: &str = "write";
const ROLE_READ: &str = "read";
const MAX_AUTHZ_BATCH_PREALLOC: usize = 1024;

const CASBIN_MODEL: &str = r#"
[request_definition]
r = sub, scope, org, app, act

[policy_definition]
p = sub, scope, org, app, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && (p.scope == "system" || r.scope == p.scope) && (p.org == "*" || r.org == p.org) && (p.app == "*" || r.app == p.app) && (r.act == p.act || g(p.act, r.act))
"#;

#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct PolicyEntry {
    pub subject: String,
    pub scope: String,
    pub organisation: String,
    pub application: String,
    pub action: String,
}

impl PolicyEntry {
    fn as_vec(&self) -> Vec<String> {
        vec![
            self.subject.clone(),
            self.scope.clone(),
            self.organisation.clone(),
            self.application.clone(),
            self.action.clone(),
        ]
    }
}

pub struct CasbinAuthzProvider {
    enforcer: Arc<RwLock<Enforcer>>,
    bootstrap_super_admins: Vec<String>,
    db_pool: Pool<ConnectionManager<PgConnection>>,
}

impl CasbinAuthzProvider {
    pub async fn new(
        bootstrap_super_admins: Vec<String>,
        db_pool: Pool<ConnectionManager<PgConnection>>,
        auto_load_secs: Option<u64>,
    ) -> airborne_types::Result<Self> {
        let model = DefaultModel::from_str(CASBIN_MODEL)
            .await
            .map_err(|error| {
                ABError::InternalServerError(format!("Failed to load Casbin model: {error}"))
            })?;
        let adapter = DieselAdapter::with_pool(db_pool.clone()).map_err(|error| {
            ABError::InternalServerError(format!(
                "Failed to create Casbin PostgreSQL adapter: {error}"
            ))
        })?;
        let mut enforcer = Enforcer::new(model, adapter).await.map_err(|error| {
            ABError::InternalServerError(format!("Failed to initialize Casbin enforcer: {error}"))
        })?;
        enforcer.enable_auto_save(true);
        ensure_role_hierarchy(&mut enforcer).await?;

        let enforcer = Arc::new(RwLock::new(enforcer));
        if let Some(reload_secs) = auto_load_secs.filter(|value| *value > 0) {
            let enforcer_for_task = Arc::clone(&enforcer);
            tokio::spawn(async move {
                let interval = Duration::from_secs(reload_secs);
                loop {
                    sleep(interval).await;
                    let mut guard = enforcer_for_task.write().await;
                    if let Err(error) = guard.load_policy().await {
                        warn!("Failed to reload Casbin policy from DB: {}", error);
                    }
                }
            });
        }

        Ok(Self {
            enforcer,
            bootstrap_super_admins: normalize_subjects(bootstrap_super_admins)?,
            db_pool,
        })
    }

    pub async fn import_policy_entries(
        &self,
        entries: &[PolicyEntry],
        apply: bool,
    ) -> airborne_types::Result<usize> {
        let mut collapsed: BTreeMap<(String, String, String, String), String> = BTreeMap::new();
        for entry in entries {
            let normalized = normalize_policy_entry(entry)?;
            let key = (
                normalized.subject,
                normalized.scope,
                normalized.organisation,
                normalized.application,
            );
            let existing = collapsed.get(&key).cloned();
            if existing
                .as_ref()
                .and_then(|role| role_level(role))
                .unwrap_or_default()
                < role_level(&normalized.action).unwrap_or_default()
            {
                collapsed.insert(key, normalized.action);
            }
        }
        let normalized = collapsed
            .into_iter()
            .map(
                |((subject, scope, organisation, application), action)| PolicyEntry {
                    subject,
                    scope,
                    organisation,
                    application,
                    action,
                },
            )
            .collect::<BTreeSet<_>>();
        if !apply {
            return Ok(normalized.len());
        }
        let mut guard = self.enforcer.write().await;
        let mut applied = 0usize;
        for entry in normalized {
            let added = guard.add_policy(entry.as_vec()).await.map_err(|error| {
                ABError::InternalServerError(format!("Failed to import policy: {error}"))
            })?;
            if added {
                applied += 1;
            }
        }
        Ok(applied)
    }

    async fn has_super_admin_role(&self, subject: &str) -> airborne_types::Result<bool> {
        let normalized_subject = normalize_subject(subject)?;
        let guard = self.enforcer.read().await;
        guard
            .enforce((
                normalized_subject.as_str(),
                POLICY_SCOPE_SYSTEM,
                "*",
                "*",
                ROLE_SUPER_ADMIN,
            ))
            .map_err(|error| {
                ABError::InternalServerError(format!(
                    "Failed to evaluate super-admin policy: {error}"
                ))
            })
    }

    async fn highest_org_access_level(
        &self,
        subject: &str,
        organisation: &str,
    ) -> airborne_types::Result<Option<u8>> {
        self.highest_membership_level(subject, POLICY_SCOPE_ORG, organisation, None)
            .await
    }

    async fn highest_app_access_level(
        &self,
        subject: &str,
        organisation: &str,
        application: &str,
    ) -> airborne_types::Result<Option<u8>> {
        self.highest_membership_level(subject, POLICY_SCOPE_APP, organisation, Some(application))
            .await
    }

    async fn list_org_apps(&self, organisation: &str) -> Vec<String> {
        let policies = self
            .list_memberships(POLICY_SCOPE_APP, organisation, None)
            .await
            .unwrap_or_default();
        let mut apps = BTreeSet::new();
        for policy in policies {
            if !policy.application.is_empty() {
                apps.insert(policy.application);
            }
        }
        apps.into_iter().collect()
    }

    async fn list_org_admin_owner_subjects(&self, organisation: &str) -> Vec<String> {
        let policies = self
            .list_memberships(POLICY_SCOPE_ORG, organisation, None)
            .await
            .unwrap_or_default();
        let mut subjects = BTreeSet::new();
        for policy in policies {
            if canonical_system_role(&policy.role_key).as_deref() == Some(ROLE_ADMIN)
                || canonical_system_role(&policy.role_key).as_deref() == Some(ROLE_OWNER)
            {
                subjects.insert(policy.subject);
            }
        }
        subjects.into_iter().collect()
    }

    async fn upsert_membership(
        &self,
        subject: &str,
        scope: &str,
        organisation: &str,
        application: &str,
        role_key: &str,
    ) -> airborne_types::Result<()> {
        let normalized_subject = normalize_subject(subject)?;
        let normalized_role = role_key.trim().to_ascii_lowercase();
        let scope = scope.to_string();
        let organisation = organisation.to_string();
        let application = application.to_string();
        let role_level = i32::from(role_level(&normalized_role).unwrap_or_default());
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            diesel::insert_into(authz_memberships::table)
                .values(NewAuthzMembershipEntry {
                    subject: normalized_subject.clone(),
                    scope: scope.clone(),
                    organisation: organisation.clone(),
                    application: application.clone(),
                    role_key: normalized_role.clone(),
                    role_level,
                })
                .on_conflict((
                    authz_memberships::subject,
                    authz_memberships::scope,
                    authz_memberships::organisation,
                    authz_memberships::application,
                ))
                .do_update()
                .set((
                    authz_memberships::role_key.eq(excluded(authz_memberships::role_key)),
                    authz_memberships::role_level.eq(excluded(authz_memberships::role_level)),
                    authz_memberships::updated_at.eq(diesel::dsl::now),
                ))
                .execute(&mut conn)?;
            Ok(())
        })?;
        Ok(())
    }

    async fn remove_membership(
        &self,
        subject: &str,
        scope: &str,
        organisation: &str,
        application: &str,
    ) -> airborne_types::Result<()> {
        let normalized_subject = normalize_subject(subject)?;
        let scope = scope.to_string();
        let organisation = organisation.to_string();
        let application = application.to_string();
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            diesel::delete(
                authz_memberships::table
                    .filter(authz_memberships::subject.eq(&normalized_subject))
                    .filter(authz_memberships::scope.eq(&scope))
                    .filter(authz_memberships::organisation.eq(&organisation))
                    .filter(authz_memberships::application.eq(&application)),
            )
            .execute(&mut conn)?;
            Ok(())
        })?;
        Ok(())
    }

    async fn remove_memberships_for_subject_org(
        &self,
        subject: &str,
        organisation: &str,
    ) -> airborne_types::Result<()> {
        let normalized_subject = normalize_subject(subject)?;
        let organisation = organisation.to_string();
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            diesel::delete(
                authz_memberships::table
                    .filter(authz_memberships::subject.eq(&normalized_subject))
                    .filter(authz_memberships::organisation.eq(&organisation)),
            )
            .execute(&mut conn)?;
            Ok(())
        })?;
        Ok(())
    }

    async fn remove_memberships_for_org(&self, organisation: &str) -> airborne_types::Result<()> {
        let organisation = organisation.to_string();
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            diesel::delete(
                authz_memberships::table.filter(authz_memberships::organisation.eq(&organisation)),
            )
            .execute(&mut conn)?;
            Ok(())
        })?;
        Ok(())
    }

    async fn highest_membership_level(
        &self,
        subject: &str,
        scope: &str,
        organisation: &str,
        application: Option<&str>,
    ) -> airborne_types::Result<Option<u8>> {
        let normalized_subject = normalize_subject(subject)?;
        let scope = scope.to_string();
        let organisation = organisation.to_string();
        let application = application.unwrap_or("*").to_string();
        let pool = self.db_pool.clone();
        let level = run_blocking!({
            let mut conn = pool.get()?;
            let result = authz_memberships::table
                .filter(authz_memberships::subject.eq(&normalized_subject))
                .filter(authz_memberships::scope.eq(&scope))
                .filter(authz_memberships::organisation.eq(&organisation))
                .filter(authz_memberships::application.eq(&application))
                .select(authz_memberships::role_level)
                .first::<i32>(&mut conn)
                .optional()?;
            Ok(result)
        })?;
        Ok(level.map(|value| value as u8))
    }

    async fn highest_role_for_membership(
        &self,
        subject: &str,
        scope: &str,
        organisation: &str,
        application: Option<&str>,
    ) -> airborne_types::Result<Option<String>> {
        let normalized_subject = normalize_subject(subject)?;
        let scope = scope.to_string();
        let organisation = organisation.to_string();
        let application = application.unwrap_or("*").to_string();
        let pool = self.db_pool.clone();
        let role = run_blocking!({
            let mut conn = pool.get()?;
            let result = authz_memberships::table
                .filter(authz_memberships::subject.eq(&normalized_subject))
                .filter(authz_memberships::scope.eq(&scope))
                .filter(authz_memberships::organisation.eq(&organisation))
                .filter(authz_memberships::application.eq(&application))
                .select(authz_memberships::role_key)
                .first::<String>(&mut conn)
                .optional()?;
            Ok(result)
        })?;
        Ok(role)
    }

    async fn list_memberships(
        &self,
        scope: &str,
        organisation: &str,
        application: Option<&str>,
    ) -> airborne_types::Result<Vec<AuthzMembershipEntry>> {
        let scope = scope.to_string();
        let organisation = organisation.to_string();
        let application = application.unwrap_or("*").to_string();
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            let mut query = authz_memberships::table
                .filter(authz_memberships::scope.eq(&scope))
                .filter(authz_memberships::organisation.eq(&organisation))
                .into_boxed();
            if application != "*" {
                query = query.filter(authz_memberships::application.eq(&application));
            }
            let rows = query
                .select(AuthzMembershipEntry::as_select())
                .load(&mut conn)?;
            Ok(rows)
        })
    }

    async fn list_subject_memberships(
        &self,
        subject: &str,
    ) -> airborne_types::Result<Vec<AuthzMembershipEntry>> {
        let normalized_subject = normalize_subject(subject)?;
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            let rows = authz_memberships::table
                .filter(authz_memberships::subject.eq(normalized_subject))
                .select(AuthzMembershipEntry::as_select())
                .load(&mut conn)?;
            Ok(rows)
        })
    }

    async fn seed_endpoint_permission_bindings(&self) -> airborne_types::Result<()> {
        let mut inventory_bindings = BTreeSet::new();
        for binding in inventory::iter::<EndpointPermissionBinding> {
            let _ = (
                binding.method,
                binding.path,
                binding.allow_app,
                binding.allow_org,
            );
            for role in binding.org_roles {
                inventory_bindings.insert((
                    POLICY_SCOPE_ORG.to_string(),
                    role.trim().to_ascii_lowercase(),
                    binding.resource.to_string(),
                    binding.action.to_string(),
                ));
            }
            for role in binding.app_roles {
                inventory_bindings.insert((
                    POLICY_SCOPE_APP.to_string(),
                    role.trim().to_ascii_lowercase(),
                    binding.resource.to_string(),
                    binding.action.to_string(),
                ));
            }
        }

        let pool = self.db_pool.clone();
        let inventory_bindings_vec = inventory_bindings.iter().cloned().collect::<Vec<_>>();
        let role_bindings = run_blocking!({
            let mut conn = pool.get()?;
            for (scope, role_key, resource, action) in &inventory_bindings_vec {
                diesel::insert_into(authz_role_bindings::table)
                    .values((
                        authz_role_bindings::scope.eq(scope),
                        authz_role_bindings::role_key.eq(role_key),
                        authz_role_bindings::resource.eq(resource),
                        authz_role_bindings::action.eq(action),
                    ))
                    .on_conflict_do_nothing()
                    .execute(&mut conn)?;
            }
            let rows = authz_role_bindings::table
                .select(AuthzRoleBindingEntry::as_select())
                .load::<AuthzRoleBindingEntry>(&mut conn)?;
            Ok(rows)
        })?;

        let mut guard = self.enforcer.write().await;
        for binding in role_bindings {
            let permission = scoped_permission(&binding.scope, &binding.resource, &binding.action);
            let _ = guard
                .add_grouping_policy(vec![binding.role_key, permission])
                .await
                .map_err(|error| {
                    ABError::InternalServerError(format!(
                        "Failed to persist role-permission grouping policy: {error}"
                    ))
                })?;
        }
        Ok(())
    }

    async fn refresh_membership_cache_from_casbin(&self) -> airborne_types::Result<()> {
        let policies = {
            let guard = self.enforcer.read().await;
            guard.get_filtered_policy(1, vec![])
        };

        let mut rows: Vec<NewAuthzMembershipEntry> = Vec::new();
        for policy in policies {
            if policy.len() < 5 {
                continue;
            }
            let scope = policy[1].clone();
            if scope != POLICY_SCOPE_ORG && scope != POLICY_SCOPE_APP {
                continue;
            }
            rows.push(NewAuthzMembershipEntry {
                subject: policy[0].clone(),
                scope,
                organisation: policy[2].clone(),
                application: policy[3].clone(),
                role_key: policy[4].clone(),
                role_level: i32::from(role_level(&policy[4]).unwrap_or_default()),
            });
        }

        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            diesel::delete(authz_memberships::table).execute(&mut conn)?;
            for row in &rows {
                diesel::insert_into(authz_memberships::table)
                    .values(row)
                    .on_conflict_do_nothing()
                    .execute(&mut conn)?;
            }
            Ok(())
        })?;
        Ok(())
    }

    async fn organisation_user_role(
        &self,
        subject: &str,
        organisation: &str,
    ) -> airborne_types::Result<Option<String>> {
        self.highest_role_for_membership(subject, POLICY_SCOPE_ORG, organisation, None)
            .await
    }

    async fn application_user_role(
        &self,
        subject: &str,
        organisation: &str,
        application: &str,
    ) -> airborne_types::Result<Option<String>> {
        self.highest_role_for_membership(subject, POLICY_SCOPE_APP, organisation, Some(application))
            .await
    }

    async fn ensure_organisation_exists(&self, organisation: &str) -> airborne_types::Result<()> {
        let exists = self.organisation_exists_inner(organisation).await?;
        if exists {
            Ok(())
        } else {
            Err(ABError::NotFound(format!(
                "Organisation not found: {}",
                organisation
            )))
        }
    }

    async fn remove_policies_for_filter(
        &self,
        field_index: usize,
        field_values: Vec<String>,
    ) -> airborne_types::Result<usize> {
        let mut guard = self.enforcer.write().await;
        Self::remove_policies_for_filter_in_guard(&mut guard, field_index, field_values).await
    }

    async fn remove_policies_for_filter_in_guard(
        guard: &mut Enforcer,
        field_index: usize,
        field_values: Vec<String>,
    ) -> airborne_types::Result<usize> {
        let existing = guard.get_filtered_policy(field_index, field_values);
        if existing.is_empty() {
            return Ok(0);
        }

        // Remove by exact filtered rule so duplicate rows in backing DB are deleted in one call.
        // remove_policies() is strict (expects exactly one row per rule) and can rollback when duplicates exist.
        let unique_existing = existing.into_iter().collect::<BTreeSet<_>>();
        let existing_count = unique_existing.len();
        for rule in unique_existing {
            guard
                .remove_filtered_policy(0, rule)
                .await
                .map_err(|error| {
                    ABError::InternalServerError(format!(
                        "Failed to remove existing policies: {error}"
                    ))
                })?;
        }

        Ok(existing_count)
    }

    async fn ensure_application_exists(
        &self,
        organisation: &str,
        application: &str,
    ) -> airborne_types::Result<()> {
        let exists = !self
            .list_memberships(POLICY_SCOPE_APP, organisation, Some(application))
            .await?
            .is_empty();
        if !exists {
            Err(ABError::NotFound(format!(
                "Application not found: {}",
                application
            )))
        } else {
            Ok(())
        }
    }

    async fn organisation_exists_inner(&self, organisation: &str) -> airborne_types::Result<bool> {
        let org_policies = self
            .list_memberships(POLICY_SCOPE_ORG, organisation, None)
            .await?;
        if !org_policies.is_empty() {
            return Ok(true);
        }
        let app_policies = self
            .list_memberships(POLICY_SCOPE_APP, organisation, None)
            .await?;
        Ok(!app_policies.is_empty())
    }

    async fn set_org_role(
        &self,
        subject: &str,
        organisation: &str,
        role: &str,
    ) -> airborne_types::Result<()> {
        let normalized_subject = normalize_subject(subject)?;
        let normalized_role = validate_org_role(role)?;
        let mut guard = self.enforcer.write().await;
        Self::remove_policies_for_filter_in_guard(
            &mut guard,
            0,
            vec![
                normalized_subject.clone(),
                POLICY_SCOPE_ORG.to_string(),
                organisation.to_string(),
            ],
        )
        .await?;
        let _ = guard
            .add_policy(
                PolicyEntry {
                    subject: normalized_subject.clone(),
                    scope: POLICY_SCOPE_ORG.to_string(),
                    organisation: organisation.to_string(),
                    application: "*".to_string(),
                    action: normalized_role.clone(),
                }
                .as_vec(),
            )
            .await
            .map_err(|error| {
                ABError::InternalServerError(format!(
                    "Failed to add organization role policy: {error}"
                ))
            })?;
        self.upsert_membership(
            &normalized_subject,
            POLICY_SCOPE_ORG,
            organisation,
            "*",
            &normalized_role,
        )
        .await?;
        Ok(())
    }

    async fn set_application_role(
        &self,
        subject: &str,
        organisation: &str,
        application: &str,
        role: &str,
    ) -> airborne_types::Result<()> {
        let normalized_subject = normalize_subject(subject)?;
        let normalized_role = validate_app_role(role)?;
        let mut guard = self.enforcer.write().await;
        Self::remove_policies_for_filter_in_guard(
            &mut guard,
            0,
            vec![
                normalized_subject.clone(),
                POLICY_SCOPE_APP.to_string(),
                organisation.to_string(),
                application.to_string(),
            ],
        )
        .await?;
        let _ = guard
            .add_policy(
                PolicyEntry {
                    subject: normalized_subject.clone(),
                    scope: POLICY_SCOPE_APP.to_string(),
                    organisation: organisation.to_string(),
                    application: application.to_string(),
                    action: normalized_role.clone(),
                }
                .as_vec(),
            )
            .await
            .map_err(|error| {
                ABError::InternalServerError(format!(
                    "Failed to add application role policy: {error}"
                ))
            })?;
        self.upsert_membership(
            &normalized_subject,
            POLICY_SCOPE_APP,
            organisation,
            application,
            &normalized_role,
        )
        .await?;
        Ok(())
    }

    async fn grant_application_role_if_missing(
        &self,
        subject: &str,
        organisation: &str,
        application: &str,
        role: &str,
    ) -> airborne_types::Result<()> {
        let normalized_subject = normalize_subject(subject)?;
        let normalized_role = validate_app_role(role)?;
        let current_level = self
            .highest_app_access_level(&normalized_subject, organisation, application)
            .await?
            .unwrap_or_default();
        let desired_level = role_level(&normalized_role).unwrap_or_default();
        if current_level < desired_level {
            self.set_application_role(
                &normalized_subject,
                organisation,
                application,
                &normalized_role,
            )
            .await?;
        }
        Ok(())
    }

    async fn grant_admin_on_all_org_apps(
        &self,
        subject: &str,
        organisation: &str,
    ) -> airborne_types::Result<()> {
        for app in self.list_org_apps(organisation).await {
            self.grant_application_role_if_missing(subject, organisation, &app, ROLE_ADMIN)
                .await?;
        }
        Ok(())
    }

    async fn remove_organisation_membership(
        &self,
        subject: &str,
        organisation: &str,
    ) -> airborne_types::Result<()> {
        let normalized_subject = normalize_subject(subject)?;
        self.remove_policies_for_filter(
            0,
            vec![
                normalized_subject.clone(),
                POLICY_SCOPE_ORG.to_string(),
                organisation.to_string(),
            ],
        )
        .await?;
        self.remove_policies_for_filter(
            0,
            vec![
                normalized_subject.clone(),
                POLICY_SCOPE_APP.to_string(),
                organisation.to_string(),
            ],
        )
        .await?;
        self.remove_memberships_for_subject_org(&normalized_subject, organisation)
            .await?;
        Ok(())
    }

    async fn ensure_requester_can_modify_org_member(
        &self,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()> {
        if self.has_super_admin_role(actor_subject).await? {
            return Ok(());
        }
        let actor_level = self
            .highest_org_access_level(actor_subject, organisation)
            .await?
            .unwrap_or_default();
        let target_level = self
            .highest_org_access_level(target_subject, organisation)
            .await?
            .unwrap_or_default();

        if actor_level == 0 {
            return Err(ABError::Forbidden("No organisation access".to_string()));
        }
        if actor_subject != target_subject && target_level > actor_level {
            return Err(ABError::Forbidden(
                "Cannot modify users with higher access levels".to_string(),
            ));
        }
        Ok(())
    }

    async fn ensure_requester_can_modify_app_member(
        &self,
        actor_subject: &str,
        organisation: &str,
        application: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()> {
        if self.has_super_admin_role(actor_subject).await? {
            return Ok(());
        }
        let actor_level = self
            .highest_app_access_level(actor_subject, organisation, application)
            .await?
            .unwrap_or_default();
        let target_level = self
            .highest_app_access_level(target_subject, organisation, application)
            .await?
            .unwrap_or_default();

        if actor_level == 0 {
            return Err(ABError::Forbidden("No application access".to_string()));
        }
        if actor_subject != target_subject && target_level > actor_level {
            return Err(ABError::Forbidden(
                "Cannot modify users with higher access levels".to_string(),
            ));
        }
        Ok(())
    }

    async fn org_owner_count(&self, organisation: &str) -> usize {
        let policies = self
            .list_memberships(POLICY_SCOPE_ORG, organisation, None)
            .await
            .unwrap_or_default();
        let mut owners = BTreeSet::new();
        for policy in policies {
            if canonical_system_role(&policy.role_key).as_deref() == Some(ROLE_OWNER) {
                owners.insert(policy.subject);
            }
        }
        owners.len()
    }

    async fn app_admin_count(&self, organisation: &str, application: &str) -> usize {
        let policies = self
            .list_memberships(POLICY_SCOPE_APP, organisation, Some(application))
            .await
            .unwrap_or_default();
        let mut admins = BTreeSet::new();
        for policy in policies {
            if canonical_system_role(&policy.role_key).as_deref() == Some(ROLE_ADMIN) {
                admins.insert(policy.subject);
            }
        }
        admins.len()
    }

    async fn list_role_bindings(
        &self,
        scope: &str,
    ) -> airborne_types::Result<Vec<AuthzRoleBindingEntry>> {
        let scope = scope.to_string();
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            let rows = authz_role_bindings::table
                .filter(authz_role_bindings::scope.eq(scope))
                .select(AuthzRoleBindingEntry::as_select())
                .load::<AuthzRoleBindingEntry>(&mut conn)?;
            Ok(rows)
        })
    }

    async fn ensure_actor_can_manage_org_roles(
        &self,
        actor_subject: &str,
        organisation: &str,
    ) -> airborne_types::Result<()> {
        if self.has_super_admin_role(actor_subject).await? {
            return Ok(());
        }
        let actor_level = self
            .highest_org_access_level(actor_subject, organisation)
            .await?
            .unwrap_or_default();
        if actor_level >= ADMIN.access {
            Ok(())
        } else {
            Err(ABError::Forbidden(
                "Only organisation admin or owner can manage organisation roles".to_string(),
            ))
        }
    }

    async fn ensure_actor_can_manage_app_roles(
        &self,
        actor_subject: &str,
        organisation: &str,
        application: &str,
    ) -> airborne_types::Result<()> {
        if self.has_super_admin_role(actor_subject).await? {
            return Ok(());
        }
        let org_level = self
            .highest_org_access_level(actor_subject, organisation)
            .await?
            .unwrap_or_default();
        if org_level >= ADMIN.access {
            return Ok(());
        }
        let app_level = self
            .highest_app_access_level(actor_subject, organisation, application)
            .await?
            .unwrap_or_default();
        if app_level >= ADMIN.access {
            Ok(())
        } else {
            Err(ABError::Forbidden(
                "Only application admin (or organisation admin/owner) can manage application roles"
                    .to_string(),
            ))
        }
    }

    async fn can_manage_role_permissions(
        &self,
        actor_subject: &str,
        organisation: &str,
        application: Option<&str>,
        resource: &str,
        is_super_admin: bool,
    ) -> airborne_types::Result<bool> {
        if is_super_admin {
            return Ok(true);
        }

        let org_level = self
            .highest_org_access_level(actor_subject, organisation)
            .await?
            .unwrap_or_default();
        if org_level >= ADMIN.access {
            return Ok(true);
        }

        if resource == "application_role" {
            if let Some(app_name) = application {
                let app_level = self
                    .highest_app_access_level(actor_subject, organisation, app_name)
                    .await?
                    .unwrap_or_default();
                return Ok(app_level >= ADMIN.access);
            }
        }

        Ok(false)
    }

    async fn upsert_role_bindings(
        &self,
        scope: &str,
        role_key: &str,
        permissions: &[AuthzPermissionAttribute],
    ) -> airborne_types::Result<()> {
        let scope_name = scope.to_string();
        let role_name = role_key.to_string();
        let permissions_for_db = permissions.to_vec();
        let scope_name_for_db = scope_name.clone();
        let role_name_for_db = role_name.clone();
        let pool = self.db_pool.clone();
        run_blocking!({
            let mut conn = pool.get()?;
            diesel::delete(
                authz_role_bindings::table
                    .filter(authz_role_bindings::scope.eq(&scope_name_for_db))
                    .filter(authz_role_bindings::role_key.eq(&role_name_for_db)),
            )
            .execute(&mut conn)?;

            for permission in &permissions_for_db {
                diesel::insert_into(authz_role_bindings::table)
                    .values((
                        authz_role_bindings::scope.eq(&scope_name_for_db),
                        authz_role_bindings::role_key.eq(&role_name_for_db),
                        authz_role_bindings::resource.eq(&permission.resource),
                        authz_role_bindings::action.eq(&permission.action),
                    ))
                    .execute(&mut conn)?;
            }
            Ok(())
        })?;

        // Keep in-memory Casbin grouping policies in sync immediately.
        let mut guard = self.enforcer.write().await;
        let existing = guard.get_filtered_named_grouping_policy("g", 0, vec![role_name.clone()]);
        for row in existing {
            let _ = guard.remove_grouping_policy(row).await.map_err(|error| {
                ABError::InternalServerError(format!(
                    "Failed to remove existing role-permission grouping policy: {error}"
                ))
            })?;
        }

        for permission in permissions {
            let key = scoped_permission(&scope_name, &permission.resource, &permission.action);
            let _ = guard
                .add_grouping_policy(vec![role_name.clone(), key])
                .await
                .map_err(|error| {
                    ABError::InternalServerError(format!(
                        "Failed to persist role-permission grouping policy: {error}"
                    ))
                })?;
        }

        Ok(())
    }
}

#[async_trait]
impl AuthZProvider for CasbinAuthzProvider {
    fn kind(&self) -> AuthzProviderKind {
        AuthzProviderKind::Casbin
    }

    async fn bootstrap(&self, _state: &AppState) -> airborne_types::Result<()> {
        {
            let mut guard = self.enforcer.write().await;
            ensure_role_hierarchy(&mut guard).await?;
        }
        if !self.bootstrap_super_admins.is_empty() {
            let mut guard = self.enforcer.write().await;
            for subject in &self.bootstrap_super_admins {
                let entry = PolicyEntry {
                    subject: subject.clone(),
                    scope: POLICY_SCOPE_SYSTEM.to_string(),
                    organisation: "*".to_string(),
                    application: "*".to_string(),
                    action: ROLE_SUPER_ADMIN.to_string(),
                };
                let added = guard.add_policy(entry.as_vec()).await.map_err(|error| {
                    ABError::InternalServerError(format!(
                        "Failed to persist bootstrap super-admin policy: {error}"
                    ))
                })?;
                if added {
                    info!("Bootstrapped AuthZ super-admin subject: {}", subject);
                }
            }
        }
        self.seed_endpoint_permission_bindings().await?;
        self.refresh_membership_cache_from_casbin().await?;
        Ok(())
    }

    async fn access_for_request(
        &self,
        _state: &AppState,
        subject: &str,
        organisation: Option<&str>,
        application: Option<&str>,
    ) -> airborne_types::Result<AuthzAccessContext> {
        let normalized_subject = normalize_subject(subject)?;
        let is_super_admin = self.has_super_admin_role(&normalized_subject).await?;

        let mut org_access = None;
        let mut app_access = None;

        if let Some(org_name) = organisation {
            if is_super_admin {
                org_access = Some(AccessLevel {
                    name: org_name.to_string(),
                    level: OWNER.access,
                });
            } else if let Some(level) = self
                .highest_org_access_level(&normalized_subject, org_name)
                .await?
            {
                org_access = Some(AccessLevel {
                    name: org_name.to_string(),
                    level,
                });
            }
        }

        if let (Some(org_name), Some(app_name)) = (organisation, application) {
            if is_super_admin {
                app_access = Some(AccessLevel {
                    name: app_name.to_string(),
                    level: OWNER.access,
                });
            } else if let Some(level) = self
                .highest_app_access_level(&normalized_subject, org_name, app_name)
                .await?
            {
                app_access = Some(AccessLevel {
                    name: app_name.to_string(),
                    level,
                });
            }
        }

        Ok(AuthzAccessContext {
            organisation: org_access,
            application: app_access,
            is_super_admin,
        })
    }

    async fn get_user_access_summary(
        &self,
        _state: &AppState,
        subject: &str,
    ) -> airborne_types::Result<UserAccessSummary> {
        let normalized_subject = normalize_subject(subject)?;
        let policies = self.list_subject_memberships(&normalized_subject).await?;

        let mut org_roles: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        let mut app_roles: BTreeMap<(String, String), BTreeSet<String>> = BTreeMap::new();

        for policy in policies {
            match policy.scope.as_str() {
                POLICY_SCOPE_ORG => {
                    org_roles
                        .entry(policy.organisation)
                        .or_default()
                        .insert(policy.role_key);
                }
                POLICY_SCOPE_APP => {
                    app_roles
                        .entry((policy.organisation, policy.application))
                        .or_default()
                        .insert(policy.role_key);
                }
                _ => {}
            }
        }

        let is_super_admin = self.has_super_admin_role(&normalized_subject).await?;

        let mut organisations = Vec::new();
        for (org_name, roles) in org_roles {
            let mut applications = Vec::new();
            for ((app_org, app_name), app_role_set) in &app_roles {
                if app_org == &org_name {
                    let app_access = highest_role_from_set(app_role_set)
                        .map(|role| app_role_display_expansion(&role))
                        .unwrap_or_default();
                    applications.push(ApplicationAccessSummary {
                        organisation: app_org.clone(),
                        application: app_name.clone(),
                        access: app_access,
                    });
                }
            }
            applications.sort_by(|left, right| left.application.cmp(&right.application));

            let org_access = highest_role_from_set(&roles)
                .map(|role| org_role_display_expansion(&role))
                .unwrap_or_default();

            organisations.push(OrganisationAccessSummary {
                name: org_name,
                access: org_access,
                applications,
            });
        }

        Ok(UserAccessSummary {
            subject: normalized_subject,
            is_super_admin,
            organisations,
        })
    }

    async fn organisation_exists(
        &self,
        _state: &AppState,
        organisation: &str,
    ) -> airborne_types::Result<bool> {
        self.organisation_exists_inner(organisation).await
    }

    async fn create_organisation(
        &self,
        _state: &AppState,
        organisation: &str,
        owner_subject: &str,
    ) -> airborne_types::Result<()> {
        if self.organisation_exists_inner(organisation).await? {
            return Err(ABError::BadRequest(
                "Organisation name is taken".to_string(),
            ));
        }
        self.set_org_role(owner_subject, organisation, ROLE_OWNER)
            .await
    }

    async fn delete_organisation(
        &self,
        _state: &AppState,
        organisation: &str,
    ) -> airborne_types::Result<()> {
        self.ensure_organisation_exists(organisation).await?;
        self.remove_policies_for_filter(
            1,
            vec![POLICY_SCOPE_ORG.to_string(), organisation.to_string()],
        )
        .await?;
        self.remove_policies_for_filter(
            1,
            vec![POLICY_SCOPE_APP.to_string(), organisation.to_string()],
        )
        .await?;
        self.remove_memberships_for_org(organisation).await?;
        Ok(())
    }

    async fn create_application(
        &self,
        _state: &AppState,
        organisation: &str,
        application: &str,
        creator_subject: &str,
    ) -> airborne_types::Result<()> {
        self.ensure_organisation_exists(organisation).await?;
        {
            let guard = self.enforcer.read().await;
            let existing = guard.get_filtered_policy(
                1,
                vec![
                    POLICY_SCOPE_APP.to_string(),
                    organisation.to_string(),
                    application.to_string(),
                ],
            );
            if !existing.is_empty() {
                return Err(ABError::BadRequest(format!(
                    "Application '{}' already exists in organisation '{}'",
                    application, organisation
                )));
            }
        }
        self.set_application_role(creator_subject, organisation, application, ROLE_ADMIN)
            .await?;
        for subject in self.list_org_admin_owner_subjects(organisation).await {
            self.set_application_role(&subject, organisation, application, ROLE_ADMIN)
                .await?;
        }
        Ok(())
    }

    async fn list_organisation_users(
        &self,
        _state: &AppState,
        organisation: &str,
    ) -> airborne_types::Result<Vec<AuthzUserInfo>> {
        let policies = self
            .list_memberships(POLICY_SCOPE_ORG, organisation, None)
            .await?;

        let mut users: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for policy in policies {
            users
                .entry(policy.subject)
                .or_default()
                .insert(policy.role_key);
        }

        let mut response = Vec::new();
        for (subject, role_set) in users {
            let roles = highest_role_from_set(&role_set)
                .map(|role| org_role_display_expansion(&role))
                .unwrap_or_default();
            response.push(AuthzUserInfo {
                username: subject.clone(),
                email: Some(subject),
                roles,
            });
        }
        Ok(response)
    }

    async fn add_organisation_user(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let normalized_target = normalize_subject(target_subject)?;
        let normalized_role = validate_org_role(role)?;
        self.ensure_organisation_exists(organisation).await?;
        self.ensure_requester_can_modify_org_member(
            &normalized_actor,
            organisation,
            &normalized_target,
        )
        .await?;

        let actor_is_super_admin = self.has_super_admin_role(&normalized_actor).await?;
        if !actor_is_super_admin {
            let actor_level = self
                .highest_org_access_level(&normalized_actor, organisation)
                .await?
                .unwrap_or_default();
            if canonical_system_role(&normalized_role).is_none() && actor_level < ADMIN.access {
                return Err(ABError::Forbidden(
                    "Only organisation admin or owner can assign custom organisation roles"
                        .to_string(),
                ));
            }
            let requested_level = role_level(&normalized_role).unwrap_or_default();
            if requested_level > actor_level {
                return Err(ABError::Forbidden(
                    "Cannot assign a role higher than your own organisation access level"
                        .to_string(),
                ));
            }
        }

        self.set_org_role(&normalized_target, organisation, &normalized_role)
            .await?;

        if matches!(normalized_role.as_str(), ROLE_ADMIN | ROLE_OWNER) {
            self.grant_admin_on_all_org_apps(&normalized_target, organisation)
                .await?;
        }

        Ok(())
    }

    async fn update_organisation_user(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let normalized_target = normalize_subject(target_subject)?;
        let normalized_role = validate_org_role(role)?;
        self.ensure_organisation_exists(organisation).await?;
        self.ensure_requester_can_modify_org_member(
            &normalized_actor,
            organisation,
            &normalized_target,
        )
        .await?;

        let actor_is_super_admin = self.has_super_admin_role(&normalized_actor).await?;
        if !actor_is_super_admin {
            let actor_level = self
                .highest_org_access_level(&normalized_actor, organisation)
                .await?
                .unwrap_or_default();
            if canonical_system_role(&normalized_role).is_none() && actor_level < ADMIN.access {
                return Err(ABError::Forbidden(
                    "Only organisation admin or owner can assign custom organisation roles"
                        .to_string(),
                ));
            }
            let requested_level = role_level(&normalized_role).unwrap_or_default();
            if requested_level > actor_level {
                return Err(ABError::Forbidden(
                    "Cannot assign a role higher than your own organisation access level"
                        .to_string(),
                ));
            }
        }

        let current_role = self
            .organisation_user_role(&normalized_target, organisation)
            .await?
            .ok_or_else(|| {
                ABError::BadRequest(format!(
                    "User is not a member of any role in organization {}",
                    organisation
                ))
            })?;

        if current_role == ROLE_OWNER
            && normalized_role != ROLE_OWNER
            && self.org_owner_count(organisation).await <= 1
        {
            return Err(ABError::BadRequest(
                "Cannot modify the last owner. Add another owner first.".to_string(),
            ));
        }

        self.set_org_role(&normalized_target, organisation, &normalized_role)
            .await?;

        if matches!(normalized_role.as_str(), ROLE_ADMIN | ROLE_OWNER) {
            self.grant_admin_on_all_org_apps(&normalized_target, organisation)
                .await?;
        }
        Ok(())
    }

    async fn remove_organisation_user(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let normalized_target = normalize_subject(target_subject)?;
        self.ensure_organisation_exists(organisation).await?;
        self.ensure_requester_can_modify_org_member(
            &normalized_actor,
            organisation,
            &normalized_target,
        )
        .await?;

        let current_role = self
            .organisation_user_role(&normalized_target, organisation)
            .await?
            .ok_or_else(|| {
                ABError::BadRequest(format!(
                    "User is not a member of any role in organization {}",
                    organisation
                ))
            })?;

        if current_role == ROLE_OWNER && self.org_owner_count(organisation).await <= 1 {
            return Err(ABError::BadRequest(
                "Cannot remove the last owner from the organization".to_string(),
            ));
        }

        self.remove_organisation_membership(&normalized_target, organisation)
            .await
    }

    async fn transfer_organisation_ownership(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let normalized_target = normalize_subject(target_subject)?;
        if normalized_actor == normalized_target {
            return Err(ABError::BadRequest(
                "Cannot transfer ownership to yourself".to_string(),
            ));
        }
        self.ensure_organisation_exists(organisation).await?;
        self.ensure_requester_can_modify_org_member(
            &normalized_actor,
            organisation,
            &normalized_target,
        )
        .await?;

        let actor_is_super_admin = self.has_super_admin_role(&normalized_actor).await?;
        let actor_role = self
            .organisation_user_role(&normalized_actor, organisation)
            .await?
            .unwrap_or_default();
        if !actor_is_super_admin && actor_role != ROLE_OWNER {
            return Err(ABError::Forbidden(
                "Ownership transfer requires owner role".to_string(),
            ));
        }

        let target_current_role = self
            .organisation_user_role(&normalized_target, organisation)
            .await?
            .ok_or_else(|| {
                ABError::BadRequest(format!(
                    "User is not a member of any role in organization {}",
                    organisation
                ))
            })?;
        debug!(
            "Transferring ownership in org {} from {} to {} (target current role: {})",
            organisation, normalized_actor, normalized_target, target_current_role
        );

        self.set_org_role(&normalized_target, organisation, ROLE_OWNER)
            .await?;
        if actor_role == ROLE_OWNER {
            self.set_org_role(&normalized_actor, organisation, ROLE_ADMIN)
                .await?;
        }
        self.grant_admin_on_all_org_apps(&normalized_target, organisation)
            .await?;
        if actor_role == ROLE_OWNER {
            self.grant_admin_on_all_org_apps(&normalized_actor, organisation)
                .await?;
        }
        Ok(())
    }

    async fn list_application_users(
        &self,
        _state: &AppState,
        organisation: &str,
        application: &str,
    ) -> airborne_types::Result<Vec<AuthzUserInfo>> {
        self.ensure_application_exists(organisation, application)
            .await?;
        let policies = self
            .list_memberships(POLICY_SCOPE_APP, organisation, Some(application))
            .await?;

        let mut users: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for policy in policies {
            users
                .entry(policy.subject)
                .or_default()
                .insert(policy.role_key);
        }

        let mut response = Vec::new();
        for (subject, role_set) in users {
            let roles = highest_role_from_set(&role_set)
                .map(|role| app_role_display_expansion(&role))
                .unwrap_or_default();
            response.push(AuthzUserInfo {
                username: subject.clone(),
                email: Some(subject),
                roles,
            });
        }
        Ok(response)
    }

    async fn add_application_user(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let normalized_target = normalize_subject(target_subject)?;
        let normalized_role = validate_app_role(role)?;
        self.ensure_application_exists(organisation, application)
            .await?;
        self.ensure_requester_can_modify_app_member(
            &normalized_actor,
            organisation,
            application,
            &normalized_target,
        )
        .await?;

        let target_org_level = self
            .highest_org_access_level(&normalized_target, organisation)
            .await?
            .unwrap_or_default();
        if target_org_level == 0 {
            return Err(ABError::BadRequest("User not found in org".to_string()));
        }

        let actor_is_super_admin = self.has_super_admin_role(&normalized_actor).await?;
        if !actor_is_super_admin {
            let actor_level = self
                .highest_app_access_level(&normalized_actor, organisation, application)
                .await?
                .unwrap_or_default();
            if canonical_system_role(&normalized_role).is_none() && actor_level < ADMIN.access {
                return Err(ABError::Forbidden(
                    "Only application admin (or organisation admin/owner) can assign custom application roles"
                        .to_string(),
                ));
            }
            let requested_level = role_level(&normalized_role).unwrap_or_default();
            if requested_level > actor_level {
                return Err(ABError::Forbidden(
                    "Cannot assign a role higher than your own application access level"
                        .to_string(),
                ));
            }
        }

        self.set_application_role(
            &normalized_target,
            organisation,
            application,
            &normalized_role,
        )
        .await
    }

    async fn update_application_user(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: &str,
        target_subject: &str,
        role: &str,
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let normalized_target = normalize_subject(target_subject)?;
        let normalized_role = validate_app_role(role)?;
        self.ensure_application_exists(organisation, application)
            .await?;
        self.ensure_requester_can_modify_app_member(
            &normalized_actor,
            organisation,
            application,
            &normalized_target,
        )
        .await?;

        let actor_is_super_admin = self.has_super_admin_role(&normalized_actor).await?;
        if !actor_is_super_admin {
            let actor_level = self
                .highest_app_access_level(&normalized_actor, organisation, application)
                .await?
                .unwrap_or_default();
            if canonical_system_role(&normalized_role).is_none() && actor_level < ADMIN.access {
                return Err(ABError::Forbidden(
                    "Only application admin (or organisation admin/owner) can assign custom application roles"
                        .to_string(),
                ));
            }
            let requested_level = role_level(&normalized_role).unwrap_or_default();
            if requested_level > actor_level {
                return Err(ABError::Forbidden(
                    "Cannot assign a role higher than your own application access level"
                        .to_string(),
                ));
            }
        }

        let current_role = self
            .application_user_role(&normalized_target, organisation, application)
            .await?
            .ok_or_else(|| {
                ABError::BadRequest(format!(
                    "User has no role in application {}/{}",
                    organisation, application
                ))
            })?;

        if current_role == ROLE_ADMIN
            && normalized_role != ROLE_ADMIN
            && self.app_admin_count(organisation, application).await <= 1
        {
            let target_org_level = self
                .highest_org_access_level(&normalized_target, organisation)
                .await?
                .unwrap_or_default();
            if target_org_level < ADMIN.access {
                return Err(ABError::BadRequest(
                    "Cannot demote the last admin from the application. Applications must have at least one admin."
                        .to_string(),
                ));
            }
        }

        self.set_application_role(
            &normalized_target,
            organisation,
            application,
            &normalized_role,
        )
        .await
    }

    async fn remove_application_user(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: &str,
        target_subject: &str,
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let normalized_target = normalize_subject(target_subject)?;
        self.ensure_application_exists(organisation, application)
            .await?;
        self.ensure_requester_can_modify_app_member(
            &normalized_actor,
            organisation,
            application,
            &normalized_target,
        )
        .await?;

        let current_role = self
            .application_user_role(&normalized_target, organisation, application)
            .await?
            .ok_or_else(|| {
                ABError::BadRequest(format!(
                    "User has no role in application {}/{}",
                    organisation, application
                ))
            })?;
        if current_role == ROLE_ADMIN && self.app_admin_count(organisation, application).await <= 1
        {
            return Err(ABError::BadRequest(
                "Cannot remove the last admin from the application. Applications must have at least one admin.".to_string(),
            ));
        }

        self.remove_policies_for_filter(
            0,
            vec![
                normalized_target.clone(),
                POLICY_SCOPE_APP.to_string(),
                organisation.to_string(),
                application.to_string(),
            ],
        )
        .await?;
        self.remove_membership(
            &normalized_target,
            POLICY_SCOPE_APP,
            organisation,
            application,
        )
        .await?;
        Ok(())
    }

    async fn list_role_definitions(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: Option<&str>,
    ) -> airborne_types::Result<Vec<AuthzRoleDefinition>> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let scope = if let Some(app_name) = application {
            self.ensure_application_exists(organisation, app_name)
                .await?;
            self.ensure_actor_can_manage_app_roles(&normalized_actor, organisation, app_name)
                .await?;
            POLICY_SCOPE_APP
        } else {
            self.ensure_organisation_exists(organisation).await?;
            self.ensure_actor_can_manage_org_roles(&normalized_actor, organisation)
                .await?;
            POLICY_SCOPE_ORG
        };

        let bindings = self.list_role_bindings(scope).await?;
        let mut role_map: BTreeMap<String, Vec<AuthzPermissionAttribute>> = BTreeMap::new();
        for binding in bindings {
            if canonical_system_role(&binding.role_key).is_none()
                && is_reserved_role_management_permission(&binding.resource)
            {
                continue;
            }
            let permission = AuthzPermissionAttribute {
                key: format!("{}.{}", binding.resource, binding.action),
                resource: binding.resource,
                action: binding.action,
            };
            role_map
                .entry(binding.role_key)
                .or_default()
                .push(permission);
        }

        let default_roles: Vec<&str> = if scope == POLICY_SCOPE_ORG {
            vec![ROLE_OWNER, ROLE_ADMIN, ROLE_WRITE, ROLE_READ]
        } else {
            vec![ROLE_ADMIN, ROLE_WRITE, ROLE_READ]
        };
        for role in default_roles {
            role_map.entry(role.to_string()).or_default();
        }

        let mut roles = role_map
            .into_iter()
            .map(|(role, mut permissions)| {
                permissions.sort_by(|left, right| left.key.cmp(&right.key));
                permissions.dedup_by(|left, right| left.key == right.key);
                AuthzRoleDefinition {
                    is_system: canonical_system_role(&role).is_some(),
                    role,
                    permissions,
                }
            })
            .collect::<Vec<_>>();

        roles.sort_by(|left, right| {
            let left_key = role_sort_key(&left.role);
            let right_key = role_sort_key(&right.role);
            left_key
                .cmp(&right_key)
                .then_with(|| left.role.cmp(&right.role))
        });
        Ok(roles)
    }

    async fn list_available_permissions(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: Option<&str>,
    ) -> airborne_types::Result<Vec<AuthzPermissionAttribute>> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let scope = if let Some(app_name) = application {
            self.ensure_application_exists(organisation, app_name)
                .await?;
            self.ensure_actor_can_manage_app_roles(&normalized_actor, organisation, app_name)
                .await?;
            POLICY_SCOPE_APP
        } else {
            self.ensure_organisation_exists(organisation).await?;
            self.ensure_actor_can_manage_org_roles(&normalized_actor, organisation)
                .await?;
            POLICY_SCOPE_ORG
        };

        let bindings = self.list_role_bindings(scope).await?;
        let mut unique = BTreeSet::new();
        let mut permissions = Vec::new();
        for binding in bindings {
            if canonical_system_role(&binding.role_key).is_none() {
                continue;
            }
            if is_reserved_role_management_permission(&binding.resource) {
                continue;
            }
            let key = format!("{}.{}", binding.resource, binding.action);
            if unique.insert(key.clone()) {
                permissions.push(AuthzPermissionAttribute {
                    key,
                    resource: binding.resource,
                    action: binding.action,
                });
            }
        }
        permissions.sort_by(|left, right| left.key.cmp(&right.key));
        Ok(permissions)
    }

    async fn upsert_custom_role(
        &self,
        _state: &AppState,
        actor_subject: &str,
        organisation: &str,
        application: Option<&str>,
        role: &str,
        permissions: &[String],
    ) -> airborne_types::Result<()> {
        let normalized_actor = normalize_subject(actor_subject)?;
        let scope = if let Some(app_name) = application {
            self.ensure_application_exists(organisation, app_name)
                .await?;
            self.ensure_actor_can_manage_app_roles(&normalized_actor, organisation, app_name)
                .await?;
            POLICY_SCOPE_APP
        } else {
            self.ensure_organisation_exists(organisation).await?;
            self.ensure_actor_can_manage_org_roles(&normalized_actor, organisation)
                .await?;
            POLICY_SCOPE_ORG
        };

        let normalized_role = if scope == POLICY_SCOPE_APP {
            validate_app_role(role)?
        } else {
            validate_org_role(role)?
        };

        if canonical_system_role(&normalized_role).is_some() {
            return Err(ABError::BadRequest(
                "System roles cannot be modified as custom roles".to_string(),
            ));
        }

        if permissions.is_empty() {
            return Err(ABError::BadRequest(
                "Custom role must include at least one permission".to_string(),
            ));
        }

        let available_permissions = self
            .list_available_permissions(_state, &normalized_actor, organisation, application)
            .await?;
        let available_keys = available_permissions
            .iter()
            .map(|permission| permission.key.clone())
            .collect::<BTreeSet<_>>();

        let mut parsed_permissions = Vec::new();
        let mut unique_permissions = BTreeSet::new();
        for requested in permissions {
            let (resource, action) = parse_permission_key(requested)?;
            if is_reserved_role_management_permission(&resource) {
                return Err(ABError::BadRequest(format!(
                    "Permission '{}.{}' is reserved for system role management and cannot be assigned to custom roles",
                    resource, action
                )));
            }
            let key = format!("{}.{}", resource, action);
            if !available_keys.contains(&key) {
                return Err(ABError::BadRequest(format!(
                    "Unknown permission '{}'. Use one from /permissions/list",
                    key
                )));
            }
            if unique_permissions.insert(key.clone()) {
                parsed_permissions.push(AuthzPermissionAttribute {
                    key,
                    resource,
                    action,
                });
            }
        }

        self.upsert_role_bindings(scope, &normalized_role, &parsed_permissions)
            .await
    }

    async fn enforce_permissions_batch(
        &self,
        _state: &AppState,
        subject: &str,
        checks: &[AuthzPermissionCheck],
    ) -> airborne_types::Result<Vec<bool>> {
        if checks.is_empty() {
            return Ok(Vec::new());
        }

        let normalized_subject = normalize_subject(subject)?;
        let is_super_admin = self.has_super_admin_role(&normalized_subject).await?;
        let guard = self.enforcer.read().await;
        let mut decisions = Vec::with_capacity(checks.len().min(MAX_AUTHZ_BATCH_PREALLOC));

        for check in checks {
            if is_reserved_role_management_permission(&check.resource) {
                let allowed = self
                    .can_manage_role_permissions(
                        &normalized_subject,
                        &check.organisation,
                        check.application.as_deref(),
                        &check.resource,
                        is_super_admin,
                    )
                    .await?;
                decisions.push(allowed);
                continue;
            }

            let scope = if check.application.is_some() {
                POLICY_SCOPE_APP
            } else {
                POLICY_SCOPE_ORG
            };
            let app = check.application.as_deref().unwrap_or("*");
            let permission = scoped_permission(scope, &check.resource, &check.action);
            let allowed = guard
                .enforce((
                    normalized_subject.clone(),
                    scope,
                    check.organisation.as_str(),
                    app,
                    permission,
                ))
                .map_err(|error| {
                    ABError::InternalServerError(format!(
                        "Failed to evaluate permission policy: {error}"
                    ))
                })?;
            decisions.push(allowed);
        }

        Ok(decisions)
    }

    async fn enforce_permission(
        &self,
        _state: &AppState,
        subject: &str,
        organisation: &str,
        application: Option<&str>,
        resource: &str,
        action: &str,
    ) -> airborne_types::Result<bool> {
        let normalized_subject = normalize_subject(subject)?;
        let is_super_admin = self.has_super_admin_role(&normalized_subject).await?;
        if is_reserved_role_management_permission(resource) {
            return self
                .can_manage_role_permissions(
                    &normalized_subject,
                    organisation,
                    application,
                    resource,
                    is_super_admin,
                )
                .await;
        }

        let scope = if application.is_some() {
            POLICY_SCOPE_APP
        } else {
            POLICY_SCOPE_ORG
        };
        let app = application.unwrap_or("*");
        let permission = scoped_permission(scope, resource, action);

        let guard = self.enforcer.read().await;
        guard
            .enforce((normalized_subject, scope, organisation, app, permission))
            .map_err(|error| {
                ABError::InternalServerError(format!(
                    "Failed to evaluate permission policy: {error}"
                ))
            })
    }
}

async fn ensure_role_hierarchy(enforcer: &mut Enforcer) -> airborne_types::Result<()> {
    let role_hierarchy = [
        (ROLE_SUPER_ADMIN, ROLE_OWNER),
        (ROLE_OWNER, ROLE_ADMIN),
        (ROLE_ADMIN, ROLE_WRITE),
        (ROLE_WRITE, ROLE_READ),
    ];

    for (parent, child) in role_hierarchy {
        let _ = enforcer
            .add_grouping_policy(vec![parent.to_string(), child.to_string()])
            .await
            .map_err(|error| {
                ABError::InternalServerError(format!(
                    "Failed to persist Casbin role hierarchy policy: {error}"
                ))
            })?;
    }
    Ok(())
}

fn normalize_subject(subject: &str) -> airborne_types::Result<String> {
    let normalized = subject.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        Err(ABError::BadRequest(
            "Authorization subject cannot be empty".to_string(),
        ))
    } else {
        Ok(normalized)
    }
}

fn normalize_subjects(subjects: Vec<String>) -> airborne_types::Result<Vec<String>> {
    let mut values = BTreeSet::new();
    for subject in subjects {
        values.insert(normalize_subject(&subject)?);
    }
    Ok(values.into_iter().collect())
}

fn normalize_policy_entry(entry: &PolicyEntry) -> airborne_types::Result<PolicyEntry> {
    let scope = entry.scope.trim().to_ascii_lowercase();
    let mut normalized = PolicyEntry {
        subject: normalize_subject(&entry.subject)?,
        scope: scope.clone(),
        organisation: entry.organisation.trim().to_string(),
        application: entry.application.trim().to_string(),
        action: entry.action.trim().to_ascii_lowercase(),
    };

    match scope.as_str() {
        POLICY_SCOPE_SYSTEM => {
            if normalized.action != ROLE_SUPER_ADMIN {
                return Err(ABError::BadRequest(format!(
                    "Invalid system role '{}'. Only '{}' is allowed",
                    normalized.action, ROLE_SUPER_ADMIN
                )));
            }
            normalized.organisation = "*".to_string();
            normalized.application = "*".to_string();
        }
        POLICY_SCOPE_ORG => {
            normalized.action = validate_org_role(&normalized.action)?;
            if normalized.organisation.is_empty() {
                return Err(ABError::BadRequest(
                    "Organisation cannot be empty for org-scope policy".to_string(),
                ));
            }
            normalized.application = "*".to_string();
        }
        POLICY_SCOPE_APP => {
            normalized.action = validate_app_role(&normalized.action)?;
            if normalized.organisation.is_empty() || normalized.application.is_empty() {
                return Err(ABError::BadRequest(
                    "Organisation/application cannot be empty for app-scope policy".to_string(),
                ));
            }
        }
        _ => {
            return Err(ABError::BadRequest(format!(
                "Invalid policy scope '{}'",
                scope
            )));
        }
    }

    Ok(normalized)
}

fn validate_org_role(role: &str) -> airborne_types::Result<String> {
    let normalized = role.trim().to_ascii_lowercase();
    match normalized.as_str() {
        ROLE_OWNER | ROLE_ADMIN | ROLE_WRITE | ROLE_READ => Ok(normalized),
        _ if is_valid_custom_role_name(&normalized) => Ok(normalized),
        _ => Err(ABError::BadRequest(format!(
            "Invalid access level '{}'. Custom role keys may only contain a-z and _",
            role
        ))),
    }
}

fn validate_app_role(role: &str) -> airborne_types::Result<String> {
    let normalized = role.trim().to_ascii_lowercase();
    match normalized.as_str() {
        ROLE_ADMIN | ROLE_WRITE | ROLE_READ => Ok(normalized),
        _ if is_valid_custom_role_name(&normalized) => Ok(normalized),
        _ => Err(ABError::BadRequest(format!(
            "Invalid access level '{}'. Applications only support: read, write, admin; custom role keys may only contain a-z and _",
            role
        ))),
    }
}

fn role_level(role: &str) -> Option<u8> {
    match canonical_system_role(role).as_deref() {
        Some(ROLE_SUPER_ADMIN) => Some(5),
        Some(ROLE_OWNER) => Some(OWNER.access),
        Some(ROLE_ADMIN) => Some(ADMIN.access),
        Some(ROLE_WRITE) => Some(WRITE.access),
        Some(ROLE_READ) => Some(READ.access),
        _ => None,
    }
}

fn canonical_system_role(role_key: &str) -> Option<String> {
    let normalized = role_key.trim().to_ascii_lowercase();
    let suffix = normalized.rsplit(':').next().unwrap_or("");
    let value = if matches!(
        normalized.as_str(),
        ROLE_SUPER_ADMIN | ROLE_OWNER | ROLE_ADMIN | ROLE_WRITE | ROLE_READ
    ) {
        normalized.as_str()
    } else if matches!(
        suffix,
        ROLE_SUPER_ADMIN | ROLE_OWNER | ROLE_ADMIN | ROLE_WRITE | ROLE_READ
    ) {
        suffix
    } else {
        return None;
    };
    Some(value.to_string())
}

fn is_valid_custom_role_name(role: &str) -> bool {
    !role.is_empty()
        && role.len() <= 64
        && role.chars().all(|ch| ch.is_ascii_lowercase() || ch == '_')
}

fn highest_role_from_set(roles: &BTreeSet<String>) -> Option<String> {
    let mut best: Option<String> = None;
    let mut best_level = 0;

    for role in roles {
        if let Some(level) = role_level(role) {
            if level > best_level {
                best_level = level;
                best = Some(role.clone());
            }
        }
    }

    best.or_else(|| roles.iter().next().cloned())
}

fn parse_permission_key(permission: &str) -> airborne_types::Result<(String, String)> {
    let normalized = permission.trim().to_ascii_lowercase();
    let mut parts = normalized.split('.');
    let resource = parts.next().unwrap_or_default().trim().to_string();
    let action = parts.next().unwrap_or_default().trim().to_string();
    let has_extra = parts.next().is_some();

    if resource.is_empty() || action.is_empty() || has_extra {
        return Err(ABError::BadRequest(format!(
            "Invalid permission '{}'. Expected format: resource.action",
            permission
        )));
    }

    if !resource
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
        || !action
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
    {
        return Err(ABError::BadRequest(format!(
            "Invalid permission '{}'. Resource/action must be lowercase slug values",
            permission
        )));
    }

    Ok((resource, action))
}

fn is_reserved_role_management_permission(resource: &str) -> bool {
    matches!(resource, "organisation_role" | "application_role")
}

fn org_role_display_expansion(role: &str) -> Vec<String> {
    let canonical = canonical_system_role(role);
    let mut roles = match canonical.as_deref().unwrap_or(role) {
        ROLE_OWNER => vec![
            ROLE_OWNER.to_string(),
            ROLE_ADMIN.to_string(),
            ROLE_WRITE.to_string(),
            ROLE_READ.to_string(),
        ],
        ROLE_ADMIN => vec![
            ROLE_ADMIN.to_string(),
            ROLE_WRITE.to_string(),
            ROLE_READ.to_string(),
        ],
        ROLE_WRITE => vec![ROLE_WRITE.to_string(), ROLE_READ.to_string()],
        ROLE_READ => vec![ROLE_READ.to_string()],
        _ => vec![role.to_string()],
    };
    sort_roles(&mut roles);
    roles
}

fn app_role_display_expansion(role: &str) -> Vec<String> {
    let canonical = canonical_system_role(role);
    let mut roles = match canonical.as_deref().unwrap_or(role) {
        ROLE_ADMIN => vec![
            ROLE_ADMIN.to_string(),
            ROLE_WRITE.to_string(),
            ROLE_READ.to_string(),
        ],
        ROLE_WRITE => vec![ROLE_WRITE.to_string(), ROLE_READ.to_string()],
        ROLE_READ => vec![ROLE_READ.to_string()],
        _ => vec![role.to_string()],
    };
    sort_roles(&mut roles);
    roles
}

fn role_sort_key(role: &str) -> u8 {
    match role {
        ROLE_OWNER => 0,
        ROLE_ADMIN => 1,
        ROLE_WRITE => 2,
        ROLE_READ => 3,
        ROLE_SUPER_ADMIN => 4,
        _ => 5,
    }
}

fn sort_roles(roles: &mut [String]) {
    roles.sort_by_key(|left| role_sort_key(left));
}
