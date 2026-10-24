-- The existing objective policies call this platform-admin predicate. Fixture actors are not platform admins.
create function public.is_admin() returns boolean language sql stable as $$ select false $$;
