-- A file set is a named, versioned collection of files. Like files
-- (path + version rows) and packages (version rows), the version rows ARE
-- the entity: one row per (name, version), no separate identity table.
-- file_keys lists the member files as `path@version:N` keys, resolved when
-- the version is created (tag keys are pinned to the version they pointed
-- at). A file's path and version never change, so a key always names the
-- same row in hyperotaserver.files and reads need no lookup there; file data
-- is never copied. This is the same contract packages_v2.files relies on.
CREATE TABLE hyperotaserver.file_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version INT4 NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    file_keys TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, app_id, name, version)
);

CREATE INDEX file_sets_org_app_idx
  ON hyperotaserver.file_sets (org_id, app_id);

-- reverse lookups: which set versions contain a given file key
CREATE INDEX file_sets_file_keys_idx
  ON hyperotaserver.file_sets USING GIN (file_keys);
