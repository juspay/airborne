CREATE TYPE hyperotaserver.file_status AS ENUM ('pending', 'ready', 'deleted');

ALTER TABLE hyperotaserver.files
ADD COLUMN status hyperotaserver.file_status NOT NULL DEFAULT 'pending';

-- Backfill existing rows: files with size > 0 are ready, rest are pending
UPDATE hyperotaserver.files SET status = 'ready' WHERE size > 0;
UPDATE hyperotaserver.files SET status = 'pending' WHERE size = 0;
