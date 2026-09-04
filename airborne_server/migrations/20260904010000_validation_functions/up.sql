-- One JavaScript validation function per application. It runs before a
-- release is created; returning false rejects the release. `main` is a
-- synchronous function.
CREATE TABLE hyperotaserver.validation_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    function_code TEXT NOT NULL DEFAULT 'function main(args) {
  return true;
}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, app_id)
);

CREATE INDEX idx_validation_functions_org_app
  ON hyperotaserver.validation_functions(org_id, app_id);
