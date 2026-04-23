CREATE TABLE IF NOT EXISTS hyperotaserver.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
    secret TEXT,
    organisation TEXT NOT NULL,
    application TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhooks_org_app_status_idx
    ON hyperotaserver.webhooks (organisation, application, status);

CREATE TABLE IF NOT EXISTS hyperotaserver.webhook_actions (
    webhook_id UUID NOT NULL REFERENCES hyperotaserver.webhooks(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    PRIMARY KEY (webhook_id, action)
);

CREATE INDEX IF NOT EXISTS webhook_actions_action_idx
    ON hyperotaserver.webhook_actions (action);

-- Monthly partitioned webhook logs table
CREATE TABLE IF NOT EXISTS hyperotaserver.webhook_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES hyperotaserver.webhooks(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    success BOOLEAN NOT NULL,
    status_code INT4,
    response JSONB NOT NULL DEFAULT '{}'::jsonb,
    webhook_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS webhook_logs_webhook_id_created_at_idx
    ON hyperotaserver.webhook_logs (webhook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_logs_webhook_action_created_idx
    ON hyperotaserver.webhook_logs (webhook_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_logs_webhook_success_created_idx
    ON hyperotaserver.webhook_logs (webhook_id, success, created_at DESC);

-- Default fallback partition so inserts never fail if the month partition is missing.
CREATE TABLE IF NOT EXISTS hyperotaserver.webhook_logs_default
    PARTITION OF hyperotaserver.webhook_logs DEFAULT;

-- Seed monthly partitions for current, previous and next 11 months.
DO $$
DECLARE
    start_month DATE := date_trunc('month', NOW())::date - INTERVAL '1 month';
    i INT;
    p_start DATE;
    p_end DATE;
    p_name TEXT;
BEGIN
    FOR i IN 0..12 LOOP
        p_start := (start_month + (i || ' month')::interval)::date;
        p_end := (p_start + INTERVAL '1 month')::date;
        p_name := format('webhook_logs_%s', to_char(p_start, 'YYYY_MM'));
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS hyperotaserver.%I PARTITION OF hyperotaserver.webhook_logs FOR VALUES FROM (%L) TO (%L);',
            p_name, p_start, p_end
        );
    END LOOP;
END$$;
