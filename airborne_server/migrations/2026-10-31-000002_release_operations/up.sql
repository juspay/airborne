-- Copyright 2025 Juspay Technologies
-- Licensed under the Apache License, Version 2.0.
-- See http://www.apache.org/licenses/LICENSE-2.0

-- Durable recovery is separate from the best-effort, append-only audit trail.
CREATE TABLE hyperotaserver.release_operations (
 id uuid PRIMARY KEY, org_id text NOT NULL, app_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('write','rollback')),
 source_release_id text NOT NULL,
 state text NOT NULL CHECK (state IN ('planned','unresolved','confirmed','rejected','completed')),
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX release_rollback_source ON hyperotaserver.release_operations(org_id,app_id,source_release_id) WHERE kind='rollback';
CREATE INDEX release_unresolved_app ON hyperotaserver.release_operations(org_id,app_id) WHERE state='unresolved';
