// Admin panel: overview numbers, account management and login activity.
// Community management lives in community.mjs; both are only reachable by admins (see routeAdmin).
import { config } from './config.mjs';
import { AuthError, checkBirthDate, checkEmail, checkName, checkPassword, hashPassword, isAdminRow, normalizeEmail } from './auth.mjs';
import { isDuplicate } from './db.mjs';
import { checkProfile, profileOut, PROFILE_COLUMNS, saveAvatar, saveProfile } from './profile.mjs';

const ACCOUNT_STATUSES = ['active', 'inactive', 'blocked'];
const ROLES = ['user', 'admin'];
const DAY = 24 * 3600 * 1000;

const fail = (status, message) => {
  throw new AuthError(status, message);
};

function checkId(v, what = 'id') {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) fail(400, `Invalid ${what}`);
  return n;
}

const num = (v) => (v == null ? null : Number(v));
const inEnv = (email) => config.adminEmails.includes(String(email).toLowerCase());

/** Where someone's admin rights come from: ADMIN_EMAILS ('env'), their stored role ('role'), or nowhere. */
const adminSource = (row) => (inEnv(row.email) ? 'env' : row.role === 'admin' ? 'role' : null);

function userOut(r) {
  return {
    id: Number(r.id),
    email: r.email,
    name: r.name,
    birthDate: r.birth_date,
    role: isAdminRow(r) ? 'admin' : 'user',
    adminSource: adminSource(r),
    status: r.status,
    createdAt: Number(r.created_at),
    updatedAt: num(r.updated_at),
    statusChangedAt: num(r.status_changed_at),
    lastSeen: num(r.last_seen),
    communities: Number(r.communities ?? 0),
    owned: Number(r.owned ?? 0),
    devices: Number(r.devices ?? 0),
    ...profileOut(r),
  };
}

const USER_LIST_COLUMNS = `u.id, u.email, u.name, u.birth_date, u.role, u.status, u.created_at, u.updated_at, u.status_changed_at, ${PROFILE_COLUMNS},
  (SELECT MAX(t.last_used_at) FROM auth_tokens t WHERE t.user_id = u.id) AS last_seen,
  (SELECT COUNT(*) FROM auth_tokens t WHERE t.user_id = u.id) AS devices,
  (SELECT COUNT(*) FROM community_members m WHERE m.user_id = u.id AND m.status = 'active') AS communities,
  (SELECT COUNT(*) FROM community_owners o WHERE o.user_id = u.id) AS owned`;

async function loadUserRow(pool, id) {
  const {
    rows: [row],
  } = await pool.query(`SELECT ${USER_LIST_COLUMNS} FROM users u WHERE u.id = $1`, [id]);
  if (!row) fail(404, 'User not found');
  return row;
}

function loginOut(r) {
  return {
    id: Number(r.id),
    userId: num(r.user_id),
    name: r.name ?? null,
    email: r.email,
    success: Number(r.success) === 1,
    reason: r.reason,
    portal: r.portal,
    ip: r.ip,
    userAgent: r.user_agent,
    at: Number(r.created_at),
  };
}

/* ------------------------------------------------------------- overview */

async function overview(pool) {
  const now = Date.now();
  const one = async (sql, params = []) => Number(Object.values((await pool.query(sql, params)).rows[0] ?? {})[0] ?? 0);
  const { rows: statusRows } = await pool.query('SELECT status, COUNT(*) AS n FROM users GROUP BY status');
  const { rows: roleRows } = await pool.query('SELECT email, role FROM users WHERE role = $1', ['admin']);
  const admins = new Set([...roleRows.map((r) => r.email.toLowerCase()), ...config.adminEmails]);
  const { rows: recentUsers } = await pool.query(`SELECT ${USER_LIST_COLUMNS} FROM users u ORDER BY u.created_at DESC LIMIT 5`);
  const { rows: recentFails } = await pool.query(
    'SELECT e.*, u.name FROM login_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.success = 0 ORDER BY e.created_at DESC LIMIT 6',
  );
  // Sign-ins per day for the last 14 days (bucketed here, so it works the same on both databases).
  const { rows: recent } = await pool.query('SELECT success, created_at FROM login_events WHERE created_at >= $1', [now - 14 * DAY]);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    days.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, ok: 0, failed: 0 });
  }
  const index = new Map(days.map((d, i) => [d.date, i]));
  for (const r of recent) {
    const d = new Date(Number(r.created_at));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const i = index.get(key);
    if (i != null) days[i][Number(r.success) === 1 ? 'ok' : 'failed']++;
  }
  const byStatus = Object.fromEntries(ACCOUNT_STATUSES.map((s) => [s, Number(statusRows.find((r) => r.status === s)?.n ?? 0)]));
  return {
    users: {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      ...byStatus,
      admins: admins.size,
      owners: await one('SELECT COUNT(DISTINCT user_id) AS n FROM community_owners'),
      newThisWeek: await one('SELECT COUNT(*) AS n FROM users WHERE created_at >= $1', [now - 7 * DAY]),
      activeToday: await one('SELECT COUNT(DISTINCT user_id) AS n FROM auth_tokens WHERE last_used_at >= $1', [now - DAY]),
    },
    communities: {
      total: await one('SELECT COUNT(*) AS n FROM communities'),
      active: await one('SELECT COUNT(*) AS n FROM communities WHERE active = 1'),
      members: await one("SELECT COUNT(*) AS n FROM community_members WHERE status = 'active'"),
    },
    logins: {
      today: days[days.length - 1].ok,
      failedToday: days[days.length - 1].failed,
      days,
    },
    recentUsers: recentUsers.map(userOut),
    recentFailures: recentFails.map(loginOut),
  };
}

