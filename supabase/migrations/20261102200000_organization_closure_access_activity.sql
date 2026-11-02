-- Access admission and canonical activity join closure; contraction remains valid.
begin;
do $$ begin
 if exists(select 1 from public.organization_closures where state='closing') then
   raise exception 'Reconcile active closures before installing access shutdown'; end if;
end $$;

create function public.guard_organization_access_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid; field text; parent_missing boolean;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 -- Removing membership/invitation/request access is never new admission. RLS
 -- and existing caller authorization still apply, including account cleanup.
 if tg_op='DELETE' and tg_table_name<>'organization_access_settings' then return old; end if;
 if tg_op='UPDATE' then
   foreach field in array array['id','org_id','member_id','invitee_user_id'] loop
     if to_jsonb(new)->field is distinct from to_jsonb(old)->field then
       raise exception 'Organization access identity cannot change' using errcode='42501'; end if;
   end loop;
   if tg_table_name='organization_access_requests' then
     if old.status='pending' and new.status in ('revoked','declined','expired')
       and (to_jsonb(old)-array['status','responded_at','updated_at'])=(to_jsonb(new)-array['status','responded_at','updated_at']) then return new; end if;
   end if;
   foreach field in array array['invited_by','invited_by_user_id','organization_invite_id'] loop
     if pg_trigger_depth()>1 and to_jsonb(old)->>field is not null and to_jsonb(new)->>field is null
       and (to_jsonb(old)-array[field,'updated_at'])=(to_jsonb(new)-array[field,'updated_at']) then
       parent_missing:=case field
         when 'invited_by' then not exists(select 1 from auth.users where id=(to_jsonb(old)->>field)::uuid)
         when 'invited_by_user_id' then not exists(select 1 from public.profiles where id=(to_jsonb(old)->>field)::uuid)
         else not exists(select 1 from public.organization_invites where id=(to_jsonb(old)->>field)::uuid) end;
       if parent_missing then return new; end if;
     end if;
   end loop;
 end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_organization_access_closure() from public,anon,authenticated,service_role;
create trigger organization_access_closure before insert or update or delete on public.organization_access_settings
 for each row execute function public.guard_organization_access_closure();
create trigger organization_membership_closure before insert or update or delete on public.organization_memberships
 for each row execute function public.guard_organization_access_closure();
create trigger organization_invite_closure before insert or update or delete on public.organization_invites
 for each row execute function public.guard_organization_access_closure();
create trigger organization_access_request_closure before insert or update or delete on public.organization_access_requests
 for each row execute function public.guard_organization_access_closure();

create function public.revoke_organization_pending_access_on_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' or (tg_op='UPDATE' and old.state='closing') then return new; end if;
 -- Admission holds the organization row first. A separate revocation/account
 -- cleanup may already own a child tuple: fail retryably rather than invert locks.
 begin
   perform 1 from public.organization_access_requests where org_id=new.org_id and status='pending' order by id for update nowait;
   perform 1 from public.organization_invites where org_id=new.org_id and accepted_at is null order by id for update nowait;
 exception when lock_not_available then
   raise exception 'Organization access is changing; retry closure' using errcode='40001';
 end;
 update public.organization_access_requests set status='revoked',responded_at=clock_timestamp()
 where org_id=new.org_id and status='pending';
 delete from public.organization_invites where org_id=new.org_id and accepted_at is null;
 return new;
end; $$;
revoke all on function public.revoke_organization_pending_access_on_closure() from public,anon,authenticated,service_role;
create trigger organization_closure_pending_access after insert or update of state on public.organization_closures
 for each row execute function public.revoke_organization_pending_access_on_closure();

-- Only trusted trigger code can issue a one-use exact-row admission. Application
-- roles cannot read/write it or mint receipts via caller-controlled session flags.
-- The activity BEFORE trigger consumes it in the same transaction; no admission
-- survives a successful INSERT, failed INSERT or transaction rollback.
create table public.organization_closure_activity_admissions(
 event_id uuid primary key, transaction_id bigint not null, event_payload jsonb not null
);
alter table public.organization_closure_activity_admissions enable row level security;
alter table public.organization_closure_activity_admissions force row level security;
revoke all on public.organization_closure_activity_admissions from public,anon,authenticated,service_role;

create function public.guard_organization_activity_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare admitted boolean; field text; org uuid;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='INSERT' then
   delete from public.organization_closure_activity_admissions
   where event_id=new.id and transaction_id=txid_current() and event_payload=to_jsonb(new)
   returning true into admitted;
   if admitted then return new; end if;
 elsif tg_op='UPDATE' then
   foreach field in array array['id','org_id','entity_type','entity_id'] loop
     if to_jsonb(new)->field is distinct from to_jsonb(old)->field then
       raise exception 'Organization activity identity cannot change' using errcode='42501'; end if;
   end loop;
   if pg_trigger_depth()>1 and old.actor_id is not null and new.actor_id is null and
     (to_jsonb(old)-'actor_id')=(to_jsonb(new)-'actor_id') and not exists(select 1 from public.profiles where id=old.actor_id) then return new; end if;
   if pg_trigger_depth()>1 and old.project_id is not null and new.project_id is null and
     (to_jsonb(old)-'project_id')=(to_jsonb(new)-'project_id') and not exists(select 1 from public.organization_projects where id=old.project_id) then return new; end if;
   if new.project_id is distinct from old.project_id then
     raise exception 'Organization activity project cannot change' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_organization_activity_closure() from public,anon,authenticated,service_role;
