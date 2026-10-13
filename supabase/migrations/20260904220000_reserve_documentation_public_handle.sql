-- The documentation route owns this namespace. Preserve any existing claim
-- for explicit resolution rather than silently deleting or reassigning it.
do $$
begin
  if exists (select 1 from public.public_handles where handle = 'documentation') then
    raise exception 'The documentation handle is already claimed; resolve its ownership before deploying the documentation route.';
  end if;
end;
$$;
insert into public.public_handle_reservations (handle, reason)
values ('documentation', 'Public documentation route')
on conflict (handle) do nothing;
