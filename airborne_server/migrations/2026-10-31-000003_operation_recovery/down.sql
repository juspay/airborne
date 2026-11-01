-- Copyright 2025 Juspay Technologies
-- Licensed under the Apache License, Version 2.0.
-- Preserve privileged recovery audit records. Downgrade is deliberately blocked
-- while any exist, rather than deleting append-only history.
ALTER TABLE hyperotaserver.release_events DROP CONSTRAINT release_events_action_check;
ALTER TABLE hyperotaserver.release_events ADD CONSTRAINT release_events_action_check
CHECK(action IN ('created','ramped','concluded','discarded','rolled_back'));
