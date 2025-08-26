CREATE TABLE hyperotaserver.release_views (
    id UUID PRIMARY KEY,
    app_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, org_id, name)
);