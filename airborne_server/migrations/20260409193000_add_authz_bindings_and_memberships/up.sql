CREATE TABLE IF NOT EXISTS hyperotaserver.authz_role_bindings (
    scope TEXT NOT NULL CHECK (scope IN ('org', 'app')),
    role_key TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scope, role_key, resource, action)
);

CREATE INDEX IF NOT EXISTS authz_role_bindings_scope_resource_action_idx
    ON hyperotaserver.authz_role_bindings (scope, resource, action);

CREATE INDEX IF NOT EXISTS authz_role_bindings_scope_role_key_idx
    ON hyperotaserver.authz_role_bindings (scope, role_key);

CREATE TABLE IF NOT EXISTS hyperotaserver.authz_memberships (
    subject TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('org', 'app')),
    organisation TEXT NOT NULL,
    application TEXT NOT NULL,
    role_key TEXT NOT NULL,
    role_level INT4 NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subject, scope, organisation, application)
);

CREATE INDEX IF NOT EXISTS authz_memberships_scope_org_app_idx
    ON hyperotaserver.authz_memberships (scope, organisation, application);

CREATE INDEX IF NOT EXISTS authz_memberships_subject_scope_org_idx
    ON hyperotaserver.authz_memberships (subject, scope, organisation);

CREATE INDEX IF NOT EXISTS authz_memberships_scope_org_role_idx
    ON hyperotaserver.authz_memberships (scope, organisation, role_key);
