// Community feed: posts, likes, comments, member list and post pictures.
// Who can see a community: its active members, its gym owners, and admins. Blocked members can't.
// Who can moderate (delete anyone's post or comment, pin posts): gym owners and admins.
// A deactivated community is read-only.
import { randomBytes } from 'node:crypto';
import { AuthError } from './auth.mjs';
import { dialect } from './db.mjs';
import { sniff } from './profile.mjs';

const POST_MAX = 2000;
const COMMENT_MAX = 1000;
const PAGE = 20;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const PENDING_MEDIA_TTL = 24 * 3600 * 1000;

const fail = (status, message) => {
  throw new AuthError(status, message);
};

function checkId(v, what = 'id') {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) fail(400, `Invalid ${what}`);
  return n;
}

function checkBody(v, max, label) {
  // Keep line breaks, trim the ends, cap blank runs.
  const s = String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (s.length > max) fail(400, `${label} is too long (max ${max} characters)`);
  return s;
}

/* Small per-user rate limits (in memory, per server instance). */
const hits = new Map();
function limit(key, max, windowMs, message) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) fail(429, message);
  list.push(now);
  hits.set(key, list);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of hits) if (list.every((t) => now - t > 3600_000)) hits.delete(k);
}, 600_000).unref();

const insertId = async (db, sql, params) => {
  const res = await db.query(dialect === 'postgres' ? `${sql} RETURNING id` : sql, params);
  return Number(dialect === 'postgres' ? res.rows[0].id : res.insertId);
};

/* --------------------------------------------------------------- access */

/** Everyone the Members tab lists: active members plus gym owners, each once, active accounts only. */
async function headcount(pool, communityId) {
  const { rows } = await pool.query(
    `SELECT m.user_id FROM community_members m JOIN users u ON u.id = m.user_id WHERE m.community_id = $1 AND m.status = 'active' AND u.status = 'active'
     UNION
     SELECT o.user_id FROM community_owners o JOIN users u ON u.id = o.user_id WHERE o.community_id = $1 AND u.status = 'active'`,
    [communityId],
  );
  return rows.length;
}

/** Your access to a community, or a 403/404. */
async function access(pool, auth, communityId) {
  const {
    rows: [c],
  } = await pool.query(
    `SELECT c.id, c.name, c.location, c.visibility, c.active,
       (SELECT m.status FROM community_members m WHERE m.community_id = c.id AND m.user_id = $2) AS membership,
       (SELECT COUNT(*) FROM community_owners o WHERE o.community_id = c.id AND o.user_id = $2) AS owner
     FROM communities c WHERE c.id = $1`,
    [communityId, auth.user.id],
  );
  if (!c) fail(404, 'Community not found');
  const isAdmin = auth.user.role === 'admin';
  const isOwner = Number(c.owner) > 0;
  const isMember = c.membership === 'active';
  if (c.membership === 'blocked' && !isAdmin && !isOwner) fail(403, "You can't see this community");
  if (!isAdmin && !isOwner && !isMember) fail(403, 'Join this gym to see its community');
  const active = Number(c.active) === 1;
  return {
    community: { id: Number(c.id), name: c.name, location: c.location, visibility: c.visibility === 'public' ? 'public' : 'private', active, members: await headcount(pool, communityId) },
    me: { isMember, isOwner, isAdmin, canModerate: isAdmin || isOwner, canPost: active },
  };
}

/** The community a post belongs to, plus your access to it. */
async function postAccess(pool, auth, postId) {
  const {
    rows: [p],
  } = await pool.query('SELECT id, community_id, user_id, pinned FROM community_posts WHERE id = $1', [postId]);
  if (!p) fail(404, 'This post was deleted');
  return { post: p, ...(await access(pool, auth, Number(p.community_id))) };
}

/* ---------------------------------------------------------------- posts */

const POST_COLUMNS = `p.id, p.community_id, p.user_id, p.body, p.pinned, p.created_at, p.edited_at, u.name, u.avatar_key,
  (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = p.id) AS likes,
  (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked,
  (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) AS comments,
  (SELECT COUNT(*) FROM community_owners o WHERE o.community_id = p.community_id AND o.user_id = p.user_id) AS author_owner`;

async function mediaFor(pool, postIds) {
  const map = new Map();
  if (!postIds.length) return map;
  const { rows } = await pool.query('SELECT post_id, media_key, width, height FROM community_post_media WHERE post_id = ANY($1) ORDER BY position', [postIds]);
  for (const r of rows) {
    const list = map.get(Number(r.post_id)) ?? [];
    list.push({ key: r.media_key, width: r.width == null ? null : Number(r.width), height: r.height == null ? null : Number(r.height) });
    map.set(Number(r.post_id), list);
  }
  return map;
}

