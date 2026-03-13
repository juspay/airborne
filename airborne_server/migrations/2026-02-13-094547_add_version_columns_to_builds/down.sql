-- Restore the old text-based version index
CREATE INDEX IF NOT EXISTS idx_builds_version ON hyperotaserver.builds (build_version);

-- Drop the composite index
DROP INDEX IF EXISTS hyperotaserver.idx_builds_version_sort;

DROP INDEX IF EXISTS hyperotaserver.builds_unique_release_idx;
DROP INDEX IF EXISTS hyperotaserver.builds_unique_version_idx;
DROP INDEX IF EXISTS hyperotaserver.builds_unique_semver_idx;

-- Drop the version columns
ALTER TABLE hyperotaserver.builds
    DROP COLUMN IF EXISTS major_version,
    DROP COLUMN IF EXISTS minor_version,
    DROP COLUMN IF EXISTS patch_version;
