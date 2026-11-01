-- Validate in its own transaction: do not retain the swap transaction lock during the scan.
ALTER TABLE hyperotaserver.release_events VALIDATE CONSTRAINT release_events_action_check;
