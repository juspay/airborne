-- Distinguish views the user created from views Airborne generates for a release's dimensions.
-- Default is 'custom' so every pre-existing view stays user-owned (editable) after the migration.
ALTER TABLE hyperotaserver.release_views
    ADD COLUMN view_type TEXT NOT NULL DEFAULT 'custom';

ALTER TABLE hyperotaserver.release_views
    ADD CONSTRAINT release_views_view_type_check
    CHECK (view_type IN ('custom', 'auto_generated'));
