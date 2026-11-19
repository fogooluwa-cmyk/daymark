create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  due_at timestamptz,
  completed_at timestamptz,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly')),
  recurrence_series_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_due_idx on public.tasks (user_id, due_at) where completed_at is null;
create index tasks_user_created_idx on public.tasks (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  task_occurrence_due_at timestamptz not null,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  lease_until timestamptz,
  next_attempt_at timestamptz,
  error_message text,
  sent_at timestamptz,
  unique (task_id, task_occurrence_due_at, subscription_id)
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;

revoke all on public.profiles, public.tasks, public.push_subscriptions, public.reminder_deliveries from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.reminder_deliveries to authenticated;

create policy "Users manage their own profile" on public.profiles
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own tasks" on public.tasks
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own push subscriptions" on public.push_subscriptions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read their own reminder deliveries" on public.reminder_deliveries
  for select to authenticated using (exists (
    select 1 from public.tasks where tasks.id = reminder_deliveries.task_id and tasks.user_id = (select auth.uid())
  ));

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

create or replace function public.complete_task(p_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_task public.tasks%rowtype;
  v_zone text;
  v_step interval;
  v_local timestamp;
  v_next timestamptz;
  v_series uuid;
  v_done timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  select * into v_task from public.tasks where id = p_task_id and user_id = auth.uid() for update;
  if not found or v_task.completed_at is not null then return; end if;
  update public.tasks set completed_at = v_done, updated_at = v_done where id = v_task.id;
  if v_task.recurrence = 'none' then return; end if;

  select timezone into v_zone from public.profiles where user_id = v_task.user_id;
  v_zone := coalesce(v_zone, 'UTC');
  v_step := case when v_task.recurrence = 'daily' then interval '1 day' else interval '7 days' end;
  v_series := coalesce(v_task.recurrence_series_id, v_task.id);
  update public.tasks set recurrence_series_id = v_series where id = v_task.id;
  v_local := coalesce(v_task.due_at at time zone v_zone, v_done at time zone v_zone) + v_step;
  v_next := v_local at time zone v_zone;
  while v_next <= v_done loop
    v_local := v_local + v_step;
    v_next := v_local at time zone v_zone;
  end loop;

  insert into public.tasks (user_id, title, due_at, recurrence, recurrence_series_id)
  values (v_task.user_id, v_task.title, v_next, v_task.recurrence, v_series)
  on conflict do nothing;
end;
$$;

create or replace function public.undo_task_completion(p_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_task public.tasks%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  select * into v_task from public.tasks where id = p_task_id and user_id = auth.uid() for update;
  if not found or v_task.completed_at is null then return; end if;
  if v_task.recurrence <> 'none' and v_task.recurrence_series_id is not null then
    delete from public.tasks where user_id = v_task.user_id and recurrence_series_id = v_task.recurrence_series_id
      and id <> v_task.id and completed_at is null;
  end if;
  update public.tasks set completed_at = null, updated_at = now() where id = v_task.id;
end;
$$;

create or replace function public.claim_reminder(p_task_id uuid, p_due_at timestamptz, p_subscription_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.reminder_deliveries (task_id, task_occurrence_due_at, subscription_id, status, attempts, lease_until)
  values (p_task_id, p_due_at, p_subscription_id, 'pending', 1, now() + interval '2 minutes')
  on conflict (task_id, task_occurrence_due_at, subscription_id) do update
    set status = 'pending', attempts = reminder_deliveries.attempts + 1,
        lease_until = now() + interval '2 minutes', error_message = null
    where reminder_deliveries.status = 'failed'
      and reminder_deliveries.attempts < 3
      and coalesce(reminder_deliveries.next_attempt_at, now()) <= now()
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_reminder(p_delivery_id uuid, p_success boolean, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.reminder_deliveries
  set status = case when p_success then 'sent' else 'failed' end,
      sent_at = case when p_success then now() else null end,
      next_attempt_at = case when p_success then null else now() + interval '1 minute' end,
      lease_until = null,
      error_message = case when p_success then null else left(coalesce(p_error, 'Delivery failed'), 500) end
  where id = p_delivery_id;
end;
$$;

revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke execute on function public.complete_task(uuid), public.undo_task_completion(uuid), public.claim_reminder(uuid, timestamptz, uuid), public.finish_reminder(uuid, boolean, text) from public, anon;
grant execute on function public.complete_task(uuid), public.undo_task_completion(uuid) to authenticated;
grant execute on function public.claim_reminder(uuid, timestamptz, uuid), public.finish_reminder(uuid, boolean, text) to service_role;
