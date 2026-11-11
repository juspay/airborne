-- Organisation names are reusable and deleting an organisation keeps its audit history.
-- started_at marks when the current organisation of that name was created, so the
-- deployments feed and the overview never show the previous tenant's audit rows to the
-- new one. Organisations created before this migration have no row (no boundary).
CREATE TABLE hyperotaserver.organisation_epochs (
    org_id text PRIMARY KEY,
    started_at timestamptz NOT NULL
);
