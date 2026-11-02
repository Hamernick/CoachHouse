-- Durable withdrawal of non-page organization publication and fresh public reads.
begin;
do $$ begin
 if exists(select 1 from public.organization_closures where state='closing') then
  raise exception 'Reconcile active closures before public profile upgrade'; end if;
end $$;
create function public.close_organization_public_flags() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' then return new; end if;
 if tg_op='UPDATE' and old.state='closing' then return new; end if;
 -- BEFORE the lifecycle row changes: use the ordinary canonical organization
 -- writer while prior state is active. The command owns organization UPDATE;
 -- all later shutdown hooks/receipts roll this withdrawal back on failure.
 update public.organizations set is_public=false,is_public_roadmap=false where user_id=new.org_id;
 -- Canonical programs currently belonging to this organization only. Personal
 -- programs without this organization and programs in other organizations remain.
 update public.programs set is_public=false where user_id=new.org_id;
 return new;
end $$;
revoke all on function public.close_organization_public_flags() from public,anon,authenticated,service_role;
create trigger organization_closure_public_flags before insert or update of state on public.organization_closures
 for each row execute function public.close_organization_public_flags();

create function public.filter_public_organization_ids(p_ids uuid[],p_audience text default 'profile') returns uuid[]
 language plpgsql security definer set search_path='' as $$
declare org uuid; allowed uuid[]:='{}';
begin
 if current_setting('transaction_isolation')<>'read committed' or p_ids is null or cardinality(p_ids)>500 or p_audience is null or p_audience not in ('profile','roadmap') then return allowed; end if;
 for org in select distinct id from unnest(p_ids) id where id is not null order by id loop
  begin
   perform 1 from public.organizations where user_id=org for share nowait;
   if not found then continue; end if;
   perform public.guard_organization_closure(org);
   if exists(select 1 from public.organizations where user_id=org and case when p_audience='roadmap' then is_public_roadmap else is_public end) then allowed:=array_append(allowed,org); end if;
  exception when insufficient_privilege or lock_not_available then null;
  end;
 end loop;
 return allowed;
end $$;
revoke all on function public.filter_public_organization_ids(uuid[],text) from public,anon,authenticated;
grant execute on function public.filter_public_organization_ids(uuid[],text) to service_role;

create function public.organization_closure_read_window(p_org uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then return false; end if;
 perform 1 from public.organizations where user_id=p_org for share nowait;
 if not found then return false; end if;
 perform public.guard_organization_closure(p_org,true);
 return true;
exception when insufficient_privilege or lock_not_available then return false;
end $$;
revoke all on function public.organization_closure_read_window(uuid) from public,anon,authenticated,service_role;
grant execute on function public.organization_closure_read_window(uuid) to anon,authenticated;
-- Restrictive only: existing ownership/membership/support/public policies still
-- decide authority. This helper grants no dataset or response rights.
create policy organization_closure_read on public.organizations as restrictive
 for select to anon,authenticated using(public.organization_closure_read_window(user_id));
comment on function public.filter_public_organization_ids(uuid[],text) is
 'Fresh bounded current-publicity/closure admission for server projections after caches. Cancel restores neither public flags. Already returned bytes and external media need independent retirement.';
commit;
