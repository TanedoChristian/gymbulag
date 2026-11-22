-- Core tables. Each row mirrors one record of the app's on-device database.
-- `data` holds the full record as JSON; a few columns are pulled out for querying.
-- `rev` is a global, ever-increasing change number used for incremental sync.
-- Deleted rows are kept as tombstones (deleted = 1) so other devices learn about the delete.

CREATE TABLE sync_counter (
  id TINYINT PRIMARY KEY,
  rev BIGINT NOT NULL
);
INSERT INTO sync_counter (id, rev) VALUES (1, 0);

CREATE TABLE sessions (
  id VARCHAR(64) PRIMARY KEY,
  date DATE NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  data JSON NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_sessions_rev (rev),
  INDEX idx_sessions_date (date)
);

CREATE TABLE exercises (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  muscle VARCHAR(32) NOT NULL DEFAULT '',
  equipment VARCHAR(32) NOT NULL DEFAULT '',
  custom TINYINT(1) NOT NULL DEFAULT 0,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  data JSON NULL,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_exercises_rev (rev)
);

CREATE TABLE templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  data JSON NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_templates_rev (rev)
);

CREATE TABLE photos (
  id VARCHAR(10) PRIMARY KEY COMMENT 'yyyy-MM-dd, one photo per day',
  mime VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  image MEDIUMBLOB NULL,
  thumb MEDIUMBLOB NULL,
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_photos_rev (rev)
);

CREATE TABLE settings (
  id VARCHAR(32) PRIMARY KEY,
  data JSON NULL,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_settings_rev (rev)
);
