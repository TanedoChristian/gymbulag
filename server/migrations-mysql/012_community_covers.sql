-- Cover photo for each community, set by admins.
--   cover:      the picture (a wide JPEG, cropped to 3:1 on the device before upload)
--   cover_type: its MIME type
--   cover_key:  random, unguessable id used in its URL (/api/community-covers/<key>); changes on every upload
-- Community queries list their columns so the picture is only read when it is served.
ALTER TABLE communities
  ADD COLUMN cover MEDIUMBLOB NULL,
  ADD COLUMN cover_type VARCHAR(32) NULL,
  ADD COLUMN cover_key VARCHAR(40) NULL,
  ADD UNIQUE KEY uq_communities_cover_key (cover_key);
