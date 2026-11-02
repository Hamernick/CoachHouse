-- Staff-hosted guest records retain their owner; account links are independent.
begin;
do $$ begin
 if exists(select 1 from public.organization_closures where state='closing') then
  raise exception 'Reconcile active closures before enabling fiscal ancillary shutdown'; end if;
end $$;
alter table public.fiscal_guest_email_outbox add column closure_suppressed_at timestamptz;
alter table public.fiscal_staff_email_outbox add column closure_suppressed_at timestamptz;

create function public.fiscal_ancillary_owner(p_table text,p_row jsonb) returns uuid
 language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 if p_table='fiscal_guest_intake_settings' then return (p_row->>'org_id')::uuid; end if;
 if p_table='fiscal_guest_submissions' then
  select org_id into org from public.fiscal_sponsorship_applications where id=(p_row->>'application_id')::uuid;
 elsif p_table='fiscal_project_reviewers' then
  select org_id into org from public.organization_projects where id=(p_row->>'project_id')::uuid;
 elsif p_table='fiscal_staff_email_outbox' then
  select org_id into org from public.fiscal_sponsorship_events where id=(p_row->>'event_id')::uuid;
 else
  select a.org_id into org from public.fiscal_guest_submissions s
   join public.fiscal_sponsorship_applications a on a.id=s.application_id where s.id=(p_row->>'submission_id')::uuid;
 end if;
 return org;
end; $$;
revoke all on function public.fiscal_ancillary_owner(text,jsonb) from public,anon,authenticated,service_role;

create function public.guard_fiscal_ancillary_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; org uuid; field text; destination uuid; delivery boolean;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=public.fiscal_ancillary_owner(tg_table_name,row_data);
 delivery:=tg_table_name in ('fiscal_guest_email_outbox','fiscal_staff_email_outbox');
 if tg_op='INSERT' then
  -- Independent historical FKs must not admit a new cross-host reference.
  if tg_table_name='fiscal_guest_submissions' and not exists(select 1 from public.fiscal_sponsorship_applications
    where id=(row_data->>'application_id')::uuid and project_id=(row_data->>'project_id')::uuid)
   or tg_table_name='fiscal_guest_email_proofs' and not exists(select 1 from public.fiscal_guest_email_outbox
    where id=(row_data->>'job_id')::uuid and submission_id=(row_data->>'submission_id')::uuid)
   or tg_table_name='fiscal_staff_email_outbox' and not exists(select 1 from public.fiscal_sponsorship_events
    where id=(row_data->>'event_id')::uuid and project_id=(row_data->>'project_id')::uuid and event_type=row_data->>'event_type') then
   raise exception 'Fiscal ancillary parent scope mismatch' using errcode='42501';
  end if;
  if tg_table_name='fiscal_guest_email_outbox' and row_data->>'event_id' is not null
   and not exists(select 1 from public.fiscal_guest_submissions s join public.fiscal_sponsorship_events e on e.project_id=s.project_id
    where s.id=(row_data->>'submission_id')::uuid and e.id=(row_data->>'event_id')::uuid) then
   raise exception 'Fiscal ancillary parent scope mismatch' using errcode='42501';
  end if;
 end if;
 if tg_op='UPDATE' then
  foreach field in array array['id','submission_id','application_id','project_id','job_id','event_id','key_hash',
   'token_hash','nonce','event_type','kind','recipient','submission_key_hash','contact_email','org_id','user_id','actor_id','applicant_user_id','system_actor_id','request_id','request_hash','basis'] loop
   if to_jsonb(old)->field is distinct from row_data->field then
    raise exception 'Fiscal ancillary identity cannot change' using errcode='42501'; end if;
  end loop;
  if tg_table_name='fiscal_guest_submissions' and to_jsonb(old)->>'claimed_org_id' is not null
   and (row_data->'claimed_org_id' is distinct from to_jsonb(old)->'claimed_org_id' or row_data->'claimed_user_id' is distinct from to_jsonb(old)->'claimed_user_id') then
   raise exception 'Fiscal claim identity cannot change' using errcode='42501'; end if;
 end if;
 if delivery then
  if tg_op='INSERT' and new.closure_suppressed_at is not null then
   raise exception 'Fiscal suppression is lifecycle-owned' using errcode='42501'; end if;
  if tg_op='UPDATE' then
   -- Only exact shutdown metadata can cross the fence. The private lifecycle
   -- trigger runs in the same org-locked transaction as request/cancel CAS.
   if old.closure_suppressed_at is null and new.closure_suppressed_at is not null and pg_trigger_depth()>1
    and exists(select 1 from public.organization_closures where org_id=org and state='closing')
    and (to_jsonb(old)-array['closure_suppressed_at','status'])=(to_jsonb(new)-array['closure_suppressed_at','status'])
    and new.status=(case when old.status='pending' then 'failed' else old.status end) then return new; end if;
   if new.closure_suppressed_at is distinct from old.closure_suppressed_at then
    raise exception 'Fiscal suppression is lifecycle-owned' using errcode='42501'; end if;
   if old.closure_suppressed_at is not null then
    -- Retain a completion for an already leased provider request. Failed late
    -- completions become terminal; they cannot recreate pending work on cancel.
    if old.status='sending' and old.lease_token is not null and new.status in ('sent','failed','pending')
     and new.lease_token is null and new.leased_until is null
     and (to_jsonb(old)-array['status','provider_message_id','last_error_code','sent_at','available_at','leased_until','lease_token'])=
         (to_jsonb(new)-array['status','provider_message_id','last_error_code','sent_at','available_at','leased_until','lease_token']) then
      if new.status='pending' then new.status:='failed'; end if;
      return new;
    end if;
    raise exception 'Fiscal delivery permanently suppressed' using errcode='42501';
   end if;
  elsif tg_op='DELETE' and old.closure_suppressed_at is not null then
   raise exception 'Fiscal delivery permanently suppressed' using errcode='42501';
  end if;
 end if;
 -- These are revocations/ephemeral proof cleanup, never new authority or history
 -- erasure. Preserve the existing caller ACLs while an organization is closing.
 if tg_op='DELETE' and tg_table_name in ('fiscal_project_reviewers','fiscal_guest_verified_sessions',
   'fiscal_guest_email_proofs','fiscal_guest_intake_settings') then return old; end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_table_name='fiscal_application_organization_links' then destination:=(row_data->>'org_id')::uuid;
 elsif tg_table_name='fiscal_guest_profile_imports' then destination:=(row_data->>'user_id')::uuid;
 elsif tg_table_name='fiscal_guest_submissions' and tg_op<>'DELETE' then
  if tg_op='INSERT' or row_data->'claimed_org_id' is distinct from to_jsonb(old)->'claimed_org_id' then destination:=(row_data->>'claimed_org_id')::uuid; end if;
 end if;
 if destination is not null and destination is distinct from org then perform public.guard_uploaded_document_organization(destination); end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_fiscal_ancillary_closure() from public,anon,authenticated,service_role;
