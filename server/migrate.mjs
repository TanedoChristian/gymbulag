#!/usr/bin/env node
// Minimal, ordered SQL migrations.
//   npm run db:migrate          Postgres (Supabase): server/migrations
//   npm run db:migrate:local    MySQL (local):       server/migrations-mysql
//   npm run db:status[:local]   list applied / pending
// Each file (NNN_name.sql) runs once, inside its own transaction (MySQL commits DDL on its own).
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { connect, dialect } from './db.mjs';
import { databaseLabel } from './config.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), dialect === 'mysql' ? 'migrations-mysql' : 'migrations');

// Migration files run exactly as written (no Postgres -> MySQL rewriting).
const runFile = (client, sql) => (client.raw ? client.raw(sql) : client.query(sql));
const when = (v) => (v instanceof Date ? v.toISOString() : String(v));

export async function listMigrations() {
  const files = (await readdir(DIR)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  return Promise.all(
    files.map(async (file) => {
      const sql = await readFile(path.join(DIR, file), 'utf8');
      return { version: Number(file.split('_')[0]), name: file, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

async function applied(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  if (dialect === 'postgres') await client.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');
  const { rows } = await client.query('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version');
  return new Map(rows.map((r) => [r.version, r]));
}

/** Apply every pending migration. Returns the names that were applied. */
export async function migrate({ log = console.log } = {}) {
  const client = await connect();
  const done = [];
  try {
    // One migrator at a time.
    if (dialect === 'postgres') await client.query('SELECT pg_advisory_lock(727001)');
    const have = await applied(client);
    for (const m of await listMigrations()) {
      const prev = have.get(m.version);
      if (prev) {
        if (prev.checksum !== m.checksum) log(`! ${m.name} was edited after it was applied — create a new migration instead.`);
        continue;
      }
      log(`→ applying ${m.name}`);
      await client.query('BEGIN');
      try {
        await runFile(client, m.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${m.name} failed: ${e.message}`);
      }
      done.push(m.name);
    }
    log(done.length ? `✓ ${done.length} migration(s) applied to ${databaseLabel()}` : `✓ ${databaseLabel()} is up to date`);
    return done;
  } finally {
    await client.end();
  }
}

async function status() {
  const client = await connect();
  try {
    const have = await applied(client);
    for (const m of await listMigrations()) {
      const a = have.get(m.version);
      console.log(`${a ? '✓' : '·'} ${m.name}${a ? `  (applied ${when(a.applied_at)})` : '  (pending)'}`);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (process.argv[2] === 'status' ? status() : migrate()).catch((e) => {
    console.error(`✗ ${e.message}`);
    if (e.code === '28P01') console.error('  Wrong password in DATABASE_URL');
    if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('  Check DB_USER / DB_PASSWORD in .env');
    if (e.code === 'ECONNREFUSED' && dialect === 'mysql') console.error('  Is MySQL running? (sudo service mysql start)');
    if (e.code === 'ENOTFOUND' || (e.code === 'ECONNREFUSED' && dialect === 'postgres')) console.error('  Check the host in DATABASE_URL (use Supabase\'s pooler URI if your network has no IPv6).');
    process.exit(1);
  });
}
