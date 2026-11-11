-- Run in a migrated disposable database; all fixture changes roll back.
BEGIN;
INSERT INTO hyperotaserver.workspace_names (organization_id, application_id, workspace_name)
VALUES ('first-device-scratch', 'a', 'first_device_scratch_a'), ('first-device-scratch','b','first_device_scratch_b');
INSERT INTO hyperotaserver.first_device_requests(org_id,app_id,first_device_seen_at)
VALUES ('first-device-scratch','a','2026-01-01T00:00:00Z');
INSERT INTO hyperotaserver.first_device_requests(org_id,app_id) VALUES ('first-device-scratch','a') ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF (SELECT first_device_seen_at FROM hyperotaserver.first_device_requests WHERE org_id='first-device-scratch' AND app_id='a') <> '2026-01-01T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'first timestamp overwritten'; END IF;
 IF EXISTS(SELECT 1 FROM hyperotaserver.first_device_requests WHERE org_id='first-device-scratch' AND app_id='b') THEN RAISE EXCEPTION 'scope leaked'; END IF;
END $$;
ROLLBACK;
