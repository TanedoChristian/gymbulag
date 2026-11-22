// Table mapping + incremental sync (push with last-write-wins, pull by change number).
import { upsertClause } from './db.mjs';

const str = (v, max = 255) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const dateOrNull = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const json = (v) => JSON.stringify(v);
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/**
 * key:      the record's id field in the app
 * toDb:     app record -> column values (`id` + `updated_at` are required)
 * fromDb:   row -> app record
 * pageSize: rows per pull page
 */
export const TABLES = {
  sessions: {
    name: 'sessions',
    key: 'id',
    pageSize: 500,
    toDb: (r) => ({ id: str(r.id, 64), date: dateOrNull(r.date), name: str(r.name), data: json(r), created_at: num(r.createdAt), updated_at: num(r.updatedAt) }),
    fromDb: (row) => parse(row.data),
  },
  exercises: {
    name: 'exercises',
    key: 'id',
    pageSize: 1000,
    toDb: (r) => ({
      id: str(r.id, 64),
      name: str(r.name),
      muscle: str(r.muscle, 32),
      equipment: str(r.equipment, 32),
      custom: r.custom ? 1 : 0,
      archived: r.archived ? 1 : 0,
      data: json(r),
      updated_at: num(r.updatedAt),
    }),
    fromDb: (row) => parse(row.data),
  },
  activities: {
    name: 'activities',
    key: 'id',
    pageSize: 1000,
    toDb: (r) => ({
      id: str(r.id, 64),
      date: dateOrNull(r.date),
      kind: str(r.kind, 16),
      steps: Number.isFinite(Number(r.steps)) && r.steps != null ? Math.round(Number(r.steps)) : null,
      distance_km: Number.isFinite(Number(r.distance)) && r.distance != null ? Number(r.distance) : null,
      duration_min: Number.isFinite(Number(r.duration)) && r.duration != null ? Number(r.duration) : null,
      data: json(r),
      created_at: num(r.createdAt),
      updated_at: num(r.updatedAt),
    }),
    fromDb: (row) => parse(row.data),
  },
  foods: {
    name: 'foods',
    key: 'id',
    pageSize: 1000,
    toDb: (r) => ({
      id: str(r.id, 64),
      name: str(r.name),
      brand: str(r.brand),
      source: str(r.source, 16),
      trust: str(r.trust, 16),
      barcode: typeof r.barcode === 'string' && r.barcode ? str(r.barcode, 32) : null,
      data: json(r),
      created_at: num(r.createdAt),
      updated_at: num(r.updatedAt),
    }),
    fromDb: (row) => parse(row.data),
  },
  foodlog: {
    name: 'foodlog',
    key: 'id',
    pageSize: 1000,
    toDb: (r) => {
      const n = r.nutrients ?? {};
      const opt = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
      return {
        id: str(r.id, 64),
        date: dateOrNull(r.date),
        meal: str(r.meal, 16),
        name: str(r.name),
        source: str(r.source, 16),
        trust: str(r.trust, 16),
        grams: opt(r.grams),
        kcal: opt(n.kcal),
        protein_g: opt(n.protein),
        carbs_g: opt(n.carbs),
        fat_g: opt(n.fat),
        data: json(r),
        created_at: num(r.createdAt),
        updated_at: num(r.updatedAt),
      };
    },
    fromDb: (row) => parse(row.data),
  },
  templates: {
    name: 'templates',
    key: 'id',
    pageSize: 500,
    toDb: (r) => ({ id: str(r.id, 64), name: str(r.name), data: json(r), created_at: num(r.createdAt), updated_at: num(r.updatedAt) }),
    fromDb: (row) => parse(row.data),
  },
  settings: {
    name: 'settings',
    key: 'key',
    pageSize: 50,
    toDb: (r) => ({ id: str(r.key, 32), data: json(r), updated_at: num(r.updatedAt) }),
    fromDb: (row) => parse(row.data),
  },
  weights: {
    name: 'weights',
    key: 'date',
    pageSize: 1000,
    toDb: (r) => ({
      id: dateOrNull(r.date) ?? '',
      kg: Number.isFinite(Number(r.kg)) && r.kg != null ? Number(r.kg) : null,
      data: json(r),
      created_at: num(r.createdAt),
      updated_at: num(r.updatedAt),
    }),
    fromDb: (row) => parse(row.data),
  },
  photos: {
    name: 'photos',
    key: 'date',
    pageSize: 3, // Vercel caps responses at 4.5 MB
    toDb: (r) => ({
      id: dateOrNull(r.date) ?? '',
      mime: str(r.type, 64) || 'image/jpeg',
      image: Buffer.from(String(r.data ?? ''), 'base64'),
      thumb: Buffer.from(String(r.thumb ?? ''), 'base64'),
      width: num(r.width),
      height: num(r.height),
      created_at: num(r.createdAt),
      updated_at: num(r.updatedAt),
    }),
    fromDb: (row) => ({
      date: row.id,
      type: row.mime,
      data: Buffer.from(row.image ?? []).toString('base64'),
      thumb: Buffer.from(row.thumb ?? []).toString('base64'),
      width: row.width,
      height: row.height,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }),
  },
};

