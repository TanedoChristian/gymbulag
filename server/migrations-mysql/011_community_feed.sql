-- Community feed: posts, likes, comments, and post pictures.
--   community_posts:       a member's post in a community; pinned posts (by gym owners / admins) show first
--   community_post_likes:  one row per person who liked a post
--   community_comments:    comments under a post
--   community_post_media:  pictures for posts. Uploaded one at a time (post_id NULL until the post is created),
--                          then attached; served from /api/community-media/<media_key> (random, unguessable).

CREATE TABLE community_posts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  community_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  edited_at BIGINT NULL,
  INDEX idx_community_posts_feed (community_id, pinned, id),
  CONSTRAINT fk_community_posts_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_community_posts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE community_post_likes (
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE community_comments (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_community_comments_post (post_id, id),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE community_post_media (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  community_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  post_id BIGINT NULL,
  media_key VARCHAR(40) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  data MEDIUMBLOB NOT NULL,
  width INT NULL,
  height INT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_post_media_key (media_key),
  INDEX idx_post_media_post (post_id, position),
  INDEX idx_post_media_pending (user_id, post_id, created_at),
  CONSTRAINT fk_post_media_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_media_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_media_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE
);
