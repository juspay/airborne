ALTER TABLE hyperotaserver.files
ALTER COLUMN tag SET NOT NULL;

ALTER TABLE hyperotaserver.packages_v2
ALTER COLUMN tag SET NOT NULL;
