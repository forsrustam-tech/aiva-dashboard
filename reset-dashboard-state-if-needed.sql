-- Если дашборд открылся пустым, можно очистить состояние:
-- После этого v9.2 сам создаст нормальную структуру при входе.
update public.dashboard_state
set data = '{}'::jsonb,
    updated_at = now()
where id = 'main';
