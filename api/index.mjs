// Vercel function: runs the app's API (login, sync, food search) at /api/*.
// vercel.json rewrites /api/<path> here as /api?__path=<path>.
import { createPool } from '../server/db.mjs';
import { createHandler } from '../server/index.mjs';

let handler;

export default function appApi(req, res) {
  const url = new URL(req.url, 'http://x');
  const sub = url.searchParams.get('__path');
  if (sub != null) {
    url.searchParams.delete('__path');
    req.url = `/api/${sub}${url.search}`;
  }
  handler ??= createHandler(createPool());
  return handler(req, res);
}

// The handler reads the raw body itself.
export const config = { api: { bodyParser: false } };
