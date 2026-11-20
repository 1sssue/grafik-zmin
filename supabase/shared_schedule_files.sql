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
