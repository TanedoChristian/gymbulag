-- Accounts. Every data row now belongs to one user; one email per account.
--   users:       login + profile (birth_date is required so age is always known)
--   auth_tokens: one row per signed-in device; only a SHA-256 of the token is stored
-- Rows synced before accounts existed get user_id = 0 and are handed to the first account created.

CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  birth_date DATE NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE auth_tokens (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  device VARCHAR(255) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  last_used_at BIGINT NOT NULL,
  INDEX idx_auth_tokens_user (user_id),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

ALTER TABLE sessions   ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_sessions_user_rev (user_id, rev);
ALTER TABLE exercises  ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_exercises_user_rev (user_id, rev);
ALTER TABLE templates  ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_templates_user_rev (user_id, rev);
ALTER TABLE photos     ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_photos_user_rev (user_id, rev);
ALTER TABLE settings   ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_settings_user_rev (user_id, rev);
ALTER TABLE activities ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_activities_user_rev (user_id, rev);
ALTER TABLE foods      ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_foods_user_rev (user_id, rev);
ALTER TABLE foodlog    ADD COLUMN user_id BIGINT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, id), ADD INDEX idx_foodlog_user_rev (user_id, rev);

-- Reporting views, now per user:  SELECT * FROM v_sets WHERE user_id = 1 AND exercise = 'Bench Press';
CREATE OR REPLACE VIEW v_session_exercises AS
SELECT
  s.user_id,
  s.id AS session_id,
  s.date,
  s.name AS session_name,
  ex.position AS exercise_order,
  ex.exercise_id,
  COALESCE(e.name, ex.exercise_id) AS exercise,
  e.muscle,
  ex.unit AS input_unit,
  ex.notes
FROM sessions s
JOIN JSON_TABLE(s.data, '$.exercises[*]' COLUMNS (
  position FOR ORDINALITY,
  exercise_id VARCHAR(64) PATH '$.exerciseId',
  unit VARCHAR(4) PATH '$.unit',
  notes TEXT PATH '$.notes'
)) ex
LEFT JOIN exercises e ON e.user_id = s.user_id AND e.id = ex.exercise_id COLLATE utf8mb4_unicode_ci AND e.deleted = 0
WHERE s.deleted = 0;

CREATE OR REPLACE VIEW v_sets AS
SELECT
  s.user_id,
  s.id AS session_id,
  s.date,
  s.name AS session_name,
  x.position AS exercise_order,
  COALESCE(e.name, x.exercise_id) AS exercise,
  e.muscle,
  x.set_number,
  x.set_type,
  x.weight_kg,
  ROUND(x.weight_kg * 2.20462, 1) AS weight_lb,
  x.reps,
  x.rpe,
  ROUND(x.weight_kg * x.reps, 2) AS volume_kg,
  CASE WHEN x.reps = 1 THEN x.weight_kg
       WHEN x.reps BETWEEN 2 AND 12 THEN ROUND(x.weight_kg * (1 + x.reps / 30), 1) END AS e1rm_kg
FROM sessions s
JOIN JSON_TABLE(s.data, '$.exercises[*]' COLUMNS (
  position FOR ORDINALITY,
  exercise_id VARCHAR(64) PATH '$.exerciseId',
  NESTED PATH '$.sets[*]' COLUMNS (
    set_number FOR ORDINALITY,
    set_type VARCHAR(16) PATH '$.type',
    weight_kg DECIMAL(8,3) PATH '$.weight' NULL ON EMPTY NULL ON ERROR,
    reps INT PATH '$.reps' NULL ON EMPTY NULL ON ERROR,
    rpe DECIMAL(4,1) PATH '$.rpe' NULL ON EMPTY NULL ON ERROR
  )
)) x
LEFT JOIN exercises e ON e.user_id = s.user_id AND e.id = x.exercise_id COLLATE utf8mb4_unicode_ci AND e.deleted = 0
WHERE s.deleted = 0 AND (x.reps IS NOT NULL OR x.weight_kg IS NOT NULL);

CREATE OR REPLACE VIEW v_daily_nutrition AS
SELECT user_id, date, ROUND(SUM(kcal)) AS kcal, ROUND(SUM(protein_g), 1) AS protein_g, ROUND(SUM(carbs_g), 1) AS carbs_g, ROUND(SUM(fat_g), 1) AS fat_g, COUNT(*) AS items
FROM foodlog
WHERE deleted = 0
GROUP BY user_id, date;
