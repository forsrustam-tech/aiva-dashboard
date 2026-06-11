-- AIVA Dashboard v9.6 roles update
-- Запусти это в Supabase SQL Editor, если хочешь, чтобы approver тоже считался админом в RLS.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() in ('owner','manager','approver');
$$;
