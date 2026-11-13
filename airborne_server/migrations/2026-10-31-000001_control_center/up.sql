CREATE TABLE hyperotaserver.app_groups (
 id uuid PRIMARY KEY, org_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(org_id,name), UNIQUE(id,org_id));
CREATE TABLE hyperotaserver.app_group_members (
 group_id uuid NOT NULL, org_id text NOT NULL, app_id text NOT NULL,
 platform text NOT NULL CHECK(platform IN ('android','ios','web','other')),
 PRIMARY KEY(group_id,app_id), UNIQUE(org_id,app_id),
 FOREIGN KEY(group_id,org_id) REFERENCES hyperotaserver.app_groups(id,org_id) ON DELETE CASCADE);
CREATE TABLE hyperotaserver.release_events (
 id uuid PRIMARY KEY, org_id text NOT NULL, app_id text NOT NULL, release_id text NOT NULL,
 action text NOT NULL CHECK(action IN ('created','ramped','concluded','discarded','rolled_back')),
 actor text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX release_events_timeline ON hyperotaserver.release_events(org_id,app_id,release_id,created_at);
