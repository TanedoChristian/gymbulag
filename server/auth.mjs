// Accounts: sign up, log in, device tokens, profile.
// Passwords are hashed with scrypt; tokens are random and only their SHA-256 is stored.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.mjs';
import { TABLES } from './sync.mjs';
import { dialect, isDuplicate, lockUsers, transaction } from './db.mjs';
import { checkProfile, profileOut, PROFILE_COLUMNS, saveAvatar, saveProfile } from './profile.mjs';

const scrypt = promisify(scryptCb);
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;
/** A device that hasn't synced for this long has to log in again. */
const TOKEN_IDLE_MS = 180 * 24 * 3600 * 1000;

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------ validation */

export function normalizeEmail(v) {
  return String(v ?? '').trim().toLowerCase();
}

export function ageOn(birthDate, today = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export function checkEmail(email) {
  if (!email) throw new AuthError(400, 'Enter your email');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError(400, "That doesn't look like an email address");
}

export function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw new AuthError(400, 'Password must be at least 8 characters');
  if (pw.length > 200) throw new AuthError(400, 'Password is too long');
}

export function checkName(v) {
  const name = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!name) throw new AuthError(400, 'Enter your name');
  if (name.length > 100) throw new AuthError(400, 'Name is too long');
  return name;
}

export function checkBirthDate(v) {
  const s = String(v ?? '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || !d || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new AuthError(400, 'Enter your date of birth');
  const age = ageOn(s);
  if (age < 13) throw new AuthError(400, 'You must be at least 13 to use Gymbulag');
  if (age > 120) throw new AuthError(400, 'Check your date of birth');
  return s;
}

/* ------------------------------------------------------------- passwords */

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(String(pw).normalize('NFKC'), Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p });
  return got.length === want.length && timingSafeEqual(got, want);
}

// Compared against when the email doesn't exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = await hashPassword(randomBytes(12).toString('hex'));

/* ----------------------------------------------------------- rate limits */

const attempts = new Map();
/** Allow `max` events per `windowMs` for `key`. Throws 429 when exceeded. */
function limit(key, max, windowMs, message) {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    const wait = Math.ceil((windowMs - (now - list[0])) / 60000);
    throw new AuthError(429, `${message} Try again in ${wait} minute${wait === 1 ? '' : 's'}.`);
  }
  list.push(now);
  attempts.set(key, list);
}
function clearLimit(key) {
  attempts.delete(key);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of attempts) if (list.every((t) => now - t > 3600_000)) attempts.delete(k);
}, 600_000).unref();

/* ---------------------------------------------------------------- tokens */

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export async function issueToken(pool, userId, device) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  await pool.query('INSERT INTO auth_tokens (token_hash, user_id, device, created_at, last_used_at) VALUES ($1, $2, $3, $4, $5)', [sha256(token), userId, String(device ?? '').slice(0, 255), now, now]);
  return token;
}

/** Admin by role, or listed in ADMIN_EMAILS. */
export const isAdminRow = (row) => row.role === 'admin' || config.adminEmails.includes(String(row.email).toLowerCase());

/** Columns for loading a user: everything plus how many communities they own. */
export const USER_COLUMNS = `u.id, u.email, u.password_hash, u.name, u.birth_date, u.created_at, u.updated_at, u.role, u.status, u.status_changed_at, ${PROFILE_COLUMNS},
  (SELECT COUNT(*) FROM community_owners o WHERE o.user_id = u.id) AS owned`;

function publicUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    birthDate: row.birth_date,
    createdAt: Number(row.created_at),
    role: isAdminRow(row) ? 'admin' : 'user',
    isOwner: Number(row.owned ?? 0) > 0,
    ...profileOut(row),
  };
}

const loadUser = async (db, id) => (await db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [id])).rows[0];

/** Why this account can't be used, or null when it can. */
function statusError(row) {
  if (row.status === 'blocked') return 'This account has been blocked. Contact support if you think this is a mistake.';
  if (row.status === 'inactive') return 'This account is inactive. Contact support to reactivate it.';
  return null;
}

/** The signed-in user for this request, or a 401. */
export async function requireUser(pool, req) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new AuthError(401, 'Please log in');
  const hash = sha256(token);
  const {
    rows: [row],
  } = await pool.query(`SELECT ${USER_COLUMNS}, t.last_used_at FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1`, [hash]);
  const now = Date.now();
  if (!row || now - Number(row.last_used_at) > TOKEN_IDLE_MS) throw new AuthError(401, 'Your login has expired. Please log in again.');
  const blocked = statusError(row);
  if (blocked) throw new AuthError(401, blocked);
  // Touch at most once an hour.
  if (now - Number(row.last_used_at) > 3600_000) await pool.query('UPDATE auth_tokens SET last_used_at = $1 WHERE token_hash = $2', [now, hash]);
  return { user: publicUser(row), tokenHash: hash };
}

/* ------------------------------------------------------------- endpoints */

