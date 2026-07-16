CREATE TABLE IF NOT EXISTS hyperotaserver.webhooks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           TEXT NOT NULL,
    -- NULL => organisation-scoped: fires for every application in the org, and for
    -- the org-level events (application.create, organisation_user.*) that have no app.
    app_id           TEXT,
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    url              TEXT NOT NULL,
    method           TEXT NOT NULL DEFAULT 'POST',
    events           JSONB NOT NULL DEFAULT '[]'::jsonb,
    secret_encrypted TEXT,
    custom_headers   JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled          BOOLEAN NOT NULL DEFAULT true,
    payload_version  TEXT NOT NULL DEFAULT 'v1',
    max_retries      INTEGER NOT NULL DEFAULT 5,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       TEXT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by       TEXT NOT NULL
);
-- Names are unique within a scope. Two partial indexes, because NULLs never collide in
-- a plain unique index — (org, NULL, 'name') twice would not be caught by one index on
-- (org_id, app_id, name).
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_org_app_name
    ON hyperotaserver.webhooks (org_id, app_id, name) WHERE app_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_org_name
    ON hyperotaserver.webhooks (org_id, name) WHERE app_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhooks_org_app
    ON hyperotaserver.webhooks (org_id, app_id);

CREATE TABLE IF NOT EXISTS hyperotaserver.webhook_deliveries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id       UUID NOT NULL REFERENCES hyperotaserver.webhooks(id) ON DELETE CASCADE,
    org_id           TEXT NOT NULL,
    -- The application whose event triggered this delivery. NULL for org-level events.
    -- An org-scoped webhook's deliveries carry the triggering app, so this is NOT the
    -- webhook's scope — authorize deliveries via the owning webhook, not this column.
    app_id           TEXT,
    event            TEXT NOT NULL,
    payload          JSONB NOT NULL,
    status           TEXT NOT NULL DEFAULT 'scheduled',
    kronos_job_id    TEXT,
    scheduled_for    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempt_count    INTEGER NOT NULL DEFAULT 0,
    max_attempts     INTEGER NOT NULL DEFAULT 5,
    last_status_code INTEGER,
    is_test          BOOLEAN NOT NULL DEFAULT false,
    idempotency_key  TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts         JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
    ON hyperotaserver.webhook_deliveries (webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_app
    ON hyperotaserver.webhook_deliveries (org_id, app_id, created_at DESC);
-- Drives the retention DELETE.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at
    ON hyperotaserver.webhook_deliveries (created_at);
