CREATE TABLE hyperotaserver.user_credentials (
    client_id UUID PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    organisation TEXT NOT NULL,
    application TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);