do $$ declare relation text; begin
 foreach relation in array array['fiscal_guest_intake_settings','fiscal_guest_submissions','fiscal_project_reviewers',
 'fiscal_guest_email_proofs','fiscal_guest_verified_sessions','fiscal_guest_profile_imports','fiscal_guest_application_revisions',
 'fiscal_application_organization_links','fiscal_guest_email_outbox','fiscal_staff_email_outbox'] loop
 execute format('create trigger fiscal_ancillary_closure before insert or update or delete on public.%I for each row execute function public.guard_fiscal_ancillary_closure()',relation);
 end loop;
end $$;

create function public.suppress_fiscal_delivery_on_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' then return new; end if;
 update public.fiscal_guest_email_outbox q set closure_suppressed_at=clock_timestamp(),
  status=case when q.status='pending' then 'failed' else q.status end
 from public.fiscal_guest_submissions s join public.fiscal_sponsorship_applications a on a.id=s.application_id
 where q.submission_id=s.id and a.org_id=new.org_id and q.status<>'sent' and q.closure_suppressed_at is null;
 update public.fiscal_staff_email_outbox q set closure_suppressed_at=clock_timestamp(),
  status=case when q.status='pending' then 'failed' else q.status end
 from public.fiscal_sponsorship_events e where e.id=q.event_id and e.org_id=new.org_id
  and q.status<>'sent' and q.closure_suppressed_at is null;
 return new;
end; $$;
revoke all on function public.suppress_fiscal_delivery_on_closure() from public,anon,authenticated,service_role;
create trigger fiscal_delivery_shutdown after insert or update of state on public.organization_closures
 for each row execute function public.suppress_fiscal_delivery_on_closure();

