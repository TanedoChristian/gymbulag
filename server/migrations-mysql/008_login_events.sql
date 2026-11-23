-- Login activity for the admin panel: every sign-in attempt, successful or not.
--   portal: 'app' (the workout app) or 'admin' (the admin panel)
--   reason: 'ok', 'signup', 'from_app', 'wrong_password', 'unknown_email', 'blocked', 'inactive', 'not_admin', 'rate_limited'
-- Passwords are never stored. user_id is NULL when the email doesn't match an account.

CREATE TABLE login_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NULL,
  email VARCHAR(254) NOT NULL DEFAULT '',
  success TINYINT(1) NOT NULL,
  reason VARCHAR(32) NOT NULL,
  portal VARCHAR(16) NOT NULL DEFAULT 'app',
  ip VARCHAR(64) NOT NULL DEFAULT '',
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  INDEX idx_login_events_created (created_at),
  INDEX idx_login_events_user (user_id, created_at),
  CONSTRAINT fk_login_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);
