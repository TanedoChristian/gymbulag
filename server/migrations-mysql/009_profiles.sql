-- Profile details and profile pictures.
--   phone, gender, city, bio, fitness_goal, experience: optional, filled in by the user (or an admin)
--   avatar:      the picture itself (a small square JPEG/PNG/WebP, resized on the device before upload)
--   avatar_type: its MIME type
--   avatar_key:  random, unguessable id used in the picture's URL (/api/avatars/<key>); changes on every upload
-- Queries that load users list their columns explicitly so the picture is only read when it is served.

ALTER TABLE users
  ADD COLUMN phone VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN gender VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN city VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN bio VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN fitness_goal VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN experience VARCHAR(16) NOT NULL DEFAULT '',
  ADD COLUMN avatar MEDIUMBLOB NULL,
  ADD COLUMN avatar_type VARCHAR(32) NULL,
  ADD COLUMN avatar_key VARCHAR(40) NULL,
  ADD UNIQUE KEY uq_users_avatar_key (avatar_key);