async function postsOut(pool, auth, rows, me) {
  const media = await mediaFor(
    pool,
    rows.map((r) => Number(r.id)),
  );
  return rows.map((r) => {
    const mine = Number(r.user_id) === auth.user.id;
    return {
      id: Number(r.id),
      communityId: Number(r.community_id),
      author: { id: Number(r.user_id), name: r.name, avatarKey: r.avatar_key ?? null, isOwner: Number(r.author_owner) > 0 },
      body: r.body,
      pinned: Number(r.pinned) === 1,
      createdAt: Number(r.created_at),
      editedAt: r.edited_at == null ? null : Number(r.edited_at),
      likes: Number(r.likes ?? 0),
      liked: Number(r.liked ?? 0) > 0,
      comments: Number(r.comments ?? 0),
      media: media.get(Number(r.id)) ?? [],
      canEdit: mine,
      canDelete: mine || me.canModerate,
    };
  });
}

async function loadPost(pool, auth, id, me) {
  const { rows } = await pool.query(`SELECT ${POST_COLUMNS} FROM community_posts p JOIN users u ON u.id = p.user_id WHERE p.id = $2`, [auth.user.id, id]);
  return (await postsOut(pool, auth, rows, me))[0];
}

/** The community header and the newest posts. `before` (a post id) pages back; pinned posts come with the first page. */
async function feed(pool, auth, communityId, params) {
  const a = await access(pool, auth, communityId);
  const before = Number(params.get('before')) || 0;
  const values = [auth.user.id, communityId];
  let older = '';
  if (before > 0) {
    values.push(before);
    older = 'AND p.id < $3';
  }
  const { rows } = await pool.query(
    `SELECT ${POST_COLUMNS} FROM community_posts p JOIN users u ON u.id = p.user_id
     WHERE p.community_id = $2 AND p.pinned = 0 ${older}
     ORDER BY p.id DESC LIMIT ${PAGE + 1}`,
    values,
  );
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  let pinned = [];
  if (!before) {
    const { rows: pins } = await pool.query(
      `SELECT ${POST_COLUMNS} FROM community_posts p JOIN users u ON u.id = p.user_id WHERE p.community_id = $2 AND p.pinned = 1 ORDER BY p.id DESC LIMIT 10`,
      [auth.user.id, communityId],
    );
    pinned = await postsOut(pool, auth, pins, a.me);
  }
  return {
    ...a,
    pinned,
    posts: await postsOut(pool, auth, page, a.me),
    nextBefore: more ? Number(page[page.length - 1].id) : null,
  };
}

async function createPost(pool, auth, communityId, body) {
  const a = await access(pool, auth, communityId);
  if (!a.me.canPost) fail(403, 'This community is paused, so new posts are turned off');
  const text = checkBody(body.body, POST_MAX, 'Your post');
  const mediaIds = Array.isArray(body.mediaIds) ? [...new Set(body.mediaIds.map((x) => checkId(x, 'picture')))] : [];
  if (mediaIds.length > MAX_IMAGES) fail(400, `Up to ${MAX_IMAGES} pictures per post`);
  if (!text && !mediaIds.length) fail(400, 'Write something first');
  limit(`post:${auth.user.id}`, 30, 3600_000, "You're posting a lot. Take a breather and try again later.");
  const id = await insertId(pool, 'INSERT INTO community_posts (community_id, user_id, body, pinned, created_at) VALUES ($1, $2, $3, 0, $4)', [communityId, auth.user.id, text, Date.now()]);
  // Attach pictures you uploaded to this community that aren't on a post yet, in the order given.
  for (const [i, mid] of mediaIds.entries()) {
    const res = await pool.query('UPDATE community_post_media SET post_id = $1, position = $2 WHERE id = $3 AND user_id = $4 AND community_id = $5 AND post_id IS NULL', [
      id,
      i,
      mid,
      auth.user.id,
      communityId,
    ]);
    if (!res.rowCount) {
      await pool.query('DELETE FROM community_posts WHERE id = $1', [id]);
      fail(400, 'One of the pictures has expired. Add it again.');
    }
  }
  return { post: await loadPost(pool, auth, id, a.me) };
}

async function editPost(pool, auth, postId, body) {
  const { post, me } = await postAccess(pool, auth, postId);
  if (Number(post.user_id) !== auth.user.id) fail(403, 'You can only edit your own posts');
  const text = checkBody(body.body, POST_MAX, 'Your post');
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM community_post_media WHERE post_id = $1', [postId]);
  if (!text && !Number(rows[0].n)) fail(400, 'A post needs some text');
  await pool.query('UPDATE community_posts SET body = $1, edited_at = $2 WHERE id = $3', [text, Date.now(), postId]);
  return { post: await loadPost(pool, auth, postId, me) };
}

