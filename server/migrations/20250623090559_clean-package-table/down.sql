-- This file should undo anything in `up.sql`
ALTER TABLE hyperotaserver.packages
ADD COLUMN version_splits BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN use_urls BOOLEAN NOT NULL DEFAULT false;
