# Spotter — workout log

A fast, offline-first gym tracker. Pick a day on the calendar, log what you trained (exercise, weight and reps for every set), and watch your progress.

## Features

**Logging**
- **Quick log** (default): type the weight and reps after you train, with no checkboxes or timers. **Live** mode adds tick-as-you-go sets, a workout clock and a rest timer. Switch from any session
- Remove sets with the × on each row, by swiping left on mobile, or with "Remove set". Undo is offered for sets that had data. The default set count for new exercises is configurable
- Sessions are auto-named from what you trained ("Chest & Shoulders") unless you name them
- **Walks and runs**: log steps, distance (km) and time on any day, as many as you like, next to gym sessions on the same day. Pace (min/km and km/h) is worked out for you. Days with a walk or run get a green footprints mark on the calendar
- **Food tracking**: calories, protein, carbs and fat per meal (breakfast, lunch, dinner, snacks), with daily goals in Settings. Every food shows how far its numbers can be trusted:
  - **Verified**: 7,793 foods from USDA FoodData Central (SR Legacy, lab data, public domain), bundled with the app so search works offline
  - **Checked** / **Unverified**: packaged products from Open Food Facts, by barcode (camera on Android Chrome, or type the number) or by name (needs the Spotter server). "Checked" means an Open Food Facts moderator reviewed it
  - **Yours**: foods you add yourself, with a note on where the numbers came from (package label, PhilFCT, recipe…)
  - Values that can't be right (calories that don't match the macros, more than 900 kcal per 100 g) are flagged on unverified foods
  - Favourites, recents, quick add (just type the totals), copy a meal from yesterday
- **Calorie calculator (TDEE)**: Settings → Nutrition goals. Uses the Mifflin–St Jeor equation with your age (from your account), sex, height, weight and activity level, and suggests the activity level from the gym days and walks/runs you logged in the last 4 weeks. Pick a goal (lose, maintain or gain) and it sets your calorie, protein, carbs and fat targets. It won't suggest less than 1,500 kcal for men or 1,200 kcal for women
- **Accounts**: one per email, with each person's data kept separate on the server
- **One progress photo per day**, compressed and stored privately on the device, shown on the calendar
- Month calendar with a dot for each muscle group trained per day, a weekly streak, and monthly volume
- Tap any day (past, today or future) to add, edit or delete sessions. Several sessions per day are supported
- For each set: weight, reps, set type (normal / warm-up / drop / failure), optional RPE, and a done checkbox
- **kg or lb for each exercise**: tap the `kg ⇄` header to switch an exercise's unit (e.g. lb dumbbells in a kg gym). The converted weight shows live under every input (`100` → `≈ 220.5 lb`). The app remembers your choice per exercise
- **"Previous" column**: every set shows what you did last time. Tap it to copy, or tick an empty set to log "same as last time"
- New exercises get the same number of sets as last time, so you just fill in the numbers
- Session name, start and end time (with a live clock), bodyweight, notes, and per-exercise notes
- Autosaves as you type, including when you switch apps. Undo for removed exercises and deleted sessions

**Training tools**
- Automatic **PR detection** (estimated 1RM, heaviest weight, rep PRs for bodyweight moves), shown with a trophy as it happens
- **Rest timer** that starts when you tick a set, with ±15s, sound, vibration and a notification. It survives navigation and reloads
- **Plate calculator** (kg and lb plates, configurable bar)
- **Templates**: save any session as a template, or build one in the Library, starting blank or from a copy of an existing template. You can also pull another template's exercises into the one you're editing. "Repeat last workout" with one tap. Ships with **Upper A** (12 exercises) and **Lower B** (6 exercises)
- Exercise library with 75 built-in exercises and your own custom ones (edit, archive, delete)