async function deletePost(pool, auth, postId) {
  const { post, me } = await postAccess(pool, auth, postId);
  if (Number(post.user_id) !== auth.user.id && !me.canModerate) fail(403, "You can't delete this post");
  await pool.query('DELETE FROM community_posts WHERE id = $1', [postId]);
  return { ok: true };
}

async function pinPost(pool, auth, postId, body) {
  const { me } = await postAccess(pool, auth, postId);
  if (!me.canModerate) fail(403, 'Only gym owners can pin posts');
  await pool.query('UPDATE community_posts SET pinned = $1 WHERE id = $2', [body.pinned ? 1 : 0, postId]);
  return { post: await loadPost(pool, auth, postId, me) };
}

async function likePost(pool, auth, postId, body) {
  await postAccess(pool, auth, postId);
  if (body.liked) {
    const sql =
      dialect === 'postgres'
        ? 'INSERT INTO community_post_likes (post_id, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING'
        : 'INSERT IGNORE INTO community_post_likes (post_id, user_id, created_at) VALUES ($1, $2, $3)';
    await pool.query(sql, [postId, auth.user.id, Date.now()]);
  } else await pool.query('DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2', [postId, auth.user.id]);
  const {
    rows: [{ n }],
  } = await pool.query('SELECT COUNT(*) AS n FROM community_post_likes WHERE post_id = $1', [postId]);
  return { liked: !!body.liked, likes: Number(n) };
}

/* ------------------------------------------------------------- comments */

function commentOut(r, auth, me) {
  const mine = Number(r.user_id) === auth.user.id;
  return {
    id: Number(r.id),
    postId: Number(r.post_id),
    author: { id: Number(r.user_id), name: r.name, avatarKey: r.avatar_key ?? null, isOwner: Number(r.author_owner) > 0 },
    body: r.body,
    createdAt: Number(r.created_at),
    canDelete: mine || me.canModerate,
  };
}

const COMMENT_COLUMNS = `c.id, c.post_id, c.user_id, c.body, c.created_at, u.name, u.avatar_key,
  (SELECT COUNT(*) FROM community_owners o WHERE o.community_id = $2 AND o.user_id = c.user_id) AS author_owner`;

async function listComments(pool, auth, postId) {
  const { post, me } = await postAccess(pool, auth, postId);
  const { rows } = await pool.query(
    `SELECT ${COMMENT_COLUMNS} FROM community_comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = $1 ORDER BY c.id LIMIT 500`,
    [postId, post.community_id],
  );
  return { comments: rows.map((r) => commentOut(r, auth, me)) };
}

async function addComment(pool, auth, postId, body) {
  const { post, me } = await postAccess(pool, auth, postId);
  if (!me.canPost) fail(403, 'This community is paused, so comments are turned off');
  const text = checkBody(body.body, COMMENT_MAX, 'Your comment');
  if (!text) fail(400, 'Write a comment first');
  limit(`comment:${auth.user.id}`, 120, 3600_000, "You're commenting a lot. Try again in a bit.");
  const id = await insertId(pool, 'INSERT INTO community_comments (post_id, user_id, body, created_at) VALUES ($1, $2, $3, $4)', [postId, auth.user.id, text, Date.now()]);
  const { rows } = await pool.query(`SELECT ${COMMENT_COLUMNS} FROM community_comments c JOIN users u ON u.id = c.user_id WHERE c.id = $1`, [id, post.community_id]);
  return { comment: commentOut(rows[0], auth, me) };
}

async function deleteComment(pool, auth, commentId) {
  const {
    rows: [c],
  } = await pool.query('SELECT id, post_id, user_id FROM community_comments WHERE id = $1', [commentId]);
  if (!c) fail(404, 'This comment was deleted');
  const { me } = await postAccess(pool, auth, Number(c.post_id));
  if (Number(c.user_id) !== auth.user.id && !me.canModerate) fail(403, "You can't delete this comment");
  await pool.query('DELETE FROM community_comments WHERE id = $1', [commentId]);
  return { ok: true };
}

/* -------------------------------------------------------------- members */

