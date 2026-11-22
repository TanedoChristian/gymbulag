-- Walks and runs. Several per day, alongside gym sessions.
-- steps / distance_km / duration_min are copied out of `data` for querying.

CREATE TABLE activities (
  id VARCHAR(64) PRIMARY KEY,
  date DATE NULL,
  kind VARCHAR(16) NOT NULL DEFAULT '',
  steps INT NULL,
  distance_km DECIMAL(8, 3) NULL,
  duration_min DECIMAL(8, 2) NULL,
  data JSON NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_activities_rev (rev),
  INDEX idx_activities_date (date)
);
