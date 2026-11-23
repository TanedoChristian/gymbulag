// Admin panel, gym communities and gym-owner dashboards.
//   Admins:      manage every account (activate / inactivate / block), create communities, hand out owner access.
//   Gym owners:  see the communities they were given, track their members, block / unblock them.
//   Everyone:    join a community by scanning its QR code (/join/<code>), see and leave their communities.
import { randomBytes } from 'node:crypto';
import { AuthError } from './auth.mjs';
import { routeAdmin } from './admin.mjs';
import { dialect, isDuplicate } from './db.mjs';

const MEMBER_STATUSES = ['active', 'blocked'];
const DAY = 24 * 3600 * 1000;

const fail = (status, message) => {
  throw new AuthError(status, message);
};

const newJoinCode = () => randomBytes(9).toString('base64url');
const isCode = (s) => /^[A-Za-z0-9_-]{6,32}$/.test(String(s ?? ''));

function requireAdmin(auth) {
  if (auth.user.role !== 'admin') fail(403, 'Admins only');
}

function checkId(v, what = 'id') {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) fail(400, `Invalid ${what}`);
  return n;
}

function checkText(v, label, max, { required = false } = {}) {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (required && !s) fail(400, `Enter a ${label}`);
  if (s.length > max) fail(400, `The ${label} is too long`);
  return s;
}

/** yyyy-MM-dd, n days ago (server's local date). */
function daysAgoKey(n) {
  const d = new Date(Date.now() - n * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function insertId(pool, sql, params) {
  const res = await pool.query(dialect === 'postgres' ? `${sql} RETURNING id` : sql, params);
  return Number(dialect === 'postgres' ? res.rows[0].id : res.insertId);
}

/* -------------------------------------------------------------- shapes */

const COMMUNITY_COLUMNS = `c.*,
  (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'active') AS members,
  (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'blocked') AS blocked,
  (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'active' AND m.joined_at >= $1) AS joined_week`;

function communityOut(row, owners = []) {
  return {
    id: Number(row.id),
    name: row.name,
    location: row.location,
    joinCode: row.join_code,
    active: Number(row.active) === 1,
    createdAt: Number(row.created_at),
    members: Number(row.members ?? 0),
    blocked: Number(row.blocked ?? 0),
    joinedThisWeek: Number(row.joined_week ?? 0),
    owners,
  };
}

async function ownersByCommunity(pool) {
  const { rows } = await pool.query('SELECT o.community_id, u.id, u.name, u.email FROM community_owners o JOIN users u ON u.id = o.user_id ORDER BY o.granted_at');
  const map = new Map();
  for (const r of rows) {
    const list = map.get(Number(r.community_id)) ?? [];
    list.push({ id: Number(r.id), name: r.name, email: r.email });
    map.set(Number(r.community_id), list);
  }
  return map;
}

async function loadCommunity(pool, id) {
  const {
    rows: [row],
  } = await pool.query(`SELECT ${COMMUNITY_COLUMNS} FROM communities c WHERE c.id = $2`, [Date.now() - 7 * DAY, id]);
  if (!row) fail(404, 'Community not found');
  return row;
}

/** Admins manage every community; owners only the ones they were given. */
async function requireManager(pool, auth, communityId) {
  if (auth.user.role === 'admin') return;
  const { rowCount } = await pool.query('SELECT 1 FROM community_owners WHERE community_id = $1 AND user_id = $2', [communityId, auth.user.id]);
  if (!rowCount) fail(403, "You don't manage this community");
}

/* --------------------------------------------------------------- admin */

async function adminCommunities(pool) {
  const { rows } = await pool.query(`SELECT ${COMMUNITY_COLUMNS} FROM communities c ORDER BY c.created_at DESC`, [Date.now() - 7 * DAY]);
  const owners = await ownersByCommunity(pool);
  return { communities: rows.map((r) => communityOut(r, owners.get(Number(r.id)))) };
}

async function adminCreateCommunity(pool, auth, body) {
  const name = checkText(body.name, 'name', 120, { required: true });
  const location = checkText(body.location, 'location', 255);
  const now = Date.now();
  const id = await insertId(pool, 'INSERT INTO communities (name, location, join_code, active, created_by, created_at, updated_at) VALUES ($1, $2, $3, 1, $4, $5, $6)', [
    name,
    location,
    newJoinCode(),
    auth.user.id,
    now,
    now,
  ]);
  return { community: communityOut(await loadCommunity(pool, id)) };
}

async function adminUpdateCommunity(pool, body) {
  const id = checkId(body.id, 'community');
  const cur = await loadCommunity(pool, id);
  const name = body.name === undefined ? cur.name : checkText(body.name, 'name', 120, { required: true });
  const location = body.location === undefined ? cur.location : checkText(body.location, 'location', 255);
  const active = body.active === undefined ? Number(cur.active) : body.active ? 1 : 0;
  const joinCode = body.regenerateCode ? newJoinCode() : cur.join_code;
  await pool.query('UPDATE communities SET name = $1, location = $2, active = $3, join_code = $4, updated_at = $5 WHERE id = $6', [name, location, active, joinCode, Date.now(), id]);
  const owners = await ownersByCommunity(pool);
  return { community: communityOut(await loadCommunity(pool, id), owners.get(id)) };
}

async function adminDeleteCommunity(pool, body) {
  const id = checkId(body.id, 'community');
  const res = await pool.query('DELETE FROM communities WHERE id = $1', [id]);
  if (!res.rowCount) fail(404, 'Community not found');
  return { ok: true };
}

async function adminAddOwner(pool, body) {
  const communityId = checkId(body.communityId, 'community');
  await loadCommunity(pool, communityId);
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) fail(400, "Enter the gym owner's email");
  const {
    rows: [user],
  } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!user) fail(404, 'No account with that email. Ask them to sign up first, then add them.');
  try {
    await pool.query('INSERT INTO community_owners (community_id, user_id, granted_at) VALUES ($1, $2, $3)', [communityId, user.id, Date.now()]);
  } catch (e) {
    if (!isDuplicate(e)) throw e;
  }
  const owners = await ownersByCommunity(pool);
  return { community: communityOut(await loadCommunity(pool, communityId), owners.get(communityId)) };
}

