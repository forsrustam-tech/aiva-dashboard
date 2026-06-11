-- AIVA Clinic Dashboard v9 schema
-- Supabase → SQL Editor → New query → вставить всё → Run

create extension if not exists pgcrypto;

-- 1. Роли сотрудников
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'viewer'
    check (role in ('owner','manager','marketing','sales','clinic','finance','approver','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Главное состояние дашборда
-- Для первой боевой версии храним состояние JSON-ом.
-- Это быстро запускает рабочий сайт. Потом можно нормализовать в отдельные таблицы.
create table if not exists public.dashboard_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- 3. База знаний: метаданные файлов
create table if not exists public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'Другое',
  description text,
  file_path text,
  file_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 4. Автоматическое создание профиля при добавлении пользователя в Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'viewer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5. Helper-функции ролей
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() in ('owner','manager');
$$;

-- 6. RLS
alter table public.profiles enable row level security;
alter table public.dashboard_state enable row level security;
alter table public.knowledge_docs enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "dashboard_select_authenticated" on public.dashboard_state;
create policy "dashboard_select_authenticated"
on public.dashboard_state for select
to authenticated
using (true);

drop policy if exists "dashboard_insert_allowed" on public.dashboard_state;
create policy "dashboard_insert_allowed"
on public.dashboard_state for insert
to authenticated
with check (public.my_role() in ('owner','manager','marketing','sales','clinic','finance','approver'));

drop policy if exists "dashboard_update_allowed" on public.dashboard_state;
create policy "dashboard_update_allowed"
on public.dashboard_state for update
to authenticated
using (public.my_role() in ('owner','manager','marketing','sales','clinic','finance','approver'))
with check (public.my_role() in ('owner','manager','marketing','sales','clinic','finance','approver'));

drop policy if exists "knowledge_select_authenticated" on public.knowledge_docs;
create policy "knowledge_select_authenticated"
on public.knowledge_docs for select
to authenticated
using (true);

drop policy if exists "knowledge_insert_staff" on public.knowledge_docs;
create policy "knowledge_insert_staff"
on public.knowledge_docs for insert
to authenticated
with check (public.my_role() <> 'viewer');

drop policy if exists "knowledge_delete_admin" on public.knowledge_docs;
create policy "knowledge_delete_admin"
on public.knowledge_docs for delete
to authenticated
using (public.is_admin());

-- 7. Storage для базы знаний
insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do nothing;

drop policy if exists "knowledge_storage_select" on storage.objects;
create policy "knowledge_storage_select"
on storage.objects for select
to authenticated
using (bucket_id = 'knowledge');

drop policy if exists "knowledge_storage_insert" on storage.objects;
create policy "knowledge_storage_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'knowledge' and public.my_role() <> 'viewer');

drop policy if exists "knowledge_storage_delete_admin" on storage.objects;
create policy "knowledge_storage_delete_admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'knowledge' and public.is_admin());

-- 8. Стартовая строка состояния
insert into public.dashboard_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;
