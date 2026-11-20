-- Виконайте цей скрипт у Supabase: SQL Editor -> New query -> Run
-- 1) ВПИШІТЬ пошти трьох адміністраторів нижче (рядки з example.com)
-- Шаблони відповідей використовують reply_templates та reply_template_state нижче;
-- після оновлення файлу запустіть цей скрипт у SQL Editor ще раз.

create table if not exists public.admin_emails (email text primary key);
insert into public.admin_emails (email) values
  ('solonetskyi.r@novaposhta.ua'),
  ('nelyaa40127@gmail.com')
on conflict do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin','user')),
  can_free_time boolean not null default false,
  created_at timestamptz not null default now()
);

-- усі дані користувача (графіки, чати, перепрацювання, вільний час, налаштування) одним записом
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Шаблони відповідей: спільні шаблони доступні всім авторизованим користувачам,
-- базові та приватні шаблони бачить лише їхній автор.
create table if not exists public.reply_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  keywords text[] not null default '{}',
  border_color text not null default '#7a5af8',
  is_shared boolean not null default false,
  is_basic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reply_templates_shared_idx on public.reply_templates (is_shared, created_at desc) where is_shared and not is_basic;
create index if not exists reply_templates_owner_idx on public.reply_templates (owner_id, created_at desc);

-- Обране, закріплення й власне сортування зберігаються окремо для кожного користувача.
create table if not exists public.reply_template_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.reply_templates(id) on delete cascade,
  pinned boolean not null default false,
  favorite boolean not null default false,
  sort_orders jsonb not null default '{}'::jsonb,
  primary key (user_id, template_id)
);

alter table public.reply_templates enable row level security;
alter table public.reply_template_state enable row level security;
grant select, insert, update, delete on public.reply_templates to authenticated;
grant select, insert, update, delete on public.reply_template_state to authenticated;

drop policy if exists "templates: own and shared read" on public.reply_templates;
create policy "templates: own and shared read" on public.reply_templates
  for select to authenticated using (owner_id = auth.uid() or (is_shared and not is_basic));
drop policy if exists "templates: insert own" on public.reply_templates;
create policy "templates: insert own" on public.reply_templates
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "templates: update own" on public.reply_templates;
create policy "templates: update own" on public.reply_templates
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "templates: delete own" on public.reply_templates;
create policy "templates: delete own" on public.reply_templates
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "template state: own rows" on public.reply_template_state;
create policy "template state: own rows" on public.reply_template_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean;
begin
  adm := exists (select 1 from public.admin_emails where lower(email) = lower(new.email));
  insert into public.profiles (id, email, role, can_free_time)
  values (new.id, lower(new.email), case when adm then 'admin' else 'user' end, adm);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.admin_emails enable row level security;  -- без політик: недоступна з браузера
alter table public.profiles enable row level security;
alter table public.user_state enable row level security;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: admin update" on public.profiles;
create policy "profiles: admin update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "state: own rows" on public.user_state;
create policy "state: own rows" on public.user_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- Shared shift schedules: all authenticated users may read; only admins may manage.
create table if not exists public.shared_schedule_files (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  name text not null,
  loaded_at text not null,
  hidden boolean not null default false,
  deleted boolean not null default false,
  data jsonb not null,
  source_url text,
  source_file_id text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists shared_schedule_files_updated_idx on public.shared_schedule_files (updated_at desc);
alter table public.shared_schedule_files enable row level security;
grant select, insert, update, delete on public.shared_schedule_files to authenticated;
drop policy if exists "shared schedules: authenticated read" on public.shared_schedule_files;
create policy "shared schedules: authenticated read" on public.shared_schedule_files
  for select to authenticated using (true);
drop policy if exists "shared schedules: admin insert" on public.shared_schedule_files;
create policy "shared schedules: admin insert" on public.shared_schedule_files
  for insert to authenticated with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "shared schedules: admin update" on public.shared_schedule_files;
create policy "shared schedules: admin update" on public.shared_schedule_files
  for update to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "shared schedules: admin delete" on public.shared_schedule_files;
create policy "shared schedules: admin delete" on public.shared_schedule_files
  for delete to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Single administrator-managed Google Sheets source. Apps Script reads/writes using service_role.
create table if not exists public.shared_schedule_source (
  id integer primary key check (id = 1),
  source_url text not null,
  file_id text not null,
  refresh_requested_at timestamptz,
  last_modified timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.shared_schedule_source enable row level security;
grant select, insert, update, delete on public.shared_schedule_source to authenticated;
drop policy if exists "schedule source: authenticated read" on public.shared_schedule_source;
create policy "schedule source: authenticated read" on public.shared_schedule_source
  for select to authenticated using (true);
drop policy if exists "schedule source: admin insert" on public.shared_schedule_source;
create policy "schedule source: admin insert" on public.shared_schedule_source
  for insert to authenticated with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "schedule source: admin update" on public.shared_schedule_source;
create policy "schedule source: admin update" on public.shared_schedule_source
  for update to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "schedule source: admin delete" on public.shared_schedule_source;
create policy "schedule source: admin delete" on public.shared_schedule_source
  for delete to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Admin roles, protected main administrators, domain exceptions and signup policy.
-- Current seed administrators become protected main administrators.
create table if not exists public.super_admin_emails (
  email text primary key check (email = lower(email))
);
insert into public.super_admin_emails(email)
values ('solonetskyi.r@novaposhta.ua'), ('nelyaa40127@gmail.com')
on conflict (email) do nothing;

create table if not exists public.email_domain_exceptions (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table public.super_admin_emails enable row level security;
alter table public.email_domain_exceptions enable row level security;
revoke all on public.super_admin_emails from anon, authenticated;
revoke all on public.email_domain_exceptions from anon, authenticated;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u
    join public.super_admin_emails s on s.email = lower(u.email)
    where u.id = auth.uid()
  )
$$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- All profile writes go through the privileged, authorization-checking Edge Function.
drop policy if exists "profiles: admin update" on public.profiles;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  adm boolean;
begin
  if right(normalized_email, length('@novaposhta.ua')) <> '@novaposhta.ua'
     and not exists (select 1 from public.email_domain_exceptions e where e.email = normalized_email)
     and not exists (select 1 from public.admin_emails a where lower(a.email) = normalized_email)
     and not exists (select 1 from public.super_admin_emails s where s.email = normalized_email) then
    raise exception 'Registration is allowed only for @novaposhta.ua addresses or individually approved addresses.';
  end if;
  adm := exists (select 1 from public.admin_emails a where lower(a.email) = normalized_email)
      or exists (select 1 from public.super_admin_emails s where s.email = normalized_email);
  insert into public.profiles (id, email, role, can_free_time)
  values (new.id, normalized_email, case when adm then 'admin' else 'user' end, adm)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.prevent_protected_admin_profile_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.super_admin_emails s where s.email = lower(old.email)) then
    raise exception 'Main administrator profiles are protected from deletion.';
  end if;
  return old;
end $$;
drop trigger if exists protect_main_admin_profile_delete on public.profiles;
create trigger protect_main_admin_profile_delete before delete on public.profiles
  for each row execute function public.prevent_protected_admin_profile_delete();

