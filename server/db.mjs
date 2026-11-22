// Database access for Postgres (Supabase, production) and MySQL (local development).
// The server's SQL is written for Postgres ($1 placeholders, "quoted" identifiers, = ANY($n));
// on MySQL the adapter below rewrites it, and the few real differences go through the helpers here.
// Both return pg-style results: { rows, rowCount } (plus insertId on MySQL).
import pg from 'pg';
import { config } from './config.mjs';

export const dialect = config.driver;

// BIGINT millisecond timestamps / ids as JS numbers, and DATE columns as plain 'yyyy-MM-dd' strings.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

/* -------------------------------------------------------------- postgres */

function pgOptions(extra = {}) {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set. Add your Supabase connection string to .env (see .env.example).');
  return {
    connectionString: config.databaseUrl,
    // Supabase requires TLS; its certificate chain isn't in Node's default CA list.
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
    ...extra,
  };
}

/* ----------------------------------------------------------------- mysql */

let mysqlLib;
async function mysql() {
  // Only needed locally, so it's a dev dependency and loaded on demand.
  mysqlLib ??= (await import('mysql2/promise')).default;
  return mysqlLib;
}

const mysqlBase = () => ({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  socketPath: config.mysql.socketPath,
  // Keep BIGINT millisecond timestamps as JS numbers.
  supportBigNumbers: true,
  bigNumberStrings: false,
  dateStrings: true,
});

/** Postgres-flavoured SQL -> MySQL. */
export function toMysql(sql, params = []) {
  const values = [];
  const out = sql
    .replace(/=\s*ANY\(\$(\d+)\)/g, 'IN ($$$1)')
    .replace(/\$(\d+)/g, (_, n) => {
      values.push(params[Number(n) - 1]);
      return '?';
    })
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, '`$1`');
  return [out, values];
}

function wrapMysql(conn) {
  return {
    async query(sql, params) {
      const [s, p] = toMysql(sql, params);
      const [res] = await conn.query(s, p);
      if (Array.isArray(res)) return { rows: res, rowCount: res.length };
      return { rows: [], rowCount: res?.affectedRows ?? 0, insertId: res?.insertId };
    },
    /** Run SQL exactly as written (migration files). */
    raw: (sql) => conn.query(sql),
  };
}

/* ------------------------------------------------------------------ api */

/** A pool. On Vercel each function instance keeps a small one; Supabase's pooler does the real pooling. */
export function createPool() {
  if (dialect === 'postgres') {
    const pool = new pg.Pool(pgOptions({ max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 }));
    pool.on('error', (e) => console.error('[db] idle client error', e.message));
    return pool;
  }
  let poolPromise;
  const getPool = () => (poolPromise ??= mysql().then((m) => m.createPool({ ...mysqlBase(), database: config.mysql.database, connectionLimit: 5 })));
  return {
    async query(sql, params) {
      return wrapMysql(await getPool()).query(sql, params);
    },
    async connect() {
      const conn = await (await getPool()).getConnection();
      return { ...wrapMysql(conn), release: () => conn.release() };
    },
    async end() {
      if (poolPromise) await (await poolPromise).end();
    },
  };
}

/** One connection (used by migrations). Allows several statements per query. */
export async function connect() {
  if (dialect === 'postgres') {
    const client = new pg.Client(pgOptions());
    await client.connect();
    return client;
  }
  const m = await mysql();
  // Make sure the database exists (skipped if the user may not create it).
  try {
    const c = await m.createConnection(mysqlBase());
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await c.end();
  } catch {
    /* fall through: connecting below reports the real problem */
  }
  const conn = await m.createConnection({ ...mysqlBase(), database: config.mysql.database, multipleStatements: true });
  return { ...wrapMysql(conn), end: () => conn.end() };
}

/** Run fn(client) inside a transaction. */
export async function transaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** "Insert, or update these columns if (user_id, id) already exists". */
export function upsertClause(columns) {
  if (dialect === 'postgres') return `ON CONFLICT (user_id, id) DO UPDATE SET ${columns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')}`;
  return `ON DUPLICATE KEY UPDATE ${columns.map((c) => `"${c}" = VALUES("${c}")`).join(', ')}`;
}

/** Unique-constraint violation. */
export const isDuplicate = (e) => e?.code === '23505' || e?.code === 'ER_DUP_ENTRY';

/** Hold an exclusive lock on the users table for the rest of the transaction (serialises sign-ups). */
export async function lockUsers(client) {
  if (dialect === 'postgres') await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
  else await client.query('SELECT COUNT(*) AS n FROM users FOR UPDATE');
}