const TOMBSTONE = { sessions: { data: null }, exercises: { data: null }, templates: { data: null }, activities: { data: null }, foods: { data: null }, foodlog: { data: null }, weights: { data: null, kg: null }, settings: { data: null }, photos: { image: null, thumb: null } };

const q = (name) => `"${name}"`;

export async function currentRev(pool) {
  const { rows } = await pool.query('SELECT rev FROM sync_counter WHERE id = 1');
  return Number(rows[0]?.rev ?? 0);
}

export async function counts(pool, userId) {
  const parts = Object.keys(TABLES).map((t) => `(SELECT COUNT(*) FROM ${q(t)} WHERE user_id = $1 AND deleted = 0) AS ${q(t)}`);
  const { rows } = await pool.query(`SELECT ${parts.join(', ')}`, [userId]);
  return Object.fromEntries(Object.keys(TABLES).map((t) => [t, Number(rows[0][t])]));
}

/** One user's rows changed after `since`, oldest change first, one page at a time. */
export async function pullSince(pool, userId, table, since) {
  const { rows } = await pool.query(`SELECT * FROM ${q(table.name)} WHERE user_id = $1 AND rev > $2 ORDER BY rev LIMIT $3`, [userId, since, table.pageSize]);
  const out = { rows: [], deleted: [], rev: since, more: rows.length === table.pageSize };
  for (const row of rows) {
    out.rev = Math.max(out.rev, Number(row.rev));
    if (row.deleted) out.deleted.push(row.id);
    else out.rows.push(table.fromDb(row));
  }
  return out;
}

/**
 * Upsert / delete in one transaction. An incoming record older than the stored one
 * (by updatedAt) is rejected and the stored version is returned so the client can catch up.
 */
export async function applyChanges(pool, userId, table, upserts, deletes) {
  const accepted = [];
  const rejected = [];
  if (!upserts.length && !deletes.length) return { accepted, rejected, rev: await currentRev(pool) };

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const {
      rows: [counter],
    } = await conn.query('SELECT rev FROM sync_counter WHERE id = 1 FOR UPDATE');
    let rev = Number(counter.rev);

    const incoming = upserts.map((r) => table.toDb(r ?? {})).filter((c) => c.id);
    const ids = [...new Set([...incoming.map((c) => c.id), ...deletes])];
    const existing = new Map();
    if (ids.length) {
      const { rows } = await conn.query(`SELECT id, updated_at, deleted FROM ${q(table.name)} WHERE user_id = $1 AND id = ANY($2) FOR UPDATE`, [userId, ids]);
      for (const r of rows) existing.set(r.id, { updated: Number(r.updated_at), deleted: !!r.deleted });
    }

    const rejectedIds = [];
    for (const cols of incoming) {
      const cur = existing.get(cols.id);
      if (cur && cur.updated > cols.updated_at) {
        rejectedIds.push(cols.id);
        continue;
      }
      rev += 1;
      const row = { user_id: userId, ...cols, deleted: 0, rev };
      const names = Object.keys(row);
      await conn.query(
        `INSERT INTO ${q(table.name)} (${names.map(q).join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')})
         ${upsertClause(names.filter((n) => n !== 'id' && n !== 'user_id'))}`,
        names.map((n) => row[n]),
      );
      existing.set(cols.id, { updated: cols.updated_at, deleted: false });
      accepted.push(cols.id);
    }

    for (const id of deletes) {
      const cur = existing.get(id);
      if (!cur || cur.deleted) continue;
      rev += 1;
      const sets = Object.keys(TOMBSTONE[table.name])
        .map((c) => `${q(c)} = NULL`)
        .join(', ');
      await conn.query(`UPDATE ${q(table.name)} SET ${sets}, deleted = 1, rev = $1 WHERE user_id = $2 AND id = $3`, [rev, userId, id]);
      accepted.push(id);
    }

    await conn.query('UPDATE sync_counter SET rev = $1 WHERE id = 1', [rev]);
    if (rejectedIds.length) {
      const { rows } = await conn.query(`SELECT * FROM ${q(table.name)} WHERE user_id = $1 AND id = ANY($2)`, [userId, rejectedIds]);
      for (const row of rows) rejected.push(row.deleted ? { deleted: row.id } : { row: table.fromDb(row) });
    }
    await conn.query('COMMIT');
    return { accepted, rejected, rev };
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
