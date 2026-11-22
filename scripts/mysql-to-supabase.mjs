#!/usr/bin/env node
// One-time copy of an existing Gymbulag MySQL database into Postgres (Supabase).
//   npm run db:copy-mysql             copy everything (target must be empty)
//   npm run db:copy-mysql -- --dry    only count what would be copied
//
// Source: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / DB_SOCKET (your old MySQL settings)
// Target: DATABASE_URL (the schema is created first with the normal migrations)
//
// Everything is copied as-is (accounts, password hashes, device logins, all synced data and
// the sync change counter), so people stay logged in and devices carry on syncing.
import mysql from 'mysql2/promise';
import { connect } from '../server/db.mjs';
import { migrate } from '../server/migrate.mjs';
import { config, databaseLabel } from '../server/config.mjs';

const DRY = process.argv.includes('--dry');
const env = process.env;

// Parents first (auth_tokens references users).
const TABLES = ['users', 'auth_tokens', 'sessions', 'exercises', 'templates', 'settings', 'activities', 'foods', 'foodlog', 'weights', 'photos'];
const BATCH = { photos: 4 };
const JSON_COLS = new Set(['data']);

function log(s) {
  console.log(s);
}

async function main() {
  if (config.driver !== 'postgres') throw new Error('The target must be Postgres: set DATABASE_URL in .env and unset DB_DRIVER.');
  const source = await mysql.createConnection({
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USER ?? 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'gymbulag',
    socketPath: env.DB_SOCKET || undefined,
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: true,
  });
  log(`Source: MySQL ${env.DB_USER ?? 'root'}@${env.DB_HOST ?? '127.0.0.1'}/${env.DB_NAME ?? 'gymbulag'}`);
  log(`Target: ${databaseLabel()}`);

  const [present] = await source.query('SHOW TABLES');
  const have = new Set(present.map((r) => Object.values(r)[0]));
  const tables = TABLES.filter((t) => have.has(t));

  if (DRY) {
    for (const t of tables) {
      const [[{ n }]] = await source.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      log(`  ${t}: ${n} row(s)`);
    }
    await source.end();
    return;
  }

  await migrate({ log: (s) => log(`[migrate] ${s}`) });
  const target = await connect();
  try {
    for (const t of TABLES) {
      const { rows } = await target.query(`SELECT EXISTS (SELECT 1 FROM "${t}") AS used`);
      if (rows[0].used) throw new Error(`Target table "${t}" already has rows. This copy only runs into an empty database.`);
    }

    await target.query('BEGIN');
    for (const t of tables) {
      const { rows: colRows } = await target.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
        [t],
      );
      const targetCols = new Set(colRows.map((r) => r.column_name));
      const [[{ n }]] = await source.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      const size = BATCH[t] ?? 500;
      let copied = 0;
      for (let offset = 0; offset < n; offset += size) {
        const [rows] = await source.query(`SELECT * FROM \`${t}\` ORDER BY 1, 2 LIMIT ? OFFSET ?`, [size, offset]);
        if (!rows.length) break;
        const cols = Object.keys(rows[0]).filter((c) => targetCols.has(c));
        const values = [];
        const tuples = rows.map((row) => {
          const ph = cols.map((c) => {
            let v = row[c];
            if (JSON_COLS.has(c) && v != null && typeof v !== 'string') v = JSON.stringify(v);
            values.push(v);
            return `$${values.length}`;
          });
          return `(${ph.join(', ')})`;
        });
        const override = t === 'users' ? ' OVERRIDING SYSTEM VALUE' : '';
        await target.query(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(', ')})${override} VALUES ${tuples.join(', ')}`, values);
        copied += rows.length;
      }
      log(`  ✓ ${t}: ${copied} row(s)`);
    }

    // New accounts continue after the highest copied id.
    await target.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1), (SELECT COUNT(*) > 0 FROM users))`);
    // Keep the change counter ahead of every copied row so devices pick up new changes.
    let rev = 0;
    if (have.has('sync_counter')) {
      const [[row]] = await source.query('SELECT rev FROM sync_counter WHERE id = 1');
      rev = Number(row?.rev ?? 0);
    }
    for (const t of tables.filter((x) => x !== 'users' && x !== 'auth_tokens')) {
      const { rows } = await target.query(`SELECT COALESCE(MAX(rev), 0) AS m FROM "${t}"`);
      rev = Math.max(rev, Number(rows[0].m));
    }
    await target.query('UPDATE sync_counter SET rev = $1 WHERE id = 1', [rev]);
    await target.query('COMMIT');
    log(`✓ Done. Sync counter set to ${rev}.`);
  } catch (e) {
    await target.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await target.end();
    await source.end();
  }
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  if (e.code === 'ECONNREFUSED') console.error('  Is your MySQL running? (DB_HOST / DB_PORT in .env)');
  if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('  Check DB_USER / DB_PASSWORD in .env');
  process.exit(1);
});
