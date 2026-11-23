-- Google / Facebook sign-in (same as migrations-mysql/013_user_identities.sql).
--   provider: 'google' or 'facebook'
--   subject:  the provider's stable id for the person (Google "sub", Facebook user id)
--   email:    the email the provider reported at link time, for the admin's reference
-- Accounts created this way have an empty users.password_hash until they set a password.

CREATE TABLE user_identities (
  provider VARCHAR(16) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX idx_user_identities_user ON user_identities (user_id);

ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;
