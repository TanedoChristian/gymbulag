-- Login activity for the admin panel (same as migrations-mysql/008_login_events.sql).
--   portal: 'app' (the workout app) or 'admin' (the admin panel)
--   reason: 'ok', 'signup', 'from_app', 'wrong_password', 'unknown_email', 'blocked', 'inactive', 'not_admin', 'rate_limited'
-- Passwords are never stored. user_id is NULL when the email doesn't match an account.

CREATE TABLE login_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
  email VARCHAR(254) NOT NULL DEFAULT '',
  success SMALLINT NOT NULL,
  reason VARCHAR(32) NOT NULL,
  portal VARCHAR(16) NOT NULL DEFAULT 'app',
  ip VARCHAR(64) NOT NULL DEFAULT '',
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_login_events_created ON login_events (created_at);
CREATE INDEX idx_login_events_user ON login_events (user_id, created_at);

ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;
