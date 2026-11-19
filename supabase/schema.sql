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
