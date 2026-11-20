-- Never silently remove an enabled protection. Roll forward instead.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM hyperotaserver.approval_policies WHERE data->>'enabled'='true') THEN RAISE EXCEPTION 'Disable approval policies before downgrading'; END IF; END $$;
DROP TABLE hyperotaserver.emergency_reviews, hyperotaserver.release_protections, hyperotaserver.deployment_requests, hyperotaserver.approval_policies, hyperotaserver.approval_deployment;
DROP FUNCTION hyperotaserver.immutable_deployment_request();
-- Retain the additive audit action constraint: historical events must remain readable.
