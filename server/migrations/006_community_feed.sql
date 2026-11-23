-- Community feed: posts, likes, comments, and post pictures (same as migrations-mysql/011_community_feed.sql).

CREATE TABLE community_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  pinned SMALLINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  edited_at BIGINT NULL
);
CREATE INDEX idx_community_posts_feed ON community_posts (community_id, pinned, id);

CREATE TABLE community_post_likes (
  post_id BIGINT NOT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE community_comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body VARCHAR(1000) NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_community_comments_post ON community_comments (post_id, id);

CREATE TABLE community_post_media (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id BIGINT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
  media_key VARCHAR(40) NOT NULL UNIQUE,
  mime VARCHAR(32) NOT NULL,
  data BYTEA NOT NULL,
  width INT NULL,
  height INT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_post_media_post ON community_post_media (post_id, position);
CREATE INDEX idx_post_media_pending ON community_post_media (user_id, post_id, created_at);

ALTER TABLE community_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_media ENABLE ROW LEVEL SECURITY;
