-- Food tracking.
--   foods:   your food library (your own foods, plus USDA / Open Food Facts foods you have logged)
--   foodlog: what you ate, one row per food per meal. Nutrient totals are copied out of `data` for querying.
-- trust: verified (USDA lab data), checked (Open Food Facts, moderator-reviewed), community (Open Food Facts, not reviewed), yours.

CREATE TABLE foods (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  brand VARCHAR(255) NOT NULL DEFAULT '',
  source VARCHAR(16) NOT NULL DEFAULT '',
  trust VARCHAR(16) NOT NULL DEFAULT '',
  barcode VARCHAR(32) NULL,
  data JSON NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_foods_rev (rev),
  INDEX idx_foods_barcode (barcode)
);

CREATE TABLE foodlog (
  id VARCHAR(64) PRIMARY KEY,
  date DATE NULL,
  meal VARCHAR(16) NOT NULL DEFAULT '',
  name VARCHAR(255) NOT NULL DEFAULT '',
  source VARCHAR(16) NOT NULL DEFAULT '',
  trust VARCHAR(16) NOT NULL DEFAULT '',
  grams DECIMAL(9, 2) NULL,
  kcal DECIMAL(9, 2) NULL,
  protein_g DECIMAL(9, 2) NULL,
  carbs_g DECIMAL(9, 2) NULL,
  fat_g DECIMAL(9, 2) NULL,
  data JSON NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL,
  INDEX idx_foodlog_rev (rev),
  INDEX idx_foodlog_date (date)
);

-- Daily totals, e.g. SELECT * FROM v_daily_nutrition ORDER BY date DESC;
CREATE OR REPLACE VIEW v_daily_nutrition AS
SELECT date, ROUND(SUM(kcal)) AS kcal, ROUND(SUM(protein_g), 1) AS protein_g, ROUND(SUM(carbs_g), 1) AS carbs_g, ROUND(SUM(fat_g), 1) AS fat_g, COUNT(*) AS items
FROM foodlog
WHERE deleted = 0
GROUP BY date;
