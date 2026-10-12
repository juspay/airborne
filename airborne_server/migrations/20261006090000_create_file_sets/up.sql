-- A file set is a named, versioned collection of files. Like files
-- (path + version rows) and packages (version rows), the version rows ARE
-- the entity: one row per (name, version), no separate identity table.
-- file_ids references rows in hyperotaserver.files — file data is never
-- copied. Postgres cannot enforce foreign keys over array elements, so
-- membership integrity is enforced at write time (the same contract
-- packages_v2.files already relies on); files are never deleted.
CREATE TABLE hyperotaserver.file_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version INT4 NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    file_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, app_id, name, version)
);

CREATE INDEX file_sets_org_app_idx
  ON hyperotaserver.file_sets (org_id, app_id);

-- reverse lookups: which set versions contain a given file
CREATE INDEX file_sets_file_ids_idx
  ON hyperotaserver.file_sets USING GIN (file_ids);
