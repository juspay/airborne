-- Your SQL goes here
ALTER TABLE hyperotaserver.workspace_names
ADD COLUMN application_id TEXT NOT NULL DEFAULT '';

-- Drop the default so future inserts must specify a value
ALTER TABLE hyperotaserver.workspace_names
ALTER COLUMN application_id DROP DEFAULT;