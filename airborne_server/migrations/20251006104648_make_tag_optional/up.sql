ALTER TABLE hyperotaserver.files
ALTER COLUMN tag DROP NOT NULL;

ALTER TABLE hyperotaserver.packages_v2
ALTER COLUMN tag DROP NOT NULL;

DROP INDEX IF EXISTS hyperotaserver.files_path_org_app_version_idx;
DROP INDEX IF EXISTS hyperotaserver.files_path_org_app_tag_idx;


CREATE UNIQUE INDEX files_org_app_path_version_idx
  ON hyperotaserver.files (org_id, app_id, file_path, version);

CREATE UNIQUE INDEX files_org_app_path_tag_uq
  ON hyperotaserver.files (org_id, app_id, file_path, tag)
  WHERE tag IS NOT NULL;
