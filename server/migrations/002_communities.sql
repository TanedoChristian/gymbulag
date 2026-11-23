-- Roles, account status and gym communities (same as migrations-mysql/007_communities.sql).
--   users.role:         'user' | 'admin'   (admins run the admin panel; ADMIN_EMAILS also grants it)
--   users.status:       'active' | 'inactive' | 'blocked'   (only active accounts can log in)
--   communities:        a gym; people join by scanning its QR code (which carries join_code)
--   community_owners:   gym owners an admin gave access to; they see and moderate that community
--   community_members:  who joined; status 'blocked' keeps someone out (they can't rejoin by QR)

ALTER TABLE users
  ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user',
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active',
  ADD COLUMN status_changed_at BIGINT NULL;

CREATE TABLE communities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(255) NOT NULL DEFAULT '',
  join_code VARCHAR(32) NOT NULL UNIQUE,
  active SMALLINT NOT NULL DEFAULT 1,
  created_by BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE community_owners (
  community_id BIGINT NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  granted_at BIGINT NOT NULL,
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX idx_community_owners_user ON community_owners (user_id);

CREATE TABLE community_members (
  community_id BIGINT NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  joined_at BIGINT NOT NULL,
  blocked_at BIGINT NULL,
  blocked_by BIGINT NULL,
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX idx_community_members_user ON community_members (user_id);

ALTER TABLE communities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_owners  ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
