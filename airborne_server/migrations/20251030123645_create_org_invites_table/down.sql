-- This file should undo anything in `up.sql`
DROP TABLE IF EXISTS hyperotaserver.organisation_invites CASCADE;
DROP TYPE IF EXISTS hyperotaserver.invite_status CASCADE;
DROP TYPE IF EXISTS hyperotaserver.invite_role CASCADE;
