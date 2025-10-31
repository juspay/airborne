-- Create enum types
CREATE TYPE hyperotaserver.invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE hyperotaserver.invite_role AS ENUM ('admin', 'read', 'write');

-- Create table using enums
CREATE TABLE hyperotaserver.organisation_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role hyperotaserver.invite_role NOT NULL,
    token TEXT NOT NULL,
    status hyperotaserver.invite_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Can we create global invite links which can be used by anyone and join the organisation?
-- What if I want to give a CSV and add a bunch of users at once to my org?
-- Do we want to disallow direct addition of someone to an org without an invite? most of the SaaS platforms send invites
-- Maybe let's have it like:: I add someone directly, but they get an email notification with a link to accept the invite and set up their account. If they don't have account we ask them to create one.