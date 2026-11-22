-- Flat, SQL-friendly views over the JSON sessions, for your own queries / spreadsheets.
--   SELECT * FROM v_sets WHERE exercise = 'Incline Bench Press' ORDER BY date;
-- Weights are kilograms.

CREATE OR REPLACE VIEW v_session_exercises AS
SELECT
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
LEFT JOIN exercises e ON e.id = ex.exercise_id COLLATE utf8mb4_unicode_ci AND e.deleted = 0
WHERE s.deleted = 0;

CREATE OR REPLACE VIEW v_sets AS
SELECT
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
LEFT JOIN exercises e ON e.id = x.exercise_id COLLATE utf8mb4_unicode_ci AND e.deleted = 0
WHERE s.deleted = 0 AND (x.reps IS NOT NULL OR x.weight_kg IS NOT NULL);
