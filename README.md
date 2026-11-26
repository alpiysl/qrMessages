# QR Mesaj Anahtarlığı

Each keychain carries a unique QR code (`/q/{token}`). Scanning it shows a random message that this keychain has not seen yet. When every active message has been shown, a new round starts (the first message of the new round is never the last one shown).

Stack: Next.js 16 (App Router) + Supabase Postgres. Local first, Vercel later.

## Local setup

Requirements: Node 24, Docker running.

```bash
npm install
npm run db:start                 # local Supabase (Docker); Studio: http://127.0.0.1:54323
npm run db:reset                 # apply migrations + seed messages
cp .env.example .env.local       # fill SUPABASE_SECRET_KEY from `npx supabase status -o env`
npm run dev                      # http://localhost:3000
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run qr:generate -- --count 100 [--base-url https://domain]` | Create keychains, write `qr-output/<batch>/` (SVG, PNG, CSV) |
| `npm run qr:verify -- qr-output/<batch>` | Decode every PNG and check token hash in DB (does not consume messages) |
| `npm test` | DB logic tests against local Supabase |
| `npm run db:stop` | Stop local Supabase |

`qr-output/` CSV files contain raw tokens: keep them private, never commit them. Only SHA-256 hashes are stored in the DB.

## Routes

- `/q/[token]` – message page + feedback form (link preview bots get a placeholder and do not consume a message)
- `/admin` – password protected (`ADMIN_PASSWORD`): stats, feedback, message on/off and add, keychain enable/disable
- `/api/health` – DB ping; Vercel Cron calls it daily so the free Supabase project does not pause

## Database

`supabase/migrations/` – tables `keychains`, `messages`, `message_views`, `feedback`, plus functions:

- `pick_message(token_hash)` – atomic (row lock) message selection and view recording
- `submit_feedback(token_hash, message)` – max 3 per keychain per 10 minutes
- `admin_stats()`, `admin_keychains()`

RLS is on with no policies; only the server (secret key) can access data.

## Deploy (later)

1. Create a Supabase project, then `npx supabase link` and `npx supabase db push`; run `supabase/seed.sql` once.
2. Import the repo in Vercel; set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `PUBLIC_BASE_URL`.
3. Connect the domain.
4. Generate the real QR batch with `--base-url https://<domain>` (local batches point to localhost and must not be printed).

Note: Vercel Hobby is for non-commercial use; move to Pro (or Cloudflare) once sales start.
