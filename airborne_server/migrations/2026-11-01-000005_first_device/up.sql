CREATE TABLE hyperotaserver.first_device_requests (
  org_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  first_device_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, app_id),
  FOREIGN KEY (org_id, app_id) REFERENCES hyperotaserver.workspace_names(organization_id, application_id) ON DELETE CASCADE
);
