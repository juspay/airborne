CREATE TABLE hyperotaserver.signing_keys (
    id UUID PRIMARY KEY,
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    name TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'ecdsa-p256',
    public_key TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, app_id, name),
    CONSTRAINT signing_keys_name_format CHECK (
        char_length(name) BETWEEN 1 AND 50
        AND name ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),
    CONSTRAINT signing_keys_default_not_disabled CHECK (NOT (is_default AND disabled))
);

CREATE UNIQUE INDEX signing_keys_single_default_per_app
    ON hyperotaserver.signing_keys (org_id, app_id)
    WHERE is_default;

CREATE INDEX signing_keys_org_app_idx
    ON hyperotaserver.signing_keys (org_id, app_id);

CREATE INDEX signing_keys_name_idx
    ON hyperotaserver.signing_keys (org_id, app_id, name);
