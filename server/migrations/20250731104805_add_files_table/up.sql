-- Your SQL goes here
CREATE TABLE hyperotaserver.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    tag TEXT NOT NULL,
    url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size BIGINT NOT NULL,
    checksum TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);