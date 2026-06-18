-- AIVA Clinic Dashboard clean-v1
-- Supabase → SQL Editor → New query → Run
-- Новый дашборд НЕ использует старые main_astana/main_almaty.
-- Он использует новые строки: aiva_clean_astana и aiva_clean_almaty.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'viewer',
  assigned_to text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'general_director','marketing_director','sales_head','center_coordinator','clinic_director',
  'sales','marketing','clinic','viewer','owner','approver'
));

create table if not exists public.dashboard_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.dashboard_state enable row level security;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles for select
to authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_admin_or_self on public.profiles;
create policy profiles_update_admin_or_self
on public.profiles for update
to authenticated
using (
  id = auth.uid()
  or public.my_role() in ('general_director','owner','approver','marketing_director')
)
with check (
  id = auth.uid()
  or public.my_role() in ('general_director','owner','approver','marketing_director')
);

drop policy if exists dashboard_select_authenticated on public.dashboard_state;
create policy dashboard_select_authenticated
on public.dashboard_state for select
to authenticated
using (true);

drop policy if exists dashboard_insert_allowed on public.dashboard_state;
create policy dashboard_insert_allowed
on public.dashboard_state for insert
to authenticated
with check (
  public.my_role() in ('general_director','marketing_director','sales_head','center_coordinator','sales','marketing','clinic','owner','approver')
);

drop policy if exists dashboard_update_allowed on public.dashboard_state;
create policy dashboard_update_allowed
on public.dashboard_state for update
to authenticated
using (
  public.my_role() in ('general_director','marketing_director','sales_head','center_coordinator','sales','marketing','clinic','owner','approver')
)
with check (
  public.my_role() in ('general_director','marketing_director','sales_head','center_coordinator','sales','marketing','clinic','owner','approver')
);

insert into public.dashboard_state (id, data)
values
  ('aiva_clean_astana', '{}'::jsonb),
  ('aiva_clean_almaty', '{}'::jsonb)
on conflict (id) do update
set data = '{}'::jsonb,
    updated_at = now();

-- Назначение ролей после создания пользователей в Authentication:
-- update public.profiles set role='general_director', name='Владимир' where email='EMAIL_ВЛАДИМИРА';
-- update public.profiles set role='marketing_director', name='Рус Шарифуллин' where email='forsrustam@gmail.com';
-- update public.profiles set role='sales_head', name='Никита Лунев' where email='EMAIL_НИКИТЫ';
-- update public.profiles set role='center_coordinator', name='Координатор центра' where email='EMAIL_КООРДИНАТОРА';