async function adminRemoveOwner(pool, body) {
  const communityId = checkId(body.communityId, 'community');
  const userId = checkId(body.userId, 'user');
  await pool.query('DELETE FROM community_owners WHERE community_id = $1 AND user_id = $2', [communityId, userId]);
  const owners = await ownersByCommunity(pool);
  return { community: communityOut(await loadCommunity(pool, communityId), owners.get(communityId)) };
}

/* ---------------------------------------------------------- gym owners */

async function ownedCommunities(pool, auth) {
  const { rows } = await pool.query(
    `SELECT ${COMMUNITY_COLUMNS} FROM communities c JOIN community_owners o ON o.community_id = c.id WHERE o.user_id = $2 ORDER BY c.name`,
    [Date.now() - 7 * DAY, auth.user.id],
  );
  return { communities: rows.map((r) => communityOut(r)) };
}

async function communityMembers(pool, auth, communityId) {
  await requireManager(pool, auth, communityId);
  const community = await loadCommunity(pool, communityId);
  const { rows } = await pool.query(
    `SELECT m.user_id, m.status, m.joined_at, m.blocked_at, u.name, u.email, u.status AS account_status,
       (SELECT MAX(t.last_used_at) FROM auth_tokens t WHERE t.user_id = u.id) AS last_seen,
       (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.deleted = 0 AND s.date >= $2) AS sessions30,
       (SELECT MAX(s.date) FROM sessions s WHERE s.user_id = u.id AND s.deleted = 0) AS last_workout
     FROM community_members m JOIN users u ON u.id = m.user_id
     WHERE m.community_id = $1
     ORDER BY m.joined_at DESC`,
    [communityId, daysAgoKey(30)],
  );
  return {
    community: communityOut(community),
    members: rows.map((r) => ({
      userId: Number(r.user_id),
      name: r.name,
      email: r.email,
      status: r.status,
      accountStatus: r.account_status,
      joinedAt: Number(r.joined_at),
      blockedAt: r.blocked_at == null ? null : Number(r.blocked_at),
      lastSeen: r.last_seen == null ? null : Number(r.last_seen),
      sessions30: Number(r.sessions30 ?? 0),
      lastWorkout: r.last_workout ?? null,
    })),
  };
}

async function setMemberStatus(pool, auth, communityId, body) {
  await requireManager(pool, auth, communityId);
  const userId = checkId(body.userId, 'user');
  const status = String(body.status ?? '');
  if (!MEMBER_STATUSES.includes(status)) fail(400, 'Invalid status');
  const blocked = status === 'blocked';
  const res = await pool.query('UPDATE community_members SET status = $1, blocked_at = $2, blocked_by = $3 WHERE community_id = $4 AND user_id = $5', [
    status,
    blocked ? Date.now() : null,
    blocked ? auth.user.id : null,
    communityId,
    userId,
  ]);
  if (!res.rowCount) fail(404, "That person isn't in this community");
  return { ok: true };
}

