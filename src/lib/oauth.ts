/*
 * Sign in with Google / Facebook by redirect (no third-party scripts, works in the installed app).
 * The provider sends the person back to the app with a credential in the URL fragment; the
 * server checks it with the provider (see server/oauth.mjs).
 */
import { api } from './api';
import type { AuthResult } from './auth';

export type Provider = 'google' | 'facebook';
export type OAuthProviders = Partial<Record<Provider, string | null>>;

const KEY = 'gymbulag:oauth';

interface Saved {
  provider: Provider;
  state: string;
  nonce: string;
  returnTo: string;
}

export interface OAuthReturn {
  provider: Provider;
  credential?: string;
  nonce?: string;
  error?: string;
  returnTo: string;
}

const random = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const redirectUri = () => `${location.origin}/`;

/** Leave for the provider's sign-in page. clientId: from the server's /api/health. */
export function startOAuth(provider: Provider, clientId: string) {
  const saved: Saved = { provider, state: random(), nonce: random(), returnTo: location.pathname + location.search };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* storage blocked: the return is ignored and nothing happens */
  }
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri(), state: saved.state });
  if (provider === 'google') {
    q.set('response_type', 'id_token');
    q.set('scope', 'openid email profile');
    q.set('nonce', saved.nonce);
    q.set('prompt', 'select_account');
    location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  } else {
    q.set('response_type', 'token');
    q.set('scope', 'email,public_profile');
    location.assign(`https://www.facebook.com/v19.0/dialog/oauth?${q}`);
  }
}

let checked = false;

/**
 * The sign-in we just came back from, if any. Returned only once per page load, so the login
 * screen showing again later (after logging out) doesn't reuse it.
 */
export function consumeOAuthReturn(): OAuthReturn | null {
  if (checked) return null;
  checked = true;
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const state = params.get('state') ?? query.get('state');
  if (!state) return null;
  let saved: Saved | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Saved | null;
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (!saved || saved.state !== state) return null;
  const name = saved.provider === 'google' ? 'Google' : 'Facebook';
  const error = params.get('error') ?? query.get('error');
  const credential = saved.provider === 'google' ? params.get('id_token') : params.get('access_token');
  return {
    provider: saved.provider,
    returnTo: saved.returnTo || '/',
    ...(credential && !error
      ? { credential, nonce: saved.nonce }
      : { error: error === 'access_denied' || query.get('error_reason') === 'user_denied' ? `${name} sign-in was cancelled.` : `${name} sign-in didn't finish. Try again.` }),
  };
}

export type OAuthResponse = AuthResult | { needsProfile: true; email: string; name: string };

export interface NewAccountData {
  name: string;
  birthDate: string;
  signupCode?: string;
}

/** Log in with the credential. A new account also needs NewAccountData (asked for after needsProfile). */
export function oauthLogin(ret: OAuthReturn, extra?: NewAccountData): Promise<OAuthResponse> {
  return api<OAuthResponse>('/auth/oauth', { provider: ret.provider, credential: ret.credential, nonce: ret.nonce, ...extra }, { token: null });
}
