begin;
-- Replacing the view in 160000 cleared its reloptions on hosted PostgreSQL.
-- Preserve the original invoker boundary as well as the private client ACL.
alter view public.search_index set (security_invoker = true);
revoke all on public.search_index from public, anon, authenticated;
commit;