create trigger organization_activity_closure before insert or update or delete on public.organization_project_activity_events
 for each row execute function public.guard_organization_activity_closure();

create or replace function public.record_organization_file_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  current jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  item jsonb := coalesce(current, previous);
  event_kind text;
  event_row public.organization_project_activity_events%rowtype;
  cleanup boolean:=false;
  field text;
begin
  if not exists (select 1 from public.organizations where user_id = (item->>'org_id')::uuid) then
    return coalesce(new, old); -- Organization cascade deletion must remain possible.
  end if;
  -- Compliance uploads are already captured by their profile document mutation.
  if tg_table_name = 'organization_document_files' and item->>'document_kind' is not null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and (previous->>'deleted_at' is not null or previous->>'status' = 'trashed') then
    return old; -- Retention cleanup is not a second user removal.
  end if;
  if tg_op = 'UPDATE'
    and (previous - array['updated_at', 'last_checked_at', 'last_synced_at']) is not distinct from (current - array['updated_at', 'last_checked_at', 'last_synced_at'])
  then return new; end if;
  event_kind := case
    when tg_op = 'DELETE' then 'removed'
    when tg_op = 'INSERT' then 'uploaded'
    when (previous->>'deleted_at' is null and current->>'deleted_at' is not null) or (previous->>'status' is distinct from 'trashed' and current->>'status' = 'trashed') then 'removed'
    when (previous->>'deleted_at' is not null and current->>'deleted_at' is null) or (previous->>'status' = 'trashed' and current->>'status' is distinct from 'trashed') then 'restored'
    else 'updated' end;
  -- Mirror only cleanup already authorized by the source-row fences. The
  -- trigger has real OLD/NEW tuples; a nested forged INSERT has neither proof.
  -- AFTER events queued by an FK can run after the RI trigger stack unwinds;
  -- exact OLD/NEW plus actual missing/revoked parent is the proof, not depth.
  if tg_op='UPDATE' then
    if tg_table_schema='public' and tg_table_name='organization_external_documents' then
      cleanup:=
        (previous->>'attached_by' is not null and current->>'attached_by' is null
          and (previous-array['attached_by','updated_at'])=(current-array['attached_by','updated_at'])
          and not exists(select 1 from public.profiles where id=(previous->>'attached_by')::uuid))
        or (previous->>'connection_id' is not null and current->>'connection_id' is null
          and current->>'status'='needs_reconnect'
          and (previous-array['connection_id','status','last_verified_at','updated_at'])=(current-array['connection_id','status','last_verified_at','updated_at'])
          and not exists(select 1 from public.google_drive_connections where id=(previous->>'connection_id')::uuid))
        or (previous->>'connection_id' is not null and current->>'status'='needs_reconnect'
          and (previous-array['status','last_verified_at','updated_at'])=(current-array['status','last_verified_at','updated_at'])
          and exists(select 1 from public.google_drive_connections where id=(previous->>'connection_id')::uuid and status<>'connected'));
    elsif tg_table_schema='public' and tg_table_name='organization_project_assets' then
      foreach field in array array['created_by','updated_by'] loop
        if previous->>field is not null and current->>field is null
          and (previous-array[field,'updated_at'])=(current-array[field,'updated_at'])
          and not exists(select 1 from public.profiles where id=(previous->>field)::uuid) then cleanup:=true; end if;
      end loop;
    end if;
  end if;
  event_row.id:=gen_random_uuid(); event_row.org_id:=(item->>'org_id')::uuid;
  select id into event_row.project_id from public.organization_projects where id=(item->>'project_id')::uuid;
  event_row.entity_type:='file'; event_row.entity_id:=(item->>'id')::uuid; event_row.event_type:=event_kind;
  event_row.title:=left(coalesce(nullif(item->>'name',''),'File'),240);
  event_row.actor_id:=public.organization_activity_actor_id();
  event_row.metadata:=jsonb_build_object('source',tg_table_name); event_row.occurred_at:=timezone('utc',now());
  if cleanup then
    insert into public.organization_closure_activity_admissions(event_id,transaction_id,event_payload)
    values(event_row.id,txid_current(),to_jsonb(event_row));
  end if;
  insert into public.organization_project_activity_events select event_row.*;
  return coalesce(new, old);
end;
$$;


revoke all on function public.record_organization_file_activity() from public,anon,authenticated,service_role;
comment on table public.organization_closure_activity_admissions is
 'Private transaction-local one-use exact-row authorization for source-validated cleanup audit inserts; consumed immediately, not durable permissions or user data storage.';
comment on function public.guard_organization_access_closure() is
 'Fences organization access admission/settings; exact revocation and FK cleanup remain under existing RLS. Closure revokes pending invitations without removing export membership or restoring it on cancel.';
commit;
