// @generated automatically by Diesel CLI.

pub mod hyperotaserver {
    diesel::table! {
        hyperotaserver.authz_memberships (subject, scope, organisation, application) {
            subject -> Text,
            scope -> Text,
            organisation -> Text,
            application -> Text,
            role_key -> Text,
            role_level -> Int4,
            updated_at -> Timestamptz,
        }
    }

    diesel::table! {
        hyperotaserver.authz_role_bindings (scope, role_key, resource, action) {
            scope -> Text,
            role_key -> Text,
            resource -> Text,
            action -> Text,
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
        hyperotaserver.service_accounts (client_id) {
            client_id -> Uuid,
            name -> Text,
            email -> Text,
            description -> Text,
            organisation -> Text,
            created_by -> Text,
            created_at -> Timestamptz,
            encrypted_refresh_token -> Text,
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
        hyperotaserver.webhook_deliveries (id) {
            id -> Uuid,
            webhook_id -> Uuid,
            org_id -> Text,
            app_id -> Nullable<Text>,
            event -> Text,
            payload -> Jsonb,
            status -> Text,
            kronos_job_id -> Nullable<Text>,
            scheduled_for -> Timestamptz,
            attempt_count -> Int4,
            max_attempts -> Int4,
            last_status_code -> Nullable<Int4>,
            is_test -> Bool,
            idempotency_key -> Text,
            created_at -> Timestamptz,
            updated_at -> Timestamptz,
            attempts -> Jsonb,
        }
    }

    diesel::table! {
        hyperotaserver.webhooks (id) {
            id -> Uuid,
            org_id -> Text,
            app_id -> Nullable<Text>,
            name -> Text,
            description -> Text,
            url -> Text,
            method -> Text,
            events -> Jsonb,
            secret_encrypted -> Nullable<Text>,
            custom_headers -> Jsonb,
            enabled -> Bool,
            payload_version -> Text,
            max_retries -> Int4,
            created_at -> Timestamptz,
            created_by -> Text,
            updated_at -> Timestamptz,
            updated_by -> Text,
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

    diesel::joinable!(webhook_deliveries -> webhooks (webhook_id));

    diesel::allow_tables_to_appear_in_same_query!(
        authz_memberships,
        authz_role_bindings,
        builds,
        cleanup_outbox,
        configs,
        files,
        packages,
        packages_v2,
        release_views,
        releases,
        service_accounts,
        user_credentials,
        webhook_deliveries,
        webhooks,
        workspace_names,
    );
}
