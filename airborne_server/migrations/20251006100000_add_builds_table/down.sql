-- Drop indexes first to avoid dependency issues
DROP INDEX IF EXISTS hyperotaserver.idx_builds_org_app_release;
DROP INDEX IF EXISTS hyperotaserver.idx_builds_created_at;
DROP INDEX IF EXISTS hyperotaserver.idx_builds_version;

-- Drop the table
DROP TABLE IF EXISTS hyperotaserver.builds;