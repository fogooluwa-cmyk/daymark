# Daymark

Daymark is a calm, mobile-first to-do list for planning today, tracking daily progress, and remembering tasks at the right time.

## Start locally

Requirements: Node.js 20.9 or later.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase environment variables, the app runs in local demo mode and keeps tasks in this browser. The demo includes task creation, completion and undo, deletion, search, Today/All/Upcoming/Completed views, daily and weekly recurrence, and foreground reminders while the page is open. Demo data is stored in localStorage and is not synced across devices.

## MVP features

- Responsive public landing page, sign in/sign up, and protected workspace routes.
- Today dashboard with daily completion progress and quick task creation.
- Task list with complete/undo strike-through, editing, deletion, due date/time, and daily/weekly recurrence.
- Upcoming and completed views, task search, and a daily task reminder.
- Optional Supabase Auth and account-scoped cloud storage with row-level security.
- Browser notification permission and subscription management; server push delivery through a scheduled Supabase Edge Function.
- Light and dark themes, account timezone settings, desktop sidebar, and mobile bottom navigation.

## Supabase and push setup

The local demo works without cloud credentials. Cloud login, cross-device sync, and background push require a Supabase project and VAPID keys.

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Link the project and apply the database migration:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. In Supabase Auth URL configuration, set your site URL and allow the callback URL `http://localhost:3000/auth/callback` (plus the deployed `/auth/callback` URL).
4. Set `.env.local` values using the project URL, publishable key, and VAPID public key:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
   ```

   Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Keep the private key and Supabase service-role key on the server; never expose either with a `NEXT_PUBLIC_` prefix.
5. Add Edge Function secrets and deploy the reminder function:

   ```bash
   supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   supabase secrets set VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
   supabase secrets set VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY
   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
   supabase secrets set REMINDER_CRON_SECRET=USE_A_LONG_RANDOM_SECRET
   supabase secrets set APP_ORIGIN=http://localhost:3000
   supabase functions deploy send-reminders
   ```

   Use your HTTPS production origin for `APP_ORIGIN` after deployment. The frontend needs only the three `NEXT_PUBLIC_` values above.
6. Schedule `send-reminders` once per minute with Supabase Cron and `pg_net`, storing the function URL and matching `REMINDER_CRON_SECRET` in Vault. Follow the [Supabase Cron guide](https://supabase.com/docs/guides/cron) and [Edge Functions guide](https://supabase.com/docs/guides/functions). The scheduled request must send the secret in the `x-cron-secret` header. The migration includes idempotent delivery records and retry state so repeated cron runs do not intentionally resend successful deliveries.

Push delivery requires browser permission, a secure origin (localhost is treated as secure for development), a registered service worker, and valid VAPID keys. Browser and operating-system settings may still suppress notifications. In local demo mode, alerts are foreground-only and require Daymark to remain open.

## Deploy

Deploy the Next.js app to Vercel or another Node.js host. Add the three public Supabase/VAPID environment variables in the host settings, update Supabase Auth's site and callback URLs, and set the Edge Function `APP_ORIGIN` to the deployed HTTPS origin. The Edge Function stays deployed on Supabase.

## Repository map

```text
src/app/                    Landing, auth, workspace routes, and global styles
src/components/             Auth, workspace shell, task workspace, and settings
src/lib/                    Task/date helpers and Supabase browser/server clients
public/sw.js                Push event and notification click handling
supabase/migrations/        Tables, RLS policies, recurrence RPCs, delivery claims
supabase/functions/         Scheduled web-push reminder sender
```

See [PRD.md](./PRD.md) for the V1 product scope. UI inspiration and implementation decisions are recorded in `.tastemaker/`.
