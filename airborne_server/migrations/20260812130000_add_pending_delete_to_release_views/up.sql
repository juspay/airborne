-- Links an auto-generated view to the in-flight release that will retire it (a "delete release":
-- a release whose experimental variant carries the default, dimension-less config).
-- Set when that release is created, cleared when it is discarded or concluded on control, and the
-- whole row is deleted when it concludes on the experimental variant.
ALTER TABLE hyperotaserver.release_views
    ADD COLUMN pending_delete_release_id TEXT;
