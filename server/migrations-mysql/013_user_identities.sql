-- Google / Facebook sign-in.
--   provider: 'google' or 'facebook'
--   subject:  the provider's stable id for the person (Google "sub", Facebook user id)
--   email:    the email the provider reported at link time, for the admin's reference
-- Accounts created this way have an empty users.password_hash until they set a password.

CREATE TABLE user_identities (
  provider VARCHAR(16) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  email VARCHAR(254) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  PRIMARY KEY (provider, subject),
  INDEX idx_user_identities_user (user_id),
  CONSTRAINT fk_user_identities_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
