-- Set while an organisation is being deleted and until a new organisation takes its name.
-- A deployment request cannot start executing for a closed organisation, so a request
-- approved at the moment of deletion never runs, and leftovers can never be acted on.
ALTER TABLE hyperotaserver.organisation_epochs ADD COLUMN closed_at timestamptz;
