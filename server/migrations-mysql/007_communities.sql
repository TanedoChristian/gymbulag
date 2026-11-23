-- Roles, account status and gym communities.
--   users.role:         'user' | 'admin'   (admins run the admin panel; ADMIN_EMAILS in .env also grants it)
--   users.status:       'active' | 'inactive' | 'blocked'   (only active accounts can log in)
--   communities:        a gym; people join by scanning its QR code (which carries join_code)
--   community_owners:   gym owners an admin gave access to; they see and moderate that community
--   community_members:  who joined; status 'blocked' keeps someone out (they can't rejoin by QR)

ALTER TABLE users
  ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user',
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active',
  ADD COLUMN status_changed_at BIGINT NULL;

CREATE TABLE communities (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(255) NOT NULL DEFAULT '',
  join_code VARCHAR(32) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE KEY uq_communities_code (join_code),
  CONSTRAINT fk_communities_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE community_owners (
  community_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  granted_at BIGINT NOT NULL,
  PRIMARY KEY (community_id, user_id),
  INDEX idx_community_owners_user (user_id),
  CONSTRAINT fk_community_owners_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_community_owners_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE community_members (
  community_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  joined_at BIGINT NOT NULL,
  blocked_at BIGINT NULL,
  blocked_by BIGINT NULL,
  PRIMARY KEY (community_id, user_id),
  INDEX idx_community_members_user (user_id),
  CONSTRAINT fk_community_members_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_community_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
