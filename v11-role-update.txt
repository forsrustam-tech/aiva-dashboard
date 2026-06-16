-- AIVA Dashboard v11 role update
-- Supabase → SQL Editor → New query → Run

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in (
  'general_director',
  'marketing_director',
  'sales_head',
  'center_coordinator',
  'clinic_director',
  'owner',
  'manager',
  'marketing',
  'sales',
  'clinic',
  'finance',
  'approver',
  'viewer'
));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() in ('general_director','owner','approver');
$$;

-- Примеры назначения:
-- update public.profiles set role='general_director', name='Владимир' where email='EMAIL_ВЛАДИМИРА';
-- update public.profiles set role='marketing_director', name='Рус Шарифуллин' where email='forsrustam@gmail.com';
-- update public.profiles set role='sales_head', name='Никита Лунев' where email='EMAIL_НИКИТЫ';
