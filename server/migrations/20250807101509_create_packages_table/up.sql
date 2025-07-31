-- Your SQL goes here
CREATE TABLE hyperotaserver.packages_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL,
    app_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    index TEXT NOT NULL,
    files TEXT[] NOT NULL,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX packages_v2_org_app_version_idx
  ON hyperotaserver.packages_v2 (org_id, app_id, version);

CREATE UNIQUE INDEX packages_v2_org_app_tag_idx
  ON hyperotaserver.packages_v2 (org_id, tag);