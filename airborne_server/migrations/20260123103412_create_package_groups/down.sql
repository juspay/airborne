ALTER TABLE hyperotaserver.packages_v2
  ALTER COLUMN "index" SET NOT NULL;


DROP INDEX IF EXISTS hyperotaserver.packages_v2_org_app_group_version_idx;
DROP INDEX IF EXISTS hyperotaserver.packages_v2_org_app_group_tag_idx;


CREATE UNIQUE INDEX packages_v2_org_app_version_idx
  ON hyperotaserver.packages_v2 (org_id, app_id, version);


CREATE UNIQUE INDEX packages_v2_org_app_tag_idx
  ON hyperotaserver.packages_v2 (org_id, app_id, tag);


ALTER TABLE hyperotaserver.packages_v2
  DROP CONSTRAINT IF EXISTS fk_package_group;


ALTER TABLE hyperotaserver.packages_v2
  DROP COLUMN IF EXISTS package_group_id;


DROP INDEX IF EXISTS hyperotaserver.package_groups_one_primary_per_org_app_idx;


DROP INDEX IF EXISTS hyperotaserver.package_groups_org_app_name_idx;


DROP TABLE IF EXISTS hyperotaserver.package_groups;