/* ---------------------------------------------------------------- users */

async function listUsers(pool, q) {
  const term = String(q ?? '').trim().toLowerCase().slice(0, 100);
  const params = [];
  let where = '';
  if (term) {
    params.push(`%${term}%`);
    where = 'WHERE LOWER(u.email) LIKE $1 OR LOWER(u.name) LIKE $1';
  }
  const { rows } = await pool.query(`SELECT ${USER_LIST_COLUMNS} FROM users u ${where} ORDER BY u.created_at DESC LIMIT 2000`, params);
  return { users: rows.map(userOut) };
}

async function userDetail(pool, id) {
  const user = userOut(await loadUserRow(pool, id));
  const { rows: devices } = await pool.query('SELECT token_hash, device, created_at, last_used_at FROM auth_tokens WHERE user_id = $1 ORDER BY last_used_at DESC', [id]);
  const { rows: logins } = await pool.query('SELECT e.*, NULL AS name FROM login_events e WHERE e.user_id = $1 ORDER BY e.created_at DESC LIMIT 25', [id]);
  const { rows: memberships } = await pool.query(
    'SELECT c.id, c.name, c.active, m.status, m.joined_at FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = $1 ORDER BY m.joined_at DESC',
    [id],
  );
  const { rows: owned } = await pool.query('SELECT c.id, c.name, c.active FROM community_owners o JOIN communities c ON c.id = o.community_id WHERE o.user_id = $1 ORDER BY c.name', [id]);
  const { rows: workouts } = await pool.query('SELECT COUNT(*) AS n, MAX(date) AS last FROM sessions WHERE user_id = $1 AND deleted = 0', [id]);
  return {
    user,
    devices: devices.map((d) => ({
      id: d.token_hash,
      device: d.device,
      admin: String(d.device).startsWith('admin · '),
      createdAt: Number(d.created_at),
      lastUsedAt: Number(d.last_used_at),
    })),
    logins: logins.map(loginOut),
    memberships: memberships.map((m) => ({ id: Number(m.id), name: m.name, active: Number(m.active) === 1, status: m.status, joinedAt: Number(m.joined_at) })),
    owned: owned.map((c) => ({ id: Number(c.id), name: c.name, active: Number(c.active) === 1 })),
    workouts: { total: Number(workouts[0]?.n ?? 0), last: workouts[0]?.last ?? null },
  };
}

async function updateUser(pool, body) {
  const id = checkId(body.userId, 'user');
  const cur = await loadUserRow(pool, id);
  const name = body.name === undefined ? cur.name : checkName(body.name);
  const birthDate = body.birthDate === undefined ? cur.birth_date : checkBirthDate(body.birthDate);
  let email = cur.email;
  if (body.email !== undefined) {
    email = normalizeEmail(body.email);
    checkEmail(email);
  }
  const profile = checkProfile(body, cur);
  try {
    await pool.query('UPDATE users SET name = $1, email = $2, birth_date = $3, updated_at = $4 WHERE id = $5', [name, email, birthDate, Date.now(), id]);
    await saveProfile(pool, id, profile);
  } catch (e) {
    if (isDuplicate(e)) fail(409, 'Another account already uses that email');
    throw e;
  }
  return { user: userOut(await loadUserRow(pool, id)) };
}

async function setRole(pool, auth, body) {
  const id = checkId(body.userId, 'user');
  const role = String(body.role ?? '');
  if (!ROLES.includes(role)) fail(400, 'Invalid role');
  if (id === auth.user.id) fail(400, "You can't change your own role");
  const cur = await loadUserRow(pool, id);
  if (role === 'user' && inEnv(cur.email)) fail(400, 'This admin is set in ADMIN_EMAILS on the server. Remove the email there to demote them.');
  await pool.query('UPDATE users SET role = $1, updated_at = $2 WHERE id = $3', [role, Date.now(), id]);
  // A demoted admin loses any open admin-panel sessions straight away.
  if (role === 'user') await pool.query("DELETE FROM auth_tokens WHERE user_id = $1 AND device LIKE 'admin · %'", [id]);
  return { user: userOut(await loadUserRow(pool, id)) };
}

