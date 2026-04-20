// @generated automatically by Diesel CLI.

pub mod hyperotaserver {
    pub mod sql_types {
        #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "invite_role", schema = "hyperotaserver"))]
        pub struct InviteRole;

        #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "invite_status", schema = "hyperotaserver"))]
        pub struct InviteStatus;
    }

    diesel::table! {
        hyperotaserver.application_settings (id) {
            id -> Uuid,
            version -> Int4,
            org_id -> Text,
            app_id -> Text,
            maven_namespace -> Text,
            maven_artifact_id -> Text,
            maven_group_id -> Text,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        hyperotaserver.builds (id) {
            id -> Uuid,
            build_version -> Text,
            organisation -> Text,
            application -> Text,
            release_id -> Text,
            created_at -> Timestamptz,
            major_version -> Int4,
            minor_version -> Int4,
            patch_version -> Int4,
            status -> Text,
        }
    }

    diesel::table! {
        hyperotaserver.cleanup_outbox (transaction_id) {
            transaction_id -> Text,
            entity_name -> Text,
            entity_type -> Text,
            state -> Jsonb,
            created_at -> Timestamptz,
            attempts -> Int4,
            last_attempt -> Nullable<Timestamptz>,
        }
    }

    diesel::table! {
        hyperotaserver.configs (id) {
            id -> Int4,
            org_id -> Text,
            app_id -> Text,
            version -> Int4,
            config_version -> Text,
            release_config_timeout -> Int4,
            package_timeout -> Int4,
            tenant_info -> Jsonb,
            properties -> Jsonb,
            created_at -> Timestamp,
        }
    }

    diesel::table! {
        hyperotaserver.files (id) {
            id -> Uuid,
            app_id -> Text,
            org_id -> Text,
            version -> Int4,
            tag -> Nullable<Text>,
            url -> Text,
            file_path -> Text,
            size -> Int8,
            checksum -> Text,
            metadata -> Jsonb,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::InviteRole;
        use super::sql_types::InviteStatus;

        hyperotaserver.organisation_invites (id) {
            id -> Uuid,
            org_id -> Text,
            applications -> Jsonb,
            email -> Text,
            role -> InviteRole,
            token -> Text,
            status -> InviteStatus,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        hyperotaserver.packages (id) {
            id -> Uuid,
            version -> Int4,
            app_id -> Text,
            org_id -> Text,
            index -> Jsonb,
            important -> Jsonb,
            lazy -> Jsonb,
            properties -> Jsonb,
            resources -> Jsonb,
        }
    }

    diesel::table! {
        hyperotaserver.packages_v2 (id) {
            id -> Uuid,
            version -> Int4,
            app_id -> Text,
            org_id -> Text,
            index -> Text,
            files -> Array<Nullable<Text>>,
            tag -> Nullable<Text>,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        hyperotaserver.release_views (id) {
            id -> Uuid,
            app_id -> Text,
            org_id -> Text,
            name -> Text,
            dimensions -> Jsonb,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        hyperotaserver.releases (id) {
            id -> Uuid,
            org_id -> Text,
            app_id -> Text,
            package_version -> Int4,
            config_version -> Text,
            created_at -> Timestamptz,
            created_by -> Text,
            metadata -> Jsonb,
        }
    }

    diesel::table! {
        hyperotaserver.user_credentials (client_id) {
            client_id -> Uuid,
            username -> Text,
            password -> Text,
            organisation -> Text,
            application -> Text,
            created_at -> Timestamptz,
        }
    }

    diesel::table! {
        hyperotaserver.workspace_names (id) {
            id -> Int4,
            organization_id -> Text,
            workspace_name -> Text,
            application_id -> Text,
        }
    }

    diesel::allow_tables_to_appear_in_same_query!(
        application_settings,
        builds,
        cleanup_outbox,
        configs,
        files,
        organisation_invites,
        packages,
        packages_v2,
        release_views,
        releases,
        user_credentials,
        workspace_names,
    );
}
