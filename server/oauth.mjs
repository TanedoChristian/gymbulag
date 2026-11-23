// Sign in with Google or Facebook.
// The app sends the person to the provider and gets a credential back in the URL fragment
// (a Google ID token, or a Facebook access token). We check it here with the provider, then
// log in the linked account, link an existing account with the same email, or create one.
import { createPublicKey, createVerify } from 'node:crypto';
import { config } from './config.mjs';
import { AuthError } from './errors.mjs';

/** Which providers this server has keys for (sent to the app with /api/health). */
export function oauthProviders() {
  return {
    google: config.googleClientId || null,
    facebook: config.facebookAppId && config.facebookAppSecret ? config.facebookAppId : null,
  };
}

const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

async function fetchJson(url, what) {
  let r;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AuthError(502, `Can't reach ${what} right now. Try again in a moment.`);
  }
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data, headers: r.headers };
}

/* ---------------------------------------------------------------- Google */

let googleKeys = { at: 0, maxAge: 0, keys: [] };

async function googleKey(kid) {
  const fresh = Date.now() - googleKeys.at < googleKeys.maxAge;
  if (!fresh || !googleKeys.keys.some((k) => k.kid === kid)) {
    const { ok, data, headers } = await fetchJson('https://www.googleapis.com/oauth2/v3/certs', 'Google');
    if (!ok || !Array.isArray(data.keys)) throw new AuthError(502, "Can't check the Google sign-in right now. Try again in a moment.");
    const maxAge = Number(String(headers.get('cache-control') ?? '').match(/max-age=(\d+)/)?.[1] ?? 3600);
    googleKeys = { at: Date.now(), maxAge: maxAge * 1000, keys: data.keys };
  }
  return googleKeys.keys.find((k) => k.kid === kid);
}

/** A verified Google identity from an ID token, or a 401. */
export async function verifyGoogle(idToken, nonce) {
  if (!config.googleClientId) throw new AuthError(400, "Google sign-in isn't set up on this server");
  const bad = () => new AuthError(401, 'Google sign-in failed. Try again.');
  const parts = String(idToken ?? '').split('.');
  if (parts.length !== 3) throw bad();
  let header, payload;
  try {
    header = b64json(parts[0]);
    payload = b64json(parts[1]);
  } catch {
    throw bad();
  }
  if (header.alg !== 'RS256') throw bad();
  const jwk = await googleKey(header.kid);
  if (!jwk) throw bad();
  const ok = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw bad();
  const now = Date.now() / 1000;
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') throw bad();
  if (payload.aud !== config.googleClientId) throw bad();
  if (!(payload.exp > now - 60)) throw new AuthError(401, 'That Google sign-in took too long. Try again.');
  if (!nonce || payload.nonce !== nonce) throw bad();
  if (!payload.sub) throw bad();
  return {
    provider: 'google',
    subject: String(payload.sub),
    email: payload.email_verified === true || payload.email_verified === 'true' ? String(payload.email ?? '') : '',
    name: String(payload.name ?? ''),
  };
}

/* -------------------------------------------------------------- Facebook */

const GRAPH = 'https://graph.facebook.com/v19.0';

/** A verified Facebook identity from a user access token, or a 401. */
export async function verifyFacebook(accessToken) {
  const { facebookAppId: appId, facebookAppSecret: secret } = config;
  if (!appId || !secret) throw new AuthError(400, "Facebook sign-in isn't set up on this server");
  const token = String(accessToken ?? '');
  if (!token) throw new AuthError(401, 'Facebook sign-in failed. Try again.');
  // The token must be valid and issued to this app (not just any Facebook app).
  const dbg = await fetchJson(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(`${appId}|${secret}`)}`, 'Facebook');
  const d = dbg.data?.data;
  if (!dbg.ok || !d?.is_valid || String(d.app_id) !== appId || !d.user_id) throw new AuthError(401, 'Facebook sign-in failed. Try again.');
  const me = await fetchJson(`${GRAPH}/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`, 'Facebook');
  if (!me.ok || String(me.data.id) !== String(d.user_id)) throw new AuthError(401, 'Facebook sign-in failed. Try again.');
  // Facebook only returns an email the person has confirmed.
  return { provider: 'facebook', subject: String(me.data.id), email: String(me.data.email ?? ''), name: String(me.data.name ?? '') };
}
