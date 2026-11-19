# Daymark — Product Requirements Document

**One-line description:** A calm, mobile-first task list that helps people plan today and remember what matters at the right time.

## Problem

Everyday responsibilities are easy to lose track of across busy work, study, and home routines. Many task tools feel heavier than the work itself, while a basic list cannot reliably remind someone to do something at a specific moment—for example, take a prepared smoothie before leaving home. Daymark makes capture quick, shows a manageable Today view, and delivers scheduled reminders when users opt in.

## Target user

Adults aged 18–50, including busy professionals, freelancers, students, and people managing household routines. They need a low-friction way to capture tasks, see what matters today, and remember time-sensitive activities without learning a complex planning system.

## V1 core features

1. **Quick task list and completion** — Create, edit, and delete a task with a short title; mark it complete with a strike-through and undo it.  
   *User story:* As a user, I want to add and check off simple tasks quickly so I can keep my list current without extra planning.

2. **Today dashboard and daily progress** — Show today’s open tasks, completed count, and a simple completion indicator; keep overdue tasks visible until completed or rescheduled.  
   *User story:* As a user, I want one clear view of today’s responsibilities and progress so I can choose what to do next without feeling overwhelmed.

3. **Scheduled reminders and browser push** — Let users assign a local date and time to a task. Send a web push notification from a service worker when due, with a link back to the task. Request notification permission only after the user enables reminders; show an in-app due/overdue state if push is unavailable or denied.  
   *User story:* As a user, I want a reminder to take my smoothie before I leave for work so I do not forget it.  
   *Reliability note:* Use a server-side due-reminder check (Supabase Cron invoking an Edge Function) rather than a page timer, and make delivery idempotent. Push needs an active subscription and browser permission; no web app can guarantee delivery when a browser or operating system blocks notifications. See [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), and [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API).

4. **Recurring tasks** — Support daily and weekly repeats. Completing a recurring task completes that occurrence and creates its next occurrence; users can edit or stop the series.  
   *User story:* As a user, I want routine responsibilities to reappear automatically so I do not need to recreate them each day or week.

5. **Personal account and sync** — Sign in, keep tasks across sessions and devices, and isolate each user’s data.  
   *User story:* As a user, I want my tasks and reminder settings available on my phone and computer so I can capture things wherever I am.

## Explicitly out of scope

- Shared lists, teams, comments, and task assignment
- Email, SMS, calendar integrations, and native mobile apps
- Projects, subtasks, tags, priorities, attachments, and advanced filters
- Complex recurrence rules, natural-language scheduling, and multiple reminder channels
- Analytics beyond personal daily completion counts
- Guaranteed delivery when notifications are disabled, unsupported, or blocked by device settings

## Recommended tech stack

- **Next.js (App Router) + TypeScript** for the responsive web app and server routes.
- **Tailwind CSS** for fast, consistent mobile-first styling.
- **Supabase Auth + Postgres** for accounts and task storage; enforce per-user access with Row Level Security (RLS).
- **Supabase Edge Function + Cron** to find due reminders on a short interval, send Web Push (VAPID), and record delivery status. Store timestamps in UTC and retain each user’s IANA time zone for display and recurring-task calculation. Use a unique occurrence/delivery key to prevent duplicates.
- **Service worker + Web Push API** for persistent browser notifications; offer a clear permission setup and in-app fallback.
- **Vercel** for Next.js hosting and preview deployments. Keep reminder scheduling in Supabase so delivery cadence does not depend on hosting-plan cron limits.

Keep the first schema small: `tasks` (owner, title, due_at, completed_at, recurrence, next occurrence), `push_subscriptions`, and `reminder_deliveries` (task occurrence, sent_at, status). Apply RLS to user-owned rows; keep VAPID private keys and service credentials server-side.

## Definition of done

- A user can sign up, sign in, and use the app comfortably on a narrow mobile screen and desktop.
- Users can create, edit, delete, complete, and undo tasks; completed tasks show a strike-through.
- Today shows due and overdue tasks plus an accurate daily completion count/indicator.
- A user can enable browser notifications, schedule a reminder in their local time, and receive one push for a due task while subscribed; denied/unsupported permission produces a useful in-app fallback.
- Daily and weekly tasks generate the next occurrence once when completed, including across time-zone and daylight-saving changes.
- Task and subscription data are isolated by account; reminder processing is idempotent and failures are observable for troubleshooting.
- The production build is deployed to Vercel with Supabase credentials configured outside source control.

**One-week MVP boundary:** Prioritise the task flow, Today view, and one reliable reminder path first. Keep recurrence to daily/weekly, and defer visual polish beyond accessible, responsive essentials.
