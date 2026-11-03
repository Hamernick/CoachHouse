-- Organization export consent is distinct from a user's shared Google identity.
begin;
create function public.authorize_organization_calendar_export(p_actor_id uuid,p_org_id uuid)
 returns boolean language plpgsql security definer set search_path='' as $$
declare member_role text;
begin
 if p_actor_id is null or p_org_id is null then return false;end if;
 -- NOWAIT rejects reverse-order workers instead of deadlocking closure.
 perform public.guard_uploaded_document_organization(p_org_id);
 if p_actor_id=p_org_id then return true;end if;
 select role::text into member_role from public.organization_memberships
  where org_id=p_org_id and member_id=p_actor_id for share nowait;
 return coalesce(member_role in ('admin','staff','board'),false);
exception when insufficient_privilege or serialization_failure or lock_not_available then return false;
end $$;
revoke all on function public.authorize_organization_calendar_export(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.authorize_organization_calendar_export(uuid,uuid) to service_role;

create function public.guard_calendar_export_selection() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.export_org_id is not null
  and not public.authorize_organization_calendar_export(new.user_id,new.export_org_id) then
  raise exception 'Organization calendar export unavailable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_calendar_export_selection() from public,anon,authenticated,service_role;
create trigger organization_calendar_export_selection before insert or update of export_org_id,user_id
 on public.google_calendar_connections for each row execute function public.guard_calendar_export_selection();

create function public.withdraw_closing_calendar_exports() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' then return new;end if;
 -- Keep destination IDs/fingerprints as evidence for provider reconciliation.
 -- Invalidate only workers currently exporting this organization. Personal
 -- credentials, imports/caches and every other destination remain unchanged.
 perform 1 from public.google_calendar_connections where export_org_id=new.org_id
  order by user_id for update nowait;
 update public.google_calendar_connections set export_org_id=null,
  revision=gen_random_uuid(),lease_id=null,lease_expires_at=null,updated_at=clock_timestamp()
  where export_org_id=new.org_id;
 return new;
end $$;
revoke all on function public.withdraw_closing_calendar_exports() from public,anon,authenticated,service_role;
create trigger organization_closure_calendar_exports after insert or update of state
 on public.organization_closures for each row execute function public.withdraw_closing_calendar_exports();

-- Existing closures receive the same scoped withdrawal. Admission already
-- denies them; cancellation never recreates a previous export selection.
do $$
declare org uuid;
begin
 for org in select org_id from public.organization_closures where state='closing' order by org_id loop
  perform 1 from public.organizations where user_id=org for update;
  perform 1 from public.google_calendar_connections where export_org_id=org order by user_id for update nowait;
  update public.google_calendar_connections set export_org_id=null,
   revision=gen_random_uuid(),lease_id=null,lease_expires_at=null,updated_at=clock_timestamp()
   where export_org_id=org;
 end loop;
end $$;
comment on function public.withdraw_closing_calendar_exports() is
 'Withdraws only this organization export selection and current worker lease. Preserves shared credentials, personal caches and destination effect evidence. No claim that an already admitted HTTP effect was canceled or external Google content erased; current provider reconciliation remains required.';
commit;
