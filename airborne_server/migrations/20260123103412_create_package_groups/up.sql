CREATE TABLE hyperotaserver.package_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE UNIQUE INDEX package_groups_org_app_name_idx
  ON hyperotaserver.package_groups (org_id, app_id, name);


CREATE UNIQUE INDEX package_groups_one_primary_per_org_app_idx
  ON hyperotaserver.package_groups (org_id, app_id)
  WHERE is_primary = TRUE;


INSERT INTO hyperotaserver.package_groups (org_id, app_id, name, is_primary)
SELECT DISTINCT organization_id, application_id, 'primary', TRUE
FROM hyperotaserver.workspace_names
ON CONFLICT DO NOTHING;


ALTER TABLE hyperotaserver.packages_v2
  ADD COLUMN package_group_id UUID;


UPDATE hyperotaserver.packages_v2 p
SET package_group_id = pg.id
FROM hyperotaserver.package_groups pg
WHERE p.org_id = pg.org_id
  AND p.app_id = pg.app_id
  AND pg.is_primary = TRUE;


ALTER TABLE hyperotaserver.packages_v2
  ALTER COLUMN package_group_id SET NOT NULL;


ALTER TABLE hyperotaserver.packages_v2
  ADD CONSTRAINT fk_package_group
  FOREIGN KEY (package_group_id)
  REFERENCES hyperotaserver.package_groups(id)
  ON DELETE RESTRICT;

DROP INDEX IF EXISTS hyperotaserver.packages_v2_org_app_version_idx;
DROP INDEX IF EXISTS hyperotaserver.packages_v2_org_app_tag_idx;

CREATE UNIQUE INDEX packages_v2_org_app_group_version_idx
  ON hyperotaserver.packages_v2 (org_id, app_id, package_group_id, version);

CREATE UNIQUE INDEX packages_v2_org_app_group_tag_idx
  ON hyperotaserver.packages_v2 (org_id, app_id, package_group_id, tag);

ALTER TABLE hyperotaserver.packages_v2
  ALTER COLUMN "index" DROP NOT NULL;
