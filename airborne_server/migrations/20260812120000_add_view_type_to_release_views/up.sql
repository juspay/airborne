-- Distinguish views the user created from views Airborne generates for a release's dimensions.
-- Default is 'custom' so every pre-existing view stays user-owned (editable) after the migration.
ALTER TABLE hyperotaserver.release_views
    ADD COLUMN view_type TEXT NOT NULL DEFAULT 'custom';

ALTER TABLE hyperotaserver.release_views
    ADD CONSTRAINT release_views_view_type_check
    CHECK (view_type IN ('custom', 'auto_generated'));

-- Custom and auto-generated views are independent: a user's view over some dimensions must not stop
-- Airborne creating the auto-generated view for the same slice, because only the auto-generated one
-- can have its release deleted. Uniqueness is therefore per type — otherwise the auto insert would
-- silently collide with a custom view that happens to share its name.
ALTER TABLE hyperotaserver.release_views
    DROP CONSTRAINT IF EXISTS release_views_app_id_org_id_name_key;

ALTER TABLE hyperotaserver.release_views
    ADD CONSTRAINT release_views_app_id_org_id_name_view_type_key
    UNIQUE (app_id, org_id, name, view_type);
