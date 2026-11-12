-- Explicit grants/options can survive older deployments and view replacement.
begin;
alter view public.search_index set (security_invoker = true);
revoke all on public.search_index from public, anon, authenticated;
revoke all on function public.search_global(text, uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.search_global(text, uuid, boolean, integer) to authenticated;
commit;
