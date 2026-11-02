-- PostgREST GET transactions are READ ONLY: tuple locks are prohibited.
-- A per-organization transaction boundary preserves shutdown serialization.
begin;
create function public.lock_organization_read_only(p_org uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if p_org is null or current_setting('transaction_isolation')<>'read committed' then return false; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('coach-house:closure-read:'||p_org::text,0)) then return false; end if;
 -- VOLATILE: fresh command snapshot after admission, never a stale preflight.
 return exists(select 1 from public.organizations where user_id=p_org);
end $$;
revoke all on function public.lock_organization_read_only(uuid) from public,anon,authenticated,service_role;

create function public.guard_organization_read_only_boundary() returns trigger
 language plpgsql security definer set search_path='' as $$
declare old_org uuid; new_org uuid; org uuid; key text;
begin
 key:=case when tg_table_name='organizations' then 'user_id' else 'org_id' end;
 if tg_op<>'INSERT' then old_org:=(to_jsonb(old)->>key)::uuid; end if;
 if tg_op<>'DELETE' then new_org:=(to_jsonb(new)->>key)::uuid; end if;
 for org in select distinct id from unnest(array[old_org,new_org]) id where id is not null order by id loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('coach-house:closure-read:'||org::text,0));
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.guard_organization_read_only_boundary() from public,anon,authenticated,service_role;
-- Alphabetically first: no shutdown/publication side effect precedes admission.
create trigger a_organization_read_only_boundary before insert or update or delete on public.organizations
 for each row execute function public.guard_organization_read_only_boundary();
create trigger a_organization_read_only_boundary before insert or update or delete on public.organization_closures
 for each row execute function public.guard_organization_read_only_boundary();
create trigger a_organization_read_only_boundary before insert or update or delete on public.organization_memberships
 for each row execute function public.guard_organization_read_only_boundary();
create or replace function public.guard_organization_closure(p_org_id uuid,p_export_read boolean default false)
 returns boolean language plpgsql security definer set search_path='' as $$
declare closure public.organization_closures%rowtype;
begin
 -- Every joined writer/reader holds the organization lock through its effect.
 -- Request/cancel uses UPDATE on the same row. No unlocked preflight authority.
 if current_setting('transaction_read_only')='on' then
  if not public.lock_organization_read_only(p_org_id) then
   raise exception 'Organization unavailable' using errcode='42501'; end if;
 else
  perform 1 from public.organizations where user_id=p_org_id for share;
  if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state='active' then return false; end if;
 if p_export_read is distinct from true or clock_timestamp()>=closure.export_until then
   raise exception 'Organization unavailable' using errcode='42501'; end if;
 return true;
end; $$;

create or replace function public.organization_closure_read_window(p_org uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then return false; end if;
 if current_setting('transaction_read_only')='on' then
  if not public.lock_organization_read_only(p_org) then return false; end if;
 else
  perform 1 from public.organizations where user_id=p_org for share nowait;
  if not found then return false; end if;
 end if;
 perform public.guard_organization_closure(p_org,true);
 return true;
exception when insufficient_privilege or lock_not_available then return false;
end $$;

create or replace function public.can_read_calendar_during_closure(p_org uuid,p_public_event uuid default null)
 returns boolean language plpgsql security definer set search_path='' as $$
declare private_reader boolean; closing boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then return false; end if;
 -- RLS also runs for UPDATE selection; never wait on an org while holding an
 -- event tuple. Denied/busy reads expose no rows and are safe to retry.
 if current_setting('transaction_read_only')='on' then
  if not public.lock_organization_read_only(p_org) then return false; end if;
 else
  perform 1 from public.organizations where user_id=p_org for share nowait;
  if not found then return false; end if;
 end if;
 private_reader:=auth.uid() is not null and (auth.uid()=p_org or public.is_admin());
 if not private_reader and auth.uid() is not null then
  if current_setting('transaction_read_only')='on' then
   -- Membership mutations take the same exclusive org boundary above.
   private_reader:=exists(select 1 from public.organization_memberships where org_id=p_org and member_id=auth.uid());
  else
   perform 1 from public.organization_memberships where org_id=p_org and member_id=auth.uid() for share nowait;
   private_reader:=found;
  end if;
 end if;
 closing:=public.guard_organization_closure(p_org,private_reader);
 if private_reader then return true; end if;
 return p_public_event is not null and not closing
  and not exists(select 1 from public.organization_calendar_publication_revocations where event_id=p_public_event)
  and exists(select 1 from public.organizations where user_id=p_org and is_public_roadmap);
exception when insufficient_privilege or lock_not_available then return false;
end $$;

create or replace function public.guard_uploaded_document_organization(p_org uuid) returns void
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 begin
   if current_setting('transaction_read_only')='on' then
    if not public.lock_organization_read_only(p_org) then
     raise exception 'Organization is changing; retry document edit' using errcode='40001'; end if;
   else
    perform 1 from public.organizations where user_id=p_org for share nowait;
    if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
   end if;
 exception when lock_not_available then
   raise exception 'Organization is changing; retry document edit' using errcode='40001';
 end;
 perform public.guard_organization_closure(p_org);
end; $$;
-- CREATE OR REPLACE retains existing ACLs. No lifecycle RPC or new helper grant.
commit;
