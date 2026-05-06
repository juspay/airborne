ALTER TABLE hyperotaserver.workspace_names
    DROP CONSTRAINT IF EXISTS workspace_names_org_app_unique;

DROP TABLE IF EXISTS public.casbin_rule;