**Progress**
- **Records**: a PR card for every exercise with est. 1RM, heaviest set, PR count and last PR date, plus bests by rep range: Strength 1–5, Hypertrophy 6–12, Endurance 13+
- Per-exercise **rep-max table** (1RM–15RM: heaviest weight for at least N reps, with an estimate from your best 1RM)
- **Photos**: a gallery, a full-screen swipe viewer, and side-by-side before/after compare
- Overview: sessions, total volume, sessions per week, streak, 12-week volume chart, sets per muscle group (30 days), recent PRs, bodyweight trend
- **Cardio**: weekly and daily km / steps / time charts (walk and run stacked), run pace trend, records (longest run and walk, fastest run, most steps in a day, best week), day streak and full history
- **Food**: daily calories and protein against your goals, macro split, protein per kg of bodyweight, most eaten foods, and how much of what you logged comes from verified data
- Per exercise: est. 1RM / top set / volume charts over 3M / 6M / 1Y / All, records, and full history

**Data & app**
- Stored on the device in IndexedDB. No account and no server
- JSON backup and restore including photos (merge or replace, validated on import), CSV export of every set, a "protect storage" request
- kg / lb (stored internally as kg, so switching units converts your history), Monday or Sunday week start, light / dark / auto theme
- Installable PWA that works fully offline, with an in-app "new version available" prompt
- Mobile-first layout with safe-area handling, keyboard and screen-reader friendly. Inputs are 16px on touch screens so iOS doesn't zoom in while you type
- Error boundary with a one-click data rescue download

## Renaming the app

The name lives in one file, [`brand.json`](brand.json):

```json
{ "name": "Spotter", "tagline": "Workout Log", "description": "…", "fileSlug": "spotter" }
```

Edit it and deploy. The app's screens, the browser tab, the installed-app name and the server's messages all read it. Internal ids stay as they were (the `gymbulag:` storage keys, the local database and the backup format), so a rename never logs anyone out or makes old backups unreadable. After a rename, also update the app name in Google's Branding page and Facebook's app settings.

## Development

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (calc, PRs, units, plates, backup/import)
npm run typecheck
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Deploying

`dist/` is a static site. Any static host works. SPA fallback rules are included for Netlify (`public/_redirects`) and Vercel (`vercel.json`). On other hosts, rewrite unknown paths to `/index.html`. Serve over HTTPS so the service worker (offline mode) and notifications work.

## Project layout

```
src/
  db.ts                 Dexie (IndexedDB) schema + seed
  types.ts              Domain types and default settings
  lib/                  Pure logic: calc (1RM, PRs, streaks), units, plates, backup, repo (all writes)
  hooks/                Live queries and the autosaving session draft
  context/              Toasts, confirm dialogs, rest timer
  components/           UI primitives, session editor, exercise card, picker, plate calculator
  pages/                Calendar, Day, Progress, Library, Settings
```

## Server, accounts and sync

The app needs the Spotter server to log in. After that it works offline on each device and syncs to Postgres (Supabase) whenever it can reach the server. Each person has their own account (one per email) and only ever sees their own data.

1. Create a Supabase project. In **Connect**, copy the **Transaction pooler** URI (port 6543).
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to that URI, with your database password filled in.
3. `npm run db:migrate` creates the tables. `npm run db:status` shows which migrations have run.
4. Run it:
   - **Vercel**: the API runs as a function at `/api` (`api/index.mjs`). Set `DATABASE_URL` and `SIGNUP_CODE` in the Vercel project's environment variables. The app calls the API on its own address, so there's nothing to configure in the app.
   - **Locally with MySQL**: `npm run dev:local` runs the app with the API inside the dev server, using your MySQL (`DB_*` in `.env`). `npm run db:migrate:local` / `db:status:local` manage its tables (from `server/migrations-mysql`), and `npm run server:local` serves a built app + API on port 8787.
   - **Locally against Supabase**: `npm run dev` (uses `DATABASE_URL`).
5. Open the app and **Sign up** with your name, email, password and date of birth (age is needed for the calorie calculator).
   If the device already has data logged before accounts existed, you're asked whether to add it to your account.
6. On every other device, **Log in** with the same email. Your data downloads automatically.

### Google and Facebook sign-in (optional)

Set the keys below and **Continue with Google / Facebook** buttons appear on the login screen. Someone signing in this way for the first time only enters their date of birth (and the sign-up code, if set). If an account already exists with the same email, it's linked to it. Accounts made this way can add a password later in **Settings**.

