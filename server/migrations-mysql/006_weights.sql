-- Daily body weight, one per day. `kg` is copied out of `data` for querying.

CREATE TABLE weights (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(10) NOT NULL COMMENT 'yyyy-MM-dd, one weigh-in per day',
  kg DECIMAL(6, 2) NULL,
  data JSON NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id),
  INDEX idx_weights_user_rev (user_id, rev)
);
