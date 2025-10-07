-- Create builds table for tracking build versions and their associated releases
CREATE TABLE IF NOT EXISTS hyperotaserver.builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    build_version TEXT NOT NULL,
    organisation TEXT NOT NULL,
    application TEXT NOT NULL,
    release_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add optimized indexes for query patterns
-- Primary index for the main query pattern: organisation, application, release_id
CREATE INDEX IF NOT EXISTS idx_builds_org_app_release ON hyperotaserver.builds (organisation, application, release_id);

-- Index for time-based operations (sorting, filtering by creation time)
CREATE INDEX IF NOT EXISTS idx_builds_created_at ON hyperotaserver.builds (created_at);

-- Index for version-only queries (if needed)
CREATE INDEX IF NOT EXISTS idx_builds_version ON hyperotaserver.builds (build_version);