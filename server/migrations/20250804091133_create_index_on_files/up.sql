-- Your SQL goes here
CREATE UNIQUE INDEX files_path_org_app_version_idx
  ON hyperotaserver.files (file_path, org_id, app_id, version);

CREATE UNIQUE INDEX files_path_org_app_tag_idx
  ON hyperotaserver.files (file_path, org_id, tag);