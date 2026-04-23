CREATE TABLE hyperotaserver.service_accounts (
    client_id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    organisation TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (email),
    UNIQUE (organisation, name)
);

CREATE INDEX idx_service_accounts_org ON hyperotaserver.service_accounts (organisation);
