// Builds public/foods/usda.json from the USDA FoodData Central "SR Legacy" CSV download.
//   1. Download https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip and unzip it
//   2. node scripts/build-usda-foods.mjs <path to the unzipped folder>
// USDA FoodData Central data is public domain (CC0).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/build-usda-foods.mjs <unzipped SR Legacy CSV folder>');
  process.exit(1);
}

function parseCSV(file) {
  const text = readFileSync(path.join(dir, file), 'utf8');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const NUTRIENTS = { 1008: 'kcal', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber' };
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const categories = parseCSV('food_category.csv');
const catIndex = new Map(categories.map((c, i) => [c.id, i]));
const units = new Map(parseCSV('measure_unit.csv').map((u) => [u.id, u.name]));

const values = new Map();
for (const n of parseCSV('food_nutrient.csv')) {
  const key = NUTRIENTS[n.nutrient_id];
  if (!key) continue;
  const v = values.get(n.fdc_id) ?? {};
  v[key] = Number(n.amount);
  values.set(n.fdc_id, v);
}

const portions = new Map();
for (const p of parseCSV('food_portion.csv')) {
  const grams = Number(p.gram_weight);
  if (!(grams > 0)) continue;
  const unit = units.get(p.measure_unit_id);
  const label = [p.amount && Number(p.amount) !== 0 ? round(Number(p.amount), 2) : '', unit && unit !== 'undetermined' ? unit : '', p.portion_description, p.modifier]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!label) continue;
  const list = portions.get(p.fdc_id) ?? [];
  list.push([label.slice(0, 60), round(grams, 1)]);
  portions.set(p.fdc_id, list);
}

const foods = [];
let skipped = 0;
for (const f of parseCSV('food.csv')) {
  const v = values.get(f.fdc_id);
  // Only foods with a measured energy value; nothing is estimated here.
  if (!v || v.kcal == null) {
    skipped++;
    continue;
  }
  foods.push([
    Number(f.fdc_id),
    f.description,
    catIndex.get(f.food_category_id) ?? -1,
    round(v.kcal, 0),
    round(v.protein ?? 0),
    round(v.carbs ?? 0),
    round(v.fat ?? 0),
    v.fiber == null ? null : round(v.fiber),
    (portions.get(f.fdc_id) ?? []).slice(0, 6),
  ]);
}

const out = {
  source: 'USDA FoodData Central, SR Legacy (April 2018)',
  license: 'Public domain (CC0 1.0)',
  url: 'https://fdc.nal.usda.gov/',
  fields: ['fdcId', 'name', 'category', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'portions'],
  per: '100 g',
  categories: categories.map((c) => c.description),
  foods,
};
const target = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'foods', 'usda.json');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(out));
console.log(`${foods.length} foods written to ${target} (${skipped} skipped without an energy value)`);
