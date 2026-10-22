create table auth.users(id uuid primary key);
insert into auth.users select id from public.profiles;
insert into public.organizations(user_id) values ('00000000-0000-0000-0000-000000000004');
create function public.assert_ai(condition boolean, message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'Assertion: %',message; end if; end $$;
