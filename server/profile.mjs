// Profile details (phone, gender, city, bio, goal, experience) and profile pictures.
// Pictures are resized on the device, stored in users.avatar and served from /api/avatars/<avatar_key>.
// The key is random and replaced on every upload, so links can't be guessed and can be cached forever.
import { randomBytes } from 'node:crypto';
import { AuthError } from './auth.mjs';

export const GENDERS = ['', 'male', 'female', 'other', 'prefer_not'];
export const GOALS = ['', 'lose_fat', 'build_muscle', 'get_stronger', 'endurance', 'general_fitness'];
export const EXPERIENCE = ['', 'beginner', 'intermediate', 'advanced'];

const MAX_AVATAR_BYTES = 300 * 1024;

const fail = (message, status = 400) => {
  throw new AuthError(status, message);
};

function text(v, label, max) {
  const s = String(v ?? '').trim().replace(/[ \t]+/g, ' ');
  if (s.length > max) fail(`${label} is too long (max ${max} characters)`);
  return s;
}

function oneOf(v, list, label) {
  const s = String(v ?? '');
  if (!list.includes(s)) fail(`Invalid ${label}`);
  return s;
}

/**
 * The profile fields from a request body, validated. Fields left out keep `current`'s value.
 * Returns DB column -> value.
 */
export function checkProfile(body, current = {}) {
  const pick = (key, col, fn) => (body[key] === undefined ? current[col] ?? '' : fn(body[key]));
  const phone = pick('phone', 'phone', (v) => {
    const s = text(v, 'Phone', 30);
    if (s && !/^\+?[0-9 ()-]{5,}$/.test(s)) fail('Enter a valid phone number');
    return s;
  });
  return {
    phone,
    gender: pick('gender', 'gender', (v) => oneOf(v, GENDERS, 'gender')),
    city: pick('city', 'city', (v) => text(v, 'City', 100)),
    bio: pick('bio', 'bio', (v) => text(v, 'Bio', 300)),
    fitness_goal: pick('fitnessGoal', 'fitness_goal', (v) => oneOf(v, GOALS, 'fitness goal')),
    experience: pick('experience', 'experience', (v) => oneOf(v, EXPERIENCE, 'experience level')),
  };
}

/** Save profile fields for a user. */
export async function saveProfile(pool, userId, fields) {
  await pool.query('UPDATE users SET phone = $1, gender = $2, city = $3, bio = $4, fitness_goal = $5, experience = $6, updated_at = $7 WHERE id = $8', [
    fields.phone,
    fields.gender,
    fields.city,
    fields.bio,
    fields.fitness_goal,
    fields.experience,
    Date.now(),
    userId,
  ]);
}

/** Profile fields as the API returns them. */
export function profileOut(row) {
  return {
    phone: row.phone ?? '',
    gender: row.gender ?? '',
    city: row.city ?? '',
    bio: row.bio ?? '',
    fitnessGoal: row.fitness_goal ?? '',
    experience: row.experience ?? '',
    avatarKey: row.avatar_key ?? null,
  };
}

/** Columns that profileOut reads (never the picture itself). */
export const PROFILE_COLUMNS = 'u.phone, u.gender, u.city, u.bio, u.fitness_goal, u.experience, u.avatar_key';

/* ------------------------------------------------------------- pictures */

/** The image type from the file's first bytes; the declared type isn't trusted. */
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Set (from a data: URL) or remove (image null) a user's picture. Returns the new avatar key, or null when removed.
 */
export async function saveAvatar(pool, userId, image) {
  if (image == null || image === '') {
    await pool.query('UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_key = NULL, updated_at = $1 WHERE id = $2', [Date.now(), userId]);
    return null;
  }
  const m = String(image).match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) fail('Upload a JPEG, PNG or WebP picture');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_AVATAR_BYTES) fail('That picture is too large (max 300 KB)');
  const type = sniff(buf);
  if (!type) fail('Upload a JPEG, PNG or WebP picture');
  const key = randomBytes(18).toString('base64url');
  const res = await pool.query('UPDATE users SET avatar = $1, avatar_type = $2, avatar_key = $3, updated_at = $4 WHERE id = $5', [buf, type, key, Date.now(), userId]);
  if (!res.rowCount) fail('User not found', 404);
  return key;
}

/** GET /api/avatars/<key>. Public (the key is the secret); cached for a year since a new upload gets a new key. */
export async function serveAvatar(pool, key, res) {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(key)) return notFound(res);
  const {
    rows: [row],
  } = await pool.query('SELECT avatar, avatar_type FROM users WHERE avatar_key = $1', [key]);
  if (!row?.avatar) return notFound(res);
  const buf = Buffer.isBuffer(row.avatar) ? row.avatar : Buffer.from(row.avatar);
  res.writeHead(200, {
    'Content-Type': row.avatar_type || 'image/jpeg',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  });
  res.end(buf);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: 'Not found' }));
}
