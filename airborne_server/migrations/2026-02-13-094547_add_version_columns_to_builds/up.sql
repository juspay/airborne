-- Important: Manually remove the duplicate version and release id rows

-- Add separate version columns for proper numeric sorting
ALTER TABLE hyperotaserver.builds 
    ADD COLUMN major_version INTEGER,
    ADD COLUMN minor_version INTEGER,
    ADD COLUMN patch_version INTEGER;

-- Backfill existing records by parsing build_version TEXT column
-- Assumes format: "major.minor.patch" (e.g., "1.0.5")
UPDATE hyperotaserver.builds
SET 
    major_version = CAST(split_part(build_version, '.', 1) AS INTEGER),
    minor_version = CAST(split_part(build_version, '.', 2) AS INTEGER),
    patch_version = CAST(split_part(build_version, '.', 3) AS INTEGER)
WHERE major_version IS NULL;

-- Make columns NOT NULL after backfilling
ALTER TABLE hyperotaserver.builds
    ALTER COLUMN major_version SET NOT NULL,
    ALTER COLUMN minor_version SET NOT NULL,
    ALTER COLUMN patch_version SET NOT NULL;

-- Create composite index for efficient descending order queries
-- This supports: ORDER BY major_version DESC, minor_version DESC, patch_version DESC
CREATE INDEX idx_builds_version_sort ON hyperotaserver.builds 
    (organisation, application, major_version DESC, minor_version DESC, patch_version DESC);

-- Drop old text-based version index as it's no longer needed
DROP INDEX IF EXISTS hyperotaserver.idx_builds_version;

-- Add unique constraint to ensure no duplicate build versions per app
CREATE UNIQUE INDEX IF NOT EXISTS builds_unique_release_idx
ON hyperotaserver.builds (organisation, application, release_id);

CREATE UNIQUE INDEX IF NOT EXISTS builds_unique_version_idx
ON hyperotaserver.builds (organisation, application, build_version);

CREATE UNIQUE INDEX IF NOT EXISTS builds_unique_semver_idx
ON hyperotaserver.builds (organisation, application, major_version, minor_version, patch_version);