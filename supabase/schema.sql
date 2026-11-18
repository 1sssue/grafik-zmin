-- Виконайте цей скрипт у Supabase: SQL Editor -> New query -> Run
-- 1) ВПИШІТЬ пошти трьох адміністраторів нижче (рядки з example.com)

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