/** Who's in the community, as other members see it: name, picture, owner badge, join date. Never emails. */
async function people(pool, auth, communityId) {
  const a = await access(pool, auth, communityId);
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.avatar_key, m.joined_at, 0 AS owner FROM community_members m JOIN users u ON u.id = m.user_id
       WHERE m.community_id = $1 AND m.status = 'active' AND u.status = 'active'
     UNION ALL
     SELECT u.id, u.name, u.avatar_key, o.granted_at AS joined_at, 1 AS owner FROM community_owners o JOIN users u ON u.id = o.user_id
       WHERE o.community_id = $1 AND u.status = 'active'`,
    [communityId],
  );
  // Someone who is both an owner and a member is listed once, as an owner.
  const byId = new Map();
  for (const r of rows) {
    const id = Number(r.id);
    const cur = byId.get(id);
    if (!cur || Number(r.owner) === 1) byId.set(id, { id, name: r.name, avatarKey: r.avatar_key ?? null, isOwner: Number(r.owner) === 1 || !!cur?.isOwner, joinedAt: Number(cur?.joinedAt ?? r.joined_at) });
  }
  const list = [...byId.values()].sort((x, y) => Number(y.isOwner) - Number(x.isOwner) || x.name.localeCompare(y.name));
  return { community: a.community, people: list };
}

/* ------------------------------------------------------------- pictures */

/**
 * Upload one picture for a post you're about to write (body.image: a data: URL, resized on the device).
 * Returns its id to pass in createPost's mediaIds. Unused uploads are cleaned up after a day.
 */
async function uploadMedia(pool, auth, communityId, body) {
  const a = await access(pool, auth, communityId);
  if (!a.me.canPost) fail(403, 'This community is paused, so new posts are turned off');
  limit(`media:${auth.user.id}`, 60, 3600_000, 'Too many pictures. Try again later.');
  const m = String(body.image ?? '').match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) fail(400, 'Upload a JPEG, PNG or WebP picture');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) fail(400, 'That picture is too large (max 2 MB)');
  const mime = sniff(buf);
  if (!mime) fail(400, 'Upload a JPEG, PNG or WebP picture');
  const dim = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 && n <= 20000 ? n : null;
  };
  const now = Date.now();
  // Clear out your own abandoned uploads.
  await pool.query('DELETE FROM community_post_media WHERE user_id = $1 AND post_id IS NULL AND created_at < $2', [auth.user.id, now - PENDING_MEDIA_TTL]);
  const key = randomBytes(18).toString('base64url');
  const id = await insertId(pool, 'INSERT INTO community_post_media (community_id, user_id, post_id, media_key, mime, data, width, height, position, created_at) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 0, $8)', [
    communityId,
    auth.user.id,
    key,
    mime,
    buf,
    dim(body.width),
    dim(body.height),
    now,
  ]);
  return { media: { id, key, width: dim(body.width), height: dim(body.height) } };
}

/** GET /api/community-media/<key>. Public by unguessable key, like profile pictures; cached for a year. */
export async function serveMedia(pool, key, res) {
  const notFound = () => {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Not found' }));
  };
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(key)) return notFound();
  const {
    rows: [row],
  } = await pool.query('SELECT data, mime FROM community_post_media WHERE media_key = $1 AND post_id IS NOT NULL', [key]);
  if (!row?.data) return notFound();
  const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  res.writeHead(200, {
    'Content-Type': row.mime || 'image/jpeg',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  });
  res.end(buf);
}

/* --------------------------------------------------------------- router */

/** Feed endpoints. Returns the response body, or undefined when the path isn't one of these. */
export async function routeFeed(pool, auth, req, url, body) {
  const p = url.pathname;
  const get = req.method === 'GET';
  const post = req.method === 'POST';
  let m;
  if ((m = p.match(/^\/api\/communities\/(\d+)\/(feed|posts|people|media)$/))) {
    const id = checkId(m[1], 'community');
    if (m[2] === 'feed' && get) return feed(pool, auth, id, url.searchParams);
    if (m[2] === 'posts' && post) return createPost(pool, auth, id, await body());
    if (m[2] === 'people' && get) return people(pool, auth, id);
    if (m[2] === 'media' && post) return uploadMedia(pool, auth, id, await body());
  }
  if ((m = p.match(/^\/api\/posts\/(\d+)\/(update|delete|pin|like|comments)$/))) {
    const id = checkId(m[1], 'post');
    if (m[2] === 'comments' && get) return listComments(pool, auth, id);
    if (!post) return undefined;
    if (m[2] === 'update') return editPost(pool, auth, id, await body());
    if (m[2] === 'delete') return deletePost(pool, auth, id);
    if (m[2] === 'pin') return pinPost(pool, auth, id, await body());
    if (m[2] === 'like') return likePost(pool, auth, id, await body());
    if (m[2] === 'comments') return addComment(pool, auth, id, await body());
  }
  if ((m = p.match(/^\/api\/comments\/(\d+)\/delete$/)) && post) return deleteComment(pool, auth, checkId(m[1], 'comment'));
  return undefined;
}
