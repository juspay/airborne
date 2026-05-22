-- Create validation_functions table
CREATE TABLE hyperotaserver.validation_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    function_code TEXT NOT NULL DEFAULT 'async function main(args) {
  return true;
}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, app_id)
);

-- Backfill default validation function for all existing applications
INSERT INTO hyperotaserver.validation_functions (org_id, app_id, function_code)
SELECT DISTINCT organization_id, application_id, 'async function main(args) {
  return true;
}'
FROM hyperotaserver.workspace_names
ON CONFLICT (org_id, app_id) DO NOTHING;

CREATE INDEX idx_validation_functions_org_app ON hyperotaserver.validation_functions(org_id, app_id);