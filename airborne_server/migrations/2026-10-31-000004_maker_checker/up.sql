-- Additive API protection. Keep disabled until every serving binary enforces it.
CREATE TABLE hyperotaserver.approval_deployment (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enforcement_ready boolean NOT NULL DEFAULT false);
INSERT INTO hyperotaserver.approval_deployment VALUES (true,false);
CREATE TABLE hyperotaserver.approval_policies (org_id text NOT NULL, app_id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(org_id,app_id));
CREATE TABLE hyperotaserver.deployment_requests (id uuid PRIMARY KEY, org_id text NOT NULL, app_id text NOT NULL, status text NOT NULL CHECK(status IN ('pending','executing','executed','failed','rejected','cancelled','expired','stale')), data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX deployment_requests_queue ON hyperotaserver.deployment_requests(org_id,app_id,status,created_at);
CREATE FUNCTION hyperotaserver.immutable_deployment_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.org_id,NEW.app_id,NEW.data->'payload',NEW.data->'payload_hash',NEW.data->'requester',NEW.data->'action',NEW.data->'base_state',NEW.data->'expires_at',NEW.data->'reason') IS DISTINCT FROM (OLD.org_id,OLD.app_id,OLD.data->'payload',OLD.data->'payload_hash',OLD.data->'requester',OLD.data->'action',OLD.data->'base_state',OLD.data->'expires_at',OLD.data->'reason') THEN RAISE EXCEPTION 'Deployment request is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER immutable_deployment_request BEFORE UPDATE ON hyperotaserver.deployment_requests FOR EACH ROW EXECUTE FUNCTION hyperotaserver.immutable_deployment_request();
CREATE TABLE hyperotaserver.release_protections (org_id text NOT NULL, app_id text NOT NULL, release_id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(org_id,app_id,release_id));
CREATE TABLE hyperotaserver.emergency_reviews (id uuid PRIMARY KEY, org_id text NOT NULL, app_id text NOT NULL, release_id text NOT NULL, actor text NOT NULL, acknowledged_by text, data jsonb NOT NULL);
ALTER TABLE hyperotaserver.release_events DROP CONSTRAINT release_events_action_check;
ALTER TABLE hyperotaserver.release_events ADD CONSTRAINT release_events_action_check CHECK(action IN ('created','ramped','concluded','discarded','rolled_back','operation_resolved','requested','approved','rejected','cancelled','expired','stale','executed','failed','emergency_rollback','emergency_acknowledged','policy_changed')) NOT VALID;
