-- Anonymous, unverified telemetry has no release-control foreign key or trigger.
CREATE TABLE hyperotaserver.device_reports (
 org_id text NOT NULL, app_id text NOT NULL, release_id text NOT NULL,
 package_version text NOT NULL, native_version text NOT NULL, platform text NOT NULL CHECK(platform IN ('web','android','ios')),
 install_id uuid NOT NULL, event_id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('package_downloaded','boot_started','boot_success','boot_failed','rollback','blocked_package')),
 release_created bigint NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_reports_scope ON hyperotaserver.device_reports(org_id,app_id,received_at);
CREATE TABLE hyperotaserver.telemetry_limits (bucket text NOT NULL, minute bigint NOT NULL, count integer NOT NULL, PRIMARY KEY(bucket,minute));
CREATE TABLE hyperotaserver.blocked_packages (org_id text NOT NULL, app_id text NOT NULL, package_version text NOT NULL, source_release text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(org_id,app_id,package_version));
