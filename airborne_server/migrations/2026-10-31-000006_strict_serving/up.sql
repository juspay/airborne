CREATE TABLE hyperotaserver.serving_policies (
 org_id text NOT NULL, app_id text NOT NULL, strict boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,app_id));
-- Explicit legacy backfill: never opt existing applications in implicitly.
INSERT INTO hyperotaserver.serving_policies(org_id,app_id,strict)
 SELECT organization_id,application_id,false FROM hyperotaserver.workspace_names ON CONFLICT DO NOTHING;
