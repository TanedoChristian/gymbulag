-- Gymbulag schema for Postgres (Supabase).
-- Each data row mirrors one record of the app's on-device database and belongs to one user.
-- `data` holds the full record as JSON; a few columns are pulled out for querying.
-- `rev` is a global, ever-increasing change number used for incremental sync.
-- Deleted rows are kept as tombstones (deleted = 1) so other devices learn about the delete.
--
-- Row Level Security is switched on for every table with no policies. Only the server
-- (connecting as the database owner) can read or write; Supabase's public REST API sees nothing.

CREATE TABLE sync_counter (
  id SMALLINT PRIMARY KEY,
  rev BIGINT NOT NULL
);
INSERT INTO sync_counter (id, rev) VALUES (1, 0);

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  birth_date DATE NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE auth_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device VARCHAR(255) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  last_used_at BIGINT NOT NULL
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens (user_id);

CREATE TABLE sessions (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(64) NOT NULL,
  date DATE NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  data JSONB NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_sessions_user_rev ON sessions (user_id, rev);
CREATE INDEX idx_sessions_date ON sessions (date);

CREATE TABLE exercises (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  muscle VARCHAR(32) NOT NULL DEFAULT '',
  equipment VARCHAR(32) NOT NULL DEFAULT '',
  custom SMALLINT NOT NULL DEFAULT 0,
  archived SMALLINT NOT NULL DEFAULT 0,
  data JSONB NULL,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_exercises_user_rev ON exercises (user_id, rev);

CREATE TABLE templates (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  data JSONB NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_templates_user_rev ON templates (user_id, rev);

-- One progress photo per day; id is yyyy-MM-dd.
CREATE TABLE photos (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(10) NOT NULL,
  mime VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
  image BYTEA NULL,
  thumb BYTEA NULL,
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_photos_user_rev ON photos (user_id, rev);

CREATE TABLE settings (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(32) NOT NULL,
  data JSONB NULL,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_settings_user_rev ON settings (user_id, rev);

-- Walks and runs. Several per day, alongside gym sessions.
CREATE TABLE activities (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(64) NOT NULL,
  date DATE NULL,
  kind VARCHAR(16) NOT NULL DEFAULT '',
  steps INT NULL,
  distance_km NUMERIC(8, 3) NULL,
  duration_min NUMERIC(8, 2) NULL,
  data JSONB NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_activities_user_rev ON activities (user_id, rev);
CREATE INDEX idx_activities_date ON activities (date);

-- Food library. trust: verified (USDA), checked / community (Open Food Facts), yours.
CREATE TABLE foods (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  brand VARCHAR(255) NOT NULL DEFAULT '',
  source VARCHAR(16) NOT NULL DEFAULT '',
  trust VARCHAR(16) NOT NULL DEFAULT '',
  barcode VARCHAR(32) NULL,
  data JSONB NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_foods_user_rev ON foods (user_id, rev);
CREATE INDEX idx_foods_barcode ON foods (barcode);

-- What you ate, one row per food per meal.
CREATE TABLE foodlog (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(64) NOT NULL,
  date DATE NULL,
  meal VARCHAR(16) NOT NULL DEFAULT '',
  name VARCHAR(255) NOT NULL DEFAULT '',
  source VARCHAR(16) NOT NULL DEFAULT '',
  trust VARCHAR(16) NOT NULL DEFAULT '',
  grams NUMERIC(9, 2) NULL,
  kcal NUMERIC(9, 2) NULL,
  protein_g NUMERIC(9, 2) NULL,
  carbs_g NUMERIC(9, 2) NULL,
  fat_g NUMERIC(9, 2) NULL,
  data JSONB NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_foodlog_user_rev ON foodlog (user_id, rev);
CREATE INDEX idx_foodlog_date ON foodlog (date);

-- Daily body weight; id is yyyy-MM-dd.
CREATE TABLE weights (
  user_id BIGINT NOT NULL DEFAULT 0,
  id VARCHAR(10) NOT NULL,
  kg NUMERIC(6, 2) NULL,
  data JSONB NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted SMALLINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_weights_user_rev ON weights (user_id, rev);

ALTER TABLE sync_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods        ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodlog      ENABLE ROW LEVEL SECURITY;
ALTER TABLE weights      ENABLE ROW LEVEL SECURITY;

-- Reporting views, per user:  SELECT * FROM v_sets WHERE user_id = 1 AND exercise = 'Bench Press';
-- security_invoker keeps the views behind the same RLS as their tables. Weights are kilograms.
CREATE VIEW v_session_exercises WITH (security_invoker = true) AS
SELECT
  s.user_id,
  s.id AS session_id,
  s.date,
  s.name AS session_name,
  ex.position AS exercise_order,
  ex.item ->> 'exerciseId' AS exercise_id,
  COALESCE(e.name, ex.item ->> 'exerciseId') AS exercise,
  e.muscle,
  ex.item ->> 'unit' AS input_unit,
  ex.item ->> 'notes' AS notes
FROM sessions s
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.data -> 'exercises', '[]'::jsonb)) WITH ORDINALITY AS ex(item, position)
LEFT JOIN exercises e ON e.user_id = s.user_id AND e.id = ex.item ->> 'exerciseId' AND e.deleted = 0
WHERE s.deleted = 0;

CREATE OR REPLACE FUNCTION gymbulag_num(v jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(v) = 'number' THEN (v #>> '{}')::numeric END
$$;

CREATE VIEW v_sets WITH (security_invoker = true) AS
SELECT
  x.user_id, x.session_id, x.date, x.session_name, x.exercise_order, x.exercise, x.muscle,
  x.set_number, x.set_type, x.weight_kg,
  ROUND(x.weight_kg * 2.20462, 1) AS weight_lb,
  x.reps, x.rpe,
  ROUND(x.weight_kg * x.reps, 2) AS volume_kg,
  CASE WHEN x.reps = 1 THEN x.weight_kg
       WHEN x.reps BETWEEN 2 AND 12 THEN ROUND(x.weight_kg * (1 + x.reps / 30.0), 1) END AS e1rm_kg
FROM (
  SELECT
    s.user_id,
    s.id AS session_id,
    s.date,
    s.name AS session_name,
    ex.position AS exercise_order,
    COALESCE(e.name, ex.item ->> 'exerciseId') AS exercise,
    e.muscle,
    st.set_number,
    st.item ->> 'type' AS set_type,
    gymbulag_num(st.item -> 'weight') AS weight_kg,
    gymbulag_num(st.item -> 'reps')::int AS reps,
    gymbulag_num(st.item -> 'rpe') AS rpe
  FROM sessions s
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.data -> 'exercises', '[]'::jsonb)) WITH ORDINALITY AS ex(item, position)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ex.item -> 'sets', '[]'::jsonb)) WITH ORDINALITY AS st(item, set_number)
  LEFT JOIN exercises e ON e.user_id = s.user_id AND e.id = ex.item ->> 'exerciseId' AND e.deleted = 0
  WHERE s.deleted = 0
) x
WHERE x.reps IS NOT NULL OR x.weight_kg IS NOT NULL;

CREATE VIEW v_daily_nutrition WITH (security_invoker = true) AS
SELECT user_id, date, ROUND(SUM(kcal)) AS kcal, ROUND(SUM(protein_g), 1) AS protein_g, ROUND(SUM(carbs_g), 1) AS carbs_g, ROUND(SUM(fat_g), 1) AS fat_g, COUNT(*) AS items
FROM foodlog
WHERE deleted = 0
GROUP BY user_id, date;