/* ------------------------------------------------------------- members */

async function findByCode(pool, code) {
  if (!isCode(code)) fail(404, "This QR code isn't valid");
  const {
    rows: [row],
  } = await pool.query('SELECT * FROM communities WHERE join_code = $1', [code]);
  if (!row) fail(404, 'This QR code is no longer valid. Ask the gym for the current one.');
  return row;
}

async function membership(pool, communityId, userId) {
  const {
    rows: [m],
  } = await pool.query('SELECT status FROM community_members WHERE community_id = $1 AND user_id = $2', [communityId, userId]);
  return m?.status ?? null;
}

async function previewJoin(pool, auth, code) {
  const c = await findByCode(pool, code);
  return { community: { id: Number(c.id), name: c.name, location: c.location, active: Number(c.active) === 1 }, membership: await membership(pool, c.id, auth.user.id) };
}

async function join(pool, auth, body) {
  const c = await findByCode(pool, String(body.code ?? ''));
  const community = { id: Number(c.id), name: c.name, location: c.location };
  const status = await membership(pool, c.id, auth.user.id);
  if (status === 'blocked') fail(403, `You can't join ${c.name}. Talk to the gym if you think this is a mistake.`);
  if (status === 'active') return { community, alreadyMember: true };
  if (Number(c.active) !== 1) fail(410, `${c.name} isn't accepting new members right now.`);
  try {
    await pool.query("INSERT INTO community_members (community_id, user_id, status, joined_at) VALUES ($1, $2, 'active', $3)", [c.id, auth.user.id, Date.now()]);
  } catch (e) {
    // Scanned twice at once.
    if (!isDuplicate(e)) throw e;
  }
  return { community, alreadyMember: false };
}

async function myCommunities(pool, auth) {
  const { rows } = await pool.query(
    "SELECT c.id, c.name, c.location, c.active, m.joined_at FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = $1 AND m.status = 'active' ORDER BY m.joined_at DESC",
    [auth.user.id],
  );
  return { communities: rows.map((r) => ({ id: Number(r.id), name: r.name, location: r.location, active: Number(r.active) === 1, joinedAt: Number(r.joined_at) })) };
}

async function leave(pool, auth, body) {
  const id = checkId(body.id, 'community');
  // Blocked rows stay, so leaving can't be used to get around a block.
  await pool.query("DELETE FROM community_members WHERE community_id = $1 AND user_id = $2 AND status = 'active'", [id, auth.user.id]);
  return { ok: true };
}

/* -------------------------------------------------------------- router */

/**
 * Handles the community / admin endpoints. Returns the response body, or undefined when the path isn't one of these.
 * `body()` reads the JSON request body.
 */
export async function routeCommunity(pool, auth, req, url, body) {
  const p = url.pathname;
  const get = req.method === 'GET';
  const post = req.method === 'POST';

  // Everyone
  if (p === '/api/communities/mine' && get) return myCommunities(pool, auth);
  if (p === '/api/communities/leave' && post) return leave(pool, auth, await body());
  if (p === '/api/communities/join' && post) return join(pool, auth, await body());
  const preview = p.match(/^\/api\/communities\/join\/([^/]+)$/);
  if (preview && get) return previewJoin(pool, auth, decodeURIComponent(preview[1]));

  // Gym owners (and admins)
  if (p === '/api/owner/communities' && get) return ownedCommunities(pool, auth);
  const members = p.match(/^\/api\/communities\/(\d+)\/members(\/status)?$/);
  if (members) {
    const id = checkId(members[1], 'community');
    if (!members[2] && get) return communityMembers(pool, auth, id);
    if (members[2] && post) return setMemberStatus(pool, auth, id, await body());
  }

  // Admins
  if (!p.startsWith('/api/admin/')) return undefined;
  requireAdmin(auth);
  const admin = await routeAdmin(pool, auth, req, url, body);
  if (admin !== undefined) return admin;
  if (p === '/api/admin/communities' && get) return adminCommunities(pool);
  if (p === '/api/admin/communities' && post) return adminCreateCommunity(pool, auth, await body());
  if (p === '/api/admin/communities/update' && post) return adminUpdateCommunity(pool, await body());
  if (p === '/api/admin/communities/delete' && post) return adminDeleteCommunity(pool, await body());
  if (p === '/api/admin/communities/owners/add' && post) return adminAddOwner(pool, await body());
  if (p === '/api/admin/communities/owners/remove' && post) return adminRemoveOwner(pool, await body());
  return undefined;
}