The app redirects to the provider and back to its own address (`https://your-app/`, with the trailing slash), so register that address with each provider, plus `http://localhost:5173/` for development.

- **Google**: in Google Cloud Console → **APIs & Services → Credentials**, create an **OAuth client ID** of type **Web application**. Add your app's address under **Authorized JavaScript origins** and `https://your-app/` under **Authorized redirect URIs**. Set `GOOGLE_CLIENT_ID`.
- **Facebook**: in Meta for Developers, create an app with the **Facebook Login** product. Under **Facebook Login → Settings**, add `https://your-app/` to **Valid OAuth Redirect URIs**. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` (App settings → Basic). Until the app is switched to Live, only people with a role on it can log in.

Both providers ask for a **privacy policy URL** (`https://your-app/privacy`) and Facebook also for **data deletion instructions** (`https://your-app/data-deletion`). Those pages are built in and readable without logging in; set `CONTACT_EMAIL` so they say where to send requests.

The server checks every sign-in with the provider (Google's signing keys; Facebook's `debug_token` with your app secret), so these variables go on the server (Vercel environment variables), not into the app build.

Sync runs on start, a few seconds after each change, when you return to the app, and every minute.

How conflicts and deletes are handled:
- When the same record was edited on two devices, the newest edit wins.
- Deletes are kept as tombstones, so other devices remove the record too.
- **Log out** uploads pending changes, then clears the device. Your data stays in your account.
- **Delete all data** deletes everything from the device *and* your account.

### Migrations

Postgres migrations live in `server/migrations/NNN_name.sql`, MySQL ones in `server/migrations-mysql/`. A schema change needs a file in both. Each one runs once, in a transaction, and is recorded in `schema_migrations`. To change the schema, add a new numbered file and run `npm run db:migrate`. Don't edit one that has already run, because the runner warns when a migration's checksum changes.

Every table has Row Level Security switched on with no policies, so Supabase's public REST API (anon key) can't read anything. Only the server, connecting with `DATABASE_URL`, can.

### Moving from the old MySQL server

`npm run db:copy-mysql` copies an existing Spotter MySQL database into Supabase in one go: accounts, passwords, device logins, all synced data and the sync counter. Devices stay logged in and keep syncing.

1. Make sure your MySQL is running (`sudo service mysql start`) and the `DB_*` settings in `.env` point at it.
2. `npm run db:copy-mysql -- --dry` shows how many rows would be copied.
3. `npm run db:copy-mysql` runs the migrations on Supabase, then copies everything in a single transaction. It refuses to run if the Supabase tables already have data.


### Querying your data

Use Supabase's SQL editor. The `v_sets` view gives one row per logged set: date, exercise, weight in kg and lb, reps, volume and estimated 1RM. For example:

```sql
SELECT date, weight_kg, reps, e1rm_kg FROM v_sets WHERE user_id = 1 AND exercise = 'Incline Bench Press' ORDER BY date;
```

Every table and view has a `user_id` column; look it up with `SELECT id, email FROM users`.

`v_session_exercises` lists the exercises in each session. Walks and runs are in the `activities` table, with `kind`, `steps`, `distance_km` and `duration_min` columns. Food is in `foodlog` (one row per food eaten, with `kcal`, `protein_g`, `carbs_g`, `fat_g` and `trust`), your food library in `foods`, and `v_daily_nutrition` gives daily totals.

### Food data

`public/foods/usda.json` is generated from the USDA download by `scripts/build-usda-foods.mjs` (instructions at the top of the script). The Philippine Food Composition Tables (FNRI) have no download or API, so Filipino dishes are added as your own foods, with the source noted. The raw records are stored as JSON in `sessions.data` and `templates.data`.

### Security

- Passwords are hashed with scrypt. Each device gets its own login token, and only a SHA-256 of it is stored (`auth_tokens`). A device unused for 180 days has to log in again, and changing your password logs out your other devices.
- Login and sign-up attempts are rate limited.
- Anyone who can reach the server can create an account. On a public deploy, set `SIGNUP_CODE`, and people will need that code to sign up.
