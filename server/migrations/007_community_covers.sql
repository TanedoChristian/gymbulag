-- Cover photo for each community, set by admins (same as migrations-mysql/012_community_covers.sql).
ALTER TABLE communities
  ADD COLUMN cover BYTEA NULL,
  ADD COLUMN cover_type VARCHAR(32) NULL,
  ADD COLUMN cover_key VARCHAR(40) NULL UNIQUE;
