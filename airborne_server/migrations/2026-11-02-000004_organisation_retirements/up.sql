-- When an organisation is deleted, the rows that describe its applications (workspace
-- mappings, packages, files, configs, releases, builds, block lists, serving policies,
-- device reports, API credentials) are not deleted: their organisation key is renamed to
-- a unique tombstone, so a new organisation of the same name starts empty, gets fresh
-- workspaces, and never serves or lists the previous tenant's releases and packages.
-- This table says which tombstone belonged to which organisation and when, for the manual
-- recovery of an organisation deleted by mistake (see docs: Organisation deletion).
CREATE TABLE hyperotaserver.organisation_retirements (
    tombstone text PRIMARY KEY,
    org_id text NOT NULL,
    retired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organisation_retirements_org ON hyperotaserver.organisation_retirements(org_id);