export async function register(pool, body, ctx) {
  limit(`signup:${ctx.ip}`, 10, 3600_000, 'Too many sign-ups from this network.');
  if (config.signupCode && String(body.signupCode ?? '').trim() !== config.signupCode) throw new AuthError(403, 'Wrong sign-up code');
  const email = normalizeEmail(body.email);
  checkEmail(email);
  checkPassword(body.password);
  const name = checkName(body.name);
  const birthDate = checkBirthDate(body.birthDate);
  const hash = await hashPassword(body.password);
  const now = Date.now();

  const row = await transaction(pool, async (conn) => {
    // Serialise sign-ups so "is this the first account?" is answered once.
    await lockUsers(conn);
    const {
      rows: [{ n }],
    } = await conn.query('SELECT COUNT(*) AS n FROM users');
    let id;
    try {
      const sql = 'INSERT INTO users (email, password_hash, name, birth_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)';
      const res = await conn.query(dialect === 'postgres' ? `${sql} RETURNING id` : sql, [email, hash, name, birthDate, now, now]);
      id = dialect === 'postgres' ? res.rows[0].id : res.insertId;
    } catch (e) {
      if (isDuplicate(e)) throw new AuthError(409, 'An account with this email already exists. Log in instead.');
      throw e;
    }
    const user = await loadUser(conn, id);
    // The very first account takes over anything synced before accounts existed.
    if (Number(n) === 0) for (const t of Object.keys(TABLES)) await conn.query(`UPDATE "${t}" SET user_id = $1 WHERE user_id = 0`, [user.id]);
    return user;
  });
  await recordLogin(pool, { userId: row.id, email, success: true, reason: 'signup' }, ctx);
  return { token: await issueToken(pool, row.id, ctx.device), user: publicUser(row) };
}

/** Log in. adminOnly: the admin panel's own sign-in, which only admin accounts get past. */
/** Write one row of login activity. Never fails the request it belongs to. */
export async function recordLogin(pool, { userId = null, email = '', success, reason, portal = 'app' }, ctx) {
  try {
    await pool.query('INSERT INTO login_events (user_id, email, success, reason, portal, ip, user_agent, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
      userId,
      String(email).slice(0, 254),
      success ? 1 : 0,
      reason,
      portal,
      String(ctx?.ip ?? '').replace(/^::ffff:/, '').slice(0, 64),
      String(ctx?.device ?? '').slice(0, 255),
      Date.now(),
    ]);
  } catch (e) {
    console.error('[auth] could not record login activity:', e.message);
  }
}

/** Log in. adminOnly: the admin panel's own sign-in, which only admin accounts get past. */
export async function login(pool, body, ctx, { adminOnly = false } = {}) {
  const email = normalizeEmail(body.email);
  if (!email || typeof body.password !== 'string' || !body.password) throw new AuthError(400, 'Enter your email and password');
  const portal = adminOnly ? 'admin' : 'app';
  let row;
  const fail = async (reason, status, message) => {
    await recordLogin(pool, { userId: row?.id ?? null, email, success: false, reason, portal }, ctx);
    throw new AuthError(status, message);
  };
  try {
    limit(`login-ip:${ctx.ip}`, 30, 15 * 60_000, 'Too many login attempts.');
    limit(`login:${email}`, 8, 15 * 60_000, 'Too many attempts for this account.');
  } catch (e) {
    await fail('rate_limited', e.status, e.message);
  }
  ({
    rows: [row],
  } = await pool.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.email = $1`, [email]));
  const ok = await verifyPassword(body.password, row?.password_hash ?? DUMMY_HASH);
  if (!row) await fail('unknown_email', 401, 'Wrong email or password');
  if (!ok) await fail('wrong_password', 401, 'Wrong email or password');
  const blocked = statusError(row);
  if (blocked) await fail(row.status, 403, blocked);
  if (adminOnly && !isAdminRow(row)) await fail('not_admin', 403, "This account doesn't have admin access");
  clearLimit(`login:${email}`);
  await recordLogin(pool, { userId: row.id, email, success: true, reason: 'ok', portal }, ctx);
  return { token: await issueToken(pool, row.id, adminOnly ? `admin · ${ctx.device}` : ctx.device), user: publicUser(row) };
}

/** Open the admin panel as the admin who is already logged into the app (no second password prompt). */
export async function adminSessionFromApp(pool, auth, ctx) {
  if (auth.user.role !== 'admin') throw new AuthError(403, "This account doesn't have admin access");
  await recordLogin(pool, { userId: auth.user.id, email: auth.user.email, success: true, reason: 'from_app', portal: 'admin' }, ctx);
  return { token: await issueToken(pool, auth.user.id, `admin · ${ctx.device}`), user: auth.user };
}

export async function logout(pool, auth) {
  await pool.query('DELETE FROM auth_tokens WHERE token_hash = $1', [auth.tokenHash]);
  return { ok: true };
}

export async function updateProfile(pool, auth, body) {
  const name = body.name === undefined ? auth.user.name : checkName(body.name);
  const birthDate = body.birthDate === undefined ? auth.user.birthDate : checkBirthDate(body.birthDate);
  const cur = await loadUser(pool, auth.user.id);
  const profile = checkProfile(body, cur);
  await pool.query('UPDATE users SET name = $1, birth_date = $2, updated_at = $3 WHERE id = $4', [name, birthDate, Date.now(), auth.user.id]);
  await saveProfile(pool, auth.user.id, profile);
  return { user: publicUser(await loadUser(pool, auth.user.id)) };
}

/** Set or remove your own profile picture. body.image: a data: URL, or null to remove. */
export async function updateAvatar(pool, auth, body) {
  limit(`avatar:${auth.user.id}`, 20, 15 * 60_000, 'Too many picture changes.');
  await saveAvatar(pool, auth.user.id, body.image ?? null);
  return { user: publicUser(await loadUser(pool, auth.user.id)) };
}

/** Change password. Every other device is logged out. */
export async function changePassword(pool, auth, body) {
  limit(`pw:${auth.user.id}`, 8, 15 * 60_000, 'Too many attempts.');
  const {
    rows: [row],
  } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [auth.user.id]);
  if (!(await verifyPassword(body.current ?? '', row.password_hash))) throw new AuthError(400, 'Your current password is wrong');
  checkPassword(body.password);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [await hashPassword(body.password), Date.now(), auth.user.id]);
  const res = await pool.query('DELETE FROM auth_tokens WHERE user_id = $1 AND token_hash <> $2', [auth.user.id, auth.tokenHash]);
  return { ok: true, otherDevicesLoggedOut: res.rowCount };
}
