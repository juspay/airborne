-- Copyright 2025 Juspay Technologies
-- Licensed under the Apache License, Version 2.0.
ALTER TABLE hyperotaserver.release_events DROP CONSTRAINT release_events_action_check;
ALTER TABLE hyperotaserver.release_events ADD CONSTRAINT release_events_action_check
CHECK(action IN ('created','ramped','concluded','discarded','rolled_back','operation_resolved'));
