-- Remove status column and enum type from files table
ALTER TABLE hyperotaserver.files DROP COLUMN status;
DROP TYPE IF EXISTS hyperotaserver.file_status;