async function setStatus(pool, auth, body) {
  const id = checkId(body.userId, 'user');
  const status = String(body.status ?? '');
  if (!ACCOUNT_STATUSES.includes(status)) fail(400, 'Invalid status');
  if (id === auth.user.id) fail(400, "You can't change your own account's status");
  const res = await pool.query('UPDATE users SET status = $1, status_changed_at = $2 WHERE id = $3', [status, Date.now(), id]);
  if (!res.rowCount) fail(404, 'User not found');
  // Signed-in devices are logged out straight away.
  if (status !== 'active') await pool.query('DELETE FROM auth_tokens WHERE user_id = $1', [id]);
  return { user: userOut(await loadUserRow(pool, id)) };
}

async function resetPassword(pool, auth, body) {
  const id = checkId(body.userId, 'user');
  if (id === auth.user.id) fail(400, 'Change your own password in the app’s Settings');
  checkPassword(body.password);
  await loadUserRow(pool, id);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [await hashPassword(body.password), Date.now(), id]);
  const res = await pool.query('DELETE FROM auth_tokens WHERE user_id = $1', [id]);
  return { ok: true, signedOut: res.rowCount };
}

/** Sign a user out of one device (deviceId) or all of them. */
async function signOut(pool, auth, body) {
  const id = checkId(body.userId, 'user');
  const deviceId = body.deviceId == null ? null : String(body.deviceId);
  if (deviceId && !/^[0-9a-f]{64}$/.test(deviceId)) fail(400, 'Invalid device');
  // Never cut off the session making this request.
  const res = deviceId
    ? await pool.query('DELETE FROM auth_tokens WHERE user_id = $1 AND token_hash = $2 AND token_hash <> $3', [id, deviceId, auth.tokenHash])
    : await pool.query('DELETE FROM auth_tokens WHERE user_id = $1 AND token_hash <> $2', [id, auth.tokenHash]);
  return { ok: true, signedOut: res.rowCount };
}

/* --------------------------------------------------------- login activity */

async function logins(pool, params) {
  const where = [];
  const values = [];
  const add = (sql, v) => {
    values.push(v);
    where.push(sql.replace('?', `$${values.length}`));
  };
  const q = String(params.get('q') ?? '').trim().toLowerCase().slice(0, 100);
  if (q) {
    values.push(`%${q}%`);
    where.push(`(LOWER(e.email) LIKE $${values.length} OR e.ip LIKE $${values.length})`);
  }
  const result = params.get('result');
  if (result === 'success') where.push('e.success = 1');
  if (result === 'failed') where.push('e.success = 0');
  const portal = params.get('portal');
  if (portal === 'app' || portal === 'admin') add('e.portal = ?', portal);
  const userId = Number(params.get('userId'));
  if (Number.isSafeInteger(userId) && userId > 0) add('e.user_id = ?', userId);
  const limit = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const {
    rows: [{ n }],
  } = await pool.query(`SELECT COUNT(*) AS n FROM login_events e ${w}`, values);
  const { rows } = await pool.query(
    `SELECT e.*, u.name FROM login_events e LEFT JOIN users u ON u.id = e.user_id ${w} ORDER BY e.created_at DESC, e.id DESC LIMIT ${limit} OFFSET ${offset}`,
    values,
  );
  return { total: Number(n), offset, limit, events: rows.map(loginOut) };
}

/* --------------------------------------------------------------- router */

/** Admin-only endpoints for accounts and activity. Returns undefined when the path isn't one of these. */
export async function routeAdmin(pool, auth, req, url, body) {
  const p = url.pathname;
  const get = req.method === 'GET';
  const post = req.method === 'POST';
  if (p === '/api/admin/overview' && get) return overview(pool);
  if (p === '/api/admin/users' && get) return listUsers(pool, url.searchParams.get('q'));
  const detail = p.match(/^\/api\/admin\/users\/(\d+)$/);
  if (detail && get) return userDetail(pool, checkId(detail[1], 'user'));
  if (p === '/api/admin/users/update' && post) return updateUser(pool, await body());
  if (p === '/api/admin/users/avatar' && post) {
    const b = await body();
    const id = checkId(b.userId, 'user');
    await loadUserRow(pool, id);
    await saveAvatar(pool, id, b.image ?? null);
    return { user: userOut(await loadUserRow(pool, id)) };
  }
  if (p === '/api/admin/users/role' && post) return setRole(pool, auth, await body());
  if (p === '/api/admin/users/status' && post) return setStatus(pool, auth, await body());
  if (p === '/api/admin/users/password' && post) return resetPassword(pool, auth, await body());
  if (p === '/api/admin/users/signout' && post) return signOut(pool, auth, await body());
  if (p === '/api/admin/logins' && get) return logins(pool, url.searchParams);
  return undefined;
}
