-- A package remembers which file groups (at which group version) contributed
-- its files. Each entry snapshots {id, name, version, files} at package
-- creation time; group versions are immutable, so the snapshot stays true.
-- packages_v2.files remains the complete expanded list used for serving.
ALTER TABLE hyperotaserver.packages_v2
  ADD COLUMN file_groups JSONB NOT NULL DEFAULT '[]';
