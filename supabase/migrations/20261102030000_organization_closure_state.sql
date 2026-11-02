-- Closure state and native-response boundary. NOT a launchable closure flow.
-- Keep the transition RPC unavailable to service_role until every admission,
-- publication, connector, billing and cleanup owner has joined this boundary.
begin;
create table public.organization_closures (
 org_id uuid primary key references public.organizations(user_id) on delete cascade,
 state text not null check(state in ('active','closing')),
 revision integer not null check(revision>0),
 request_id uuid,
 requested_at timestamptz,
 export_until timestamptz,
 check((state='active' and request_id is null and requested_at is null and export_until is null)
   or (state='closing' and request_id is not null and requested_at is not null and export_until is not null
       and export_until=requested_at+interval '720 hours'))
);
create table public.organization_closure_operations (
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 operation_id uuid not null,
 action text not null check(action in ('request','cancel')),
 expected_revision integer not null check(expected_revision>=0),
 completed_at timestamptz not null default clock_timestamp(),
 primary key(org_id,operation_id)
);
alter table public.organization_closures enable row level security;
alter table public.organization_closure_operations enable row level security;
revoke all on public.organization_closures,public.organization_closure_operations from public,anon,authenticated,service_role;
comment on table public.organization_closures is
 'Explicit owner closure only. Missing row means active revision zero. Clock-bound restricted export; no automatic purge, grant restoration or publication on cancel. Not independent backup suppression.';
comment on table public.organization_closure_operations is
 'Minimal exact-operation identity. Replay returns current lifecycle state and never repeats a transition. Not a provider reconciliation receipt.';

create function public.organization_closure_command(
 p_actor_id uuid,p_org_id uuid,p_action text,p_operation_id uuid default null,p_expected_revision integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_state public.organization_closures%rowtype;
 previous public.organization_closure_operations%rowtype; at_time timestamptz;
begin
 -- Existing canonical ownership, not a membership label or caller role string.
 if p_actor_id is null or p_actor_id is distinct from p_org_id then
   raise exception 'Organization owner required' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 if p_action is null or p_action not in ('status','request','cancel') then
   raise exception 'Invalid closure action' using errcode='22023'; end if;
 if (p_action='status' and (p_operation_id is not null or p_expected_revision is not null))
   or (p_action<>'status' and (p_operation_id is null or p_expected_revision is null
     or p_expected_revision<0 or p_expected_revision>=2147483647)) then
   raise exception 'Invalid closure command' using errcode='22023'; end if;
 select * into current_state from public.organization_closures where org_id=p_org_id;
 if not found then current_state.state:='active'; current_state.revision:=0; end if;
 if p_action<>'status' then
   select * into previous from public.organization_closure_operations where org_id=p_org_id and operation_id=p_operation_id;
   if found then
     if previous.action is distinct from p_action or previous.expected_revision is distinct from p_expected_revision then
       raise exception 'Closure operation reused' using errcode='23505'; end if;
     -- A lost-reply retry cannot reclose after cancellation or cancel a new request.
   else
     if current_state.revision<>p_expected_revision then
       raise exception 'Closure changed' using errcode='40001'; end if;
     at_time:=clock_timestamp();
     if p_action='request' then
       if current_state.state<>'active' then raise exception 'Closure already requested' using errcode='40001'; end if;
       current_state.state:='closing'; current_state.request_id:=p_operation_id;
       current_state.requested_at:=at_time; current_state.export_until:=at_time+interval '720 hours';
     else
       if current_state.state<>'closing' or at_time>=current_state.export_until then
         raise exception 'Closure cannot be canceled' using errcode='42501'; end if;
       current_state.state:='active'; current_state.request_id:=null;
       current_state.requested_at:=null; current_state.export_until:=null;
     end if;
     current_state.revision:=current_state.revision+1;
     insert into public.organization_closures(org_id,state,revision,request_id,requested_at,export_until)
       values(p_org_id,current_state.state,current_state.revision,current_state.request_id,current_state.requested_at,current_state.export_until)
       on conflict(org_id) do update set state=excluded.state,revision=excluded.revision,request_id=excluded.request_id,
         requested_at=excluded.requested_at,export_until=excluded.export_until;
     insert into public.organization_closure_operations(org_id,operation_id,action,expected_revision)
       values(p_org_id,p_operation_id,p_action,p_expected_revision);
   end if;
 end if;
 return jsonb_build_object('organizationId',p_org_id,'state',current_state.state,'revision',current_state.revision,
   'requestId',current_state.request_id,'requestedAt',current_state.requested_at,'exportUntil',current_state.export_until);
end; $$;
revoke all on function public.organization_closure_command(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
comment on function public.organization_closure_command(uuid,uuid,text,uuid,integer) is
 'Unexposed lifecycle foundation. No API/service-role execution grant until cross-owner shutdown and cleanup qualify. Cancel changes lifecycle only; never republish or reinstate revoked access.';

create function public.guard_organization_closure(p_org_id uuid,p_export_read boolean default false)
 returns boolean language plpgsql security definer set search_path='' as $$
declare closure public.organization_closures%rowtype;
begin
 -- Every joined writer/reader holds the organization lock through its effect.
 -- Request/cancel uses UPDATE on the same row. No unlocked preflight authority.
 perform 1 from public.organizations where user_id=p_org_id for share;
 if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state='active' then return false; end if;
 if p_export_read is distinct from true or clock_timestamp()>=closure.export_until then
   raise exception 'Organization unavailable' using errcode='42501'; end if;
 return true;
end; $$;
revoke all on function public.guard_organization_closure(uuid,boolean) from public,anon,authenticated,service_role;

-- Preserve the established canonical writer and its authorization/replay rules.
-- Only this wrapper is reachable from the application. Later intake migrations
-- must preserve it and update the internal implementation deliberately.
alter function public.organization_form_intake(uuid,jsonb) rename to organization_form_intake_before_closure;
revoke all on function public.organization_form_intake_before_closure(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.organization_form_intake(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare org uuid; closing boolean; result jsonb;
begin
 select org_id into org from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 if not found then raise exception 'Form unavailable' using errcode='42501'; end if;
 -- Match the canonical guest path's UPDATE lock first; avoid SHARE->UPDATE
 -- upgrades against another guest read. All other paths use SHARE.
 if p_command->>'audience'='guest' and p_command->>'action' in ('version','submit') then
   perform 1 from public.organizations where user_id=org for update;
 end if;
 closing:=public.guard_organization_closure(org,p_command->>'action' in ('responses','response','editor_version'));
 result:=public.organization_form_intake_before_closure(p_actor_id,p_command);
 if closing and p_command->>'action'='responses' then
   result:=jsonb_set(result,'{permissions}',jsonb_build_object('canDelete',false,'canCorrect',false,
     'canEditDefinition',false,'canManageAccess',false,'canManageInvitations',false,'hasPendingInvitation',false));
 end if;
 return result;
end; $$;
revoke all on function public.organization_form_intake(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_intake(uuid,jsonb) to service_role;
commit;