-- Preserve every deployed envelope version. Patch only its ready CTE; existing
-- recipient revocation, attempt limits and frozen message payloads remain intact.
do $$ declare fn text; definition text; ready text; updated text; start_at integer; end_at integer; begin
 foreach fn in array array['claim_fiscal_guest_emails','claim_fiscal_guest_emails_v3','claim_fiscal_guest_emails_v4',
  'claim_fiscal_staff_emails','claim_fiscal_staff_emails_v2'] loop
  definition:=pg_get_functiondef(('public.'||fn||'()')::regprocedure);
  start_at:=strpos(definition,'with ready as ('); end_at:=strpos(definition,'), claimed as (');
  if start_at=0 or end_at<=start_at then raise exception 'Unexpected fiscal claim CTE: %',fn; end if;
  ready:=substring(definition from start_at for end_at-start_at);
  if strpos(ready,'where ')=0 or strpos(ready,'order by ')=0 then raise exception 'Unexpected fiscal claim predicate: %',fn; end if;
  updated:=replace(replace(ready,'where ','where closure_suppressed_at is null and ('),'order by ',') order by ');
  execute replace(definition,ready,updated);
 end loop;
end $$;

alter function public.fiscal_guest_email_send_allowed(uuid,uuid) rename to fiscal_guest_email_send_allowed_pre_closure;
alter function public.fiscal_staff_email_send_allowed(uuid,uuid) rename to fiscal_staff_email_send_allowed_pre_closure;
revoke all on function public.fiscal_guest_email_send_allowed_pre_closure(uuid,uuid),public.fiscal_staff_email_send_allowed_pre_closure(uuid,uuid) from public,anon,authenticated,service_role;
create function public.fiscal_guest_email_send_allowed(p_id uuid,p_lease_token uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select a.org_id into org from public.fiscal_guest_email_outbox q join public.fiscal_guest_submissions s on s.id=q.submission_id
 join public.fiscal_sponsorship_applications a on a.id=s.application_id where q.id=p_id and q.closure_suppressed_at is null;
 if org is null then return false; end if;
 perform public.guard_uploaded_document_organization(org);
 return public.fiscal_guest_email_send_allowed_pre_closure(p_id,p_lease_token);
 exception when insufficient_privilege or serialization_failure then return false;
end $$;
create function public.fiscal_staff_email_send_allowed(p_event_id uuid,p_lease_token uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select e.org_id into org from public.fiscal_staff_email_outbox q join public.fiscal_sponsorship_events e on e.id=q.event_id
 where q.event_id=p_event_id and q.closure_suppressed_at is null;
 if org is null then return false; end if;
 perform public.guard_uploaded_document_organization(org);
 return public.fiscal_staff_email_send_allowed_pre_closure(p_event_id,p_lease_token);
 exception when insufficient_privilege or serialization_failure then return false;
end $$;
revoke all on function public.fiscal_guest_email_send_allowed(uuid,uuid),public.fiscal_staff_email_send_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fiscal_guest_email_send_allowed(uuid,uuid),public.fiscal_staff_email_send_allowed(uuid,uuid) to service_role;
-- Preserve recovery's anti-enumeration response even when its host is closing.
alter function public.request_fiscal_guest_recovery(uuid,text,uuid) rename to request_fiscal_guest_recovery_pre_closure;
revoke all on function public.request_fiscal_guest_recovery_pre_closure(uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.request_fiscal_guest_recovery(p_reference uuid,p_email text,p_request_id uuid) returns void
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select a.org_id into org from public.fiscal_guest_submissions s join public.fiscal_sponsorship_applications a on a.id=s.application_id
 where s.id=p_reference and lower(s.contact_email)=lower(trim(p_email));
 if org is null then return; end if;
 perform public.guard_uploaded_document_organization(org);
 perform public.request_fiscal_guest_recovery_pre_closure(p_reference,p_email,p_request_id);
 exception when insufficient_privilege or serialization_failure then return;
end $$;
revoke all on function public.request_fiscal_guest_recovery(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.request_fiscal_guest_recovery(uuid,text,uuid) to service_role;
comment on function public.suppress_fiscal_delivery_on_closure() is
 'Permanently suppresses unsent host-owned fiscal deliveries on closure; cancel cannot revive them. Existing leased completions may record outcomes without retries. Does not cancel provider calls already outside the database.';
commit;
