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
