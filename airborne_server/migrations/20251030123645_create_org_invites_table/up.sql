CREATE TYPE IF NOT EXISTS hyperotaserver.invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE IF NOT EXISTS hyperotaserver.invite_role AS ENUM ('admin', 'read', 'write');

CREATE TABLE IF NOT EXISTS hyperotaserver.organisation_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    applications JSONB NOT NULL DEFAULT '[]'::jsonb,
    email TEXT NOT NULL,
    role hyperotaserver.invite_role NOT NULL,
    token TEXT NOT NULL,
    status hyperotaserver.invite_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organisation_invites_org_id_idx ON hyperotaserver.organisation_invites (org_id);

CREATE UNIQUE INDEX IF NOT EXISTS organisation_invites_token_idx ON hyperotaserver.organisation_invites (token);
