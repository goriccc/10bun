-- Security Advisor: 퍼즐 함수 anon 실행 차단 + bun_ 테이블 deny-all RLS 정책
-- (수동본: supabase/manual/06_bun_security_advisor.sql)

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.bun_puzzle_get(date)',
    'public.bun_puzzle_assign(date, text)',
    'public.bun_puzzle_shown()',
    'public.bun_puzzle_past(date)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('revoke all on function %s from service_role', fn);
    end if;
    execute format('revoke all on function %s from bun_app', fn);
  end loop;
end $$;

grant execute on function public.bun_puzzle_get(date) to bun_app;
grant execute on function public.bun_puzzle_assign(date, text) to bun_app;
grant execute on function public.bun_puzzle_shown() to bun_app;
grant execute on function public.bun_puzzle_past(date) to bun_app;

do $$
declare
  t text;
  pol text := 'bun_deny_direct';
begin
  for t in
    select format('%I.%I', n.nspname, c.relname)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname like 'bun\_%' escape '\'
       and c.relrowsecurity
  loop
    if not exists (
      select 1
        from pg_policies p
       where p.schemaname = 'public'
         and p.tablename = split_part(t, '.', 2)
         and p.policyname = pol
    ) then
      execute format(
        'create policy %I on %s for all to public using (false) with check (false)',
        pol, t
      );
    end if;
  end loop;
end $$;
