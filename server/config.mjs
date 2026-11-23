// Server configuration, read from environment variables (see .env.example).
const env = process.env;

const databaseUrl = (env.DATABASE_URL ?? '').trim();

export const config = {
  port: Number(env.PORT ?? 8787),
  host: env.HOST ?? '0.0.0.0',
  /** Optional. When set, creating an account requires this code (useful when the server is reachable from the internet). */
  signupCode: (env.SIGNUP_CODE ?? '').trim(),
  /** Comma-separated emails that are always admins (how the first admin gets in). */
  adminEmails: (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /**
   * Which database to use: 'postgres' (Supabase, used on Vercel) or 'mysql' (local).
   * DB_DRIVER wins; otherwise Postgres when DATABASE_URL is set, else MySQL.
   */
  driver: env.DB_DRIVER === 'mysql' || env.DB_DRIVER === 'postgres' ? env.DB_DRIVER : databaseUrl ? 'postgres' : 'mysql',
  /** Postgres connection string, e.g. Supabase's "Transaction pooler" URI (port 6543). */
  databaseUrl,
  /** Set DATABASE_SSL=false for a local Postgres without TLS. */
  databaseSsl: env.DATABASE_SSL !== 'false',
  /** Local MySQL. */
  mysql: {
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USER ?? 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'gymbulag',
    socketPath: env.DB_SOCKET || undefined,
  },
};

/** Where the data lives, for display. */
export function databaseLabel() {
  if (config.driver === 'mysql') {
    const m = config.mysql;
    return `MySQL ${m.user}@${m.socketPath ?? `${m.host}:${m.port}`}/${m.database}`;
  }
  try {
    const u = new URL(config.databaseUrl);
    return `Postgres ${u.hostname}${u.pathname}`;
  } catch {
    return 'Postgres (DATABASE_URL not set)';
  }
}
