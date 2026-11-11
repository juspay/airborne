CREATE INDEX device_reports_retention ON hyperotaserver.device_reports(received_at);
CREATE INDEX telemetry_limits_retention ON hyperotaserver.telemetry_limits(minute);
