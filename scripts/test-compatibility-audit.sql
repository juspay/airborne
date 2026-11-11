-- Run against a disposable migrated database with psql -v ON_ERROR_STOP=1.
-- The transaction leaves no fixture rows behind.
BEGIN;
INSERT INTO hyperotaserver.release_events(id,org_id,app_id,release_id,action,actor,payload)
VALUES(gen_random_uuid(),'scratch-compatibility','scratch-app','','compatibility_exception','operator','{"reason":"Custom native compatibility reviewed by operator"}');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM hyperotaserver.release_events WHERE org_id='scratch-compatibility' AND action='compatibility_exception' AND actor='operator' AND payload->>'reason'='Custom native compatibility reviewed by operator') THEN
  RAISE EXCEPTION 'Compatibility exception audit was not persisted';
 END IF;
END $$;
ROLLBACK;
