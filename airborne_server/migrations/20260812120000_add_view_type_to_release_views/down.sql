ALTER TABLE hyperotaserver.release_views
    DROP CONSTRAINT IF EXISTS release_views_view_type_check;

ALTER TABLE hyperotaserver.release_views
    DROP COLUMN view_type;
