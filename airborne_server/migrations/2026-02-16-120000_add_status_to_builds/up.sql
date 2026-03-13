-- Add status column to track build lifecycle: BUILDING → READY
-- Rows with BUILDING status older than 5 minutes are considered stale and will be cleaned up.
ALTER TABLE hyperotaserver.builds
    ADD COLUMN status TEXT NOT NULL DEFAULT 'READY';
-- Default is READY so existing rows are immediately valid.
-- New inserts from application code will explicitly set 'BUILDING'.
