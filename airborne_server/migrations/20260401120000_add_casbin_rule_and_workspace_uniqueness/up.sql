CREATE TABLE IF NOT EXISTS public.casbin_rule (
    id SERIAL PRIMARY KEY,
    ptype VARCHAR(255) NOT NULL,
    v0 VARCHAR(255),
    v1 VARCHAR(255),
    v2 VARCHAR(255),
    v3 VARCHAR(255),
    v4 VARCHAR(255),
    v5 VARCHAR(255)
);

DELETE FROM hyperotaserver.workspace_names older
USING hyperotaserver.workspace_names newer
WHERE older.id < newer.id
  AND older.organization_id = newer.organization_id
  AND older.application_id = newer.application_id;

ALTER TABLE hyperotaserver.workspace_names
    ADD CONSTRAINT workspace_names_org_app_unique UNIQUE (organization_id, application_id);
