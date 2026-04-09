CREATE UNIQUE INDEX IF NOT EXISTS unique_org_app_idx
ON hyperotaserver.workspace_names (organization_id, application_id);
