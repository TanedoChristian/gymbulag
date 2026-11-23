/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * `npm run dev` also runs the Gymbulag API (login, sync, food search) inside the dev server,
 * so a single command, and a single tunnelled port, is all you need.
 */
function gymbulagApi(): Plugin {
  return {
    name: 'gymbulag-api',
    apply: 'serve',
    async configureServer(server) {
      // The server picks its database from process.env: MySQL with DB_DRIVER=mysql (npm run dev:local), else Postgres via DATABASE_URL.
      for (const [k, v] of Object.entries(loadEnv(server.config.mode, process.cwd(), ''))) process.env[k] ??= v;
      const log = (s: string) => server.config.logger.info(`[api] ${s}`);
      let handler: ((req: unknown, res: unknown) => Promise<void>) | null = null;
      try {
        // Loaded at runtime (not bundled into the config) from the project's server folder.
        const load = (f: string) => import(pathToFileURL(path.resolve('server', f)).href);
        const { migrate } = await load('migrate.mjs');
        const { createPool } = await load('db.mjs');
        const { createHandler } = await load('index.mjs');
        const { databaseLabel } = await load('config.mjs');
        await migrate({ log });
        handler = createHandler(createPool());
        log(`login and sync available at /api (${databaseLabel()})`);
      } catch (e) {
        server.config.logger.error(`[api] ✗ ${e instanceof Error ? e.message : e} — login and sync won't work until the database is reachable. Check .env (DATABASE_URL, or DB_* for dev:local) and restart.`);
      }
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        if (handler) return void handler(req, res);
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: "The server can't reach the database. Check the terminal running npm run dev.",
          }),
        );
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const apiPort = loadEnv(mode, process.cwd(), '').PORT || '8787';
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      gymbulagApi(),
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Gymbulag — Workout Log',
          short_name: 'Gymbulag',
          description: 'Log your gym sessions, track PRs and see your progress. Works offline.',
          theme_color: '#0a0c0e',
          background_color: '#0a0c0e',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
          // The bundled USDA food table (~1 MB) is precached so food search works offline.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    server: {
      host: true,
    },
    preview: {
      // `npm run server` in another terminal.
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
    build: {
      chunkSizeWarningLimit: 900,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
