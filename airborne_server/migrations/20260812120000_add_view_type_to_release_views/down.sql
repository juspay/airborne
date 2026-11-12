-- Names are unique across types again, so collapse the per-type duplicates first: only an
-- auto-generated view sharing a custom view's name can exist under the constraint being restored.
DELETE FROM hyperotaserver.release_views auto
USING hyperotaserver.release_views other
WHERE auto.view_type = 'auto_generated'
  AND other.view_type <> 'auto_generated'
  AND auto.app_id = other.app_id
  AND auto.org_id = other.org_id
  AND auto.name = other.name;

ALTER TABLE hyperotaserver.release_views
    DROP CONSTRAINT IF EXISTS release_views_app_id_org_id_name_view_type_key;

ALTER TABLE hyperotaserver.release_views
    ADD CONSTRAINT release_views_app_id_org_id_name_key UNIQUE (app_id, org_id, name);

ALTER TABLE hyperotaserver.release_views
    DROP CONSTRAINT IF EXISTS release_views_view_type_check;

ALTER TABLE hyperotaserver.release_views
    DROP COLUMN view_type;
