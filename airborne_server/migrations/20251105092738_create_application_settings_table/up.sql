-- Your SQL goes here
CREATE TABLE hyperotaserver.application_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL,
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    maven_namespace TEXT NOT NULL,
    maven_artifact_id TEXT NOT NULL,
    maven_group_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX application_settings_org_app_version_idx
  ON hyperotaserver.application_settings (org_id, app_id, version);