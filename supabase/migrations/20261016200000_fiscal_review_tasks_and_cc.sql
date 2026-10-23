-- One shared review task per NEW guest application. No historical mail replay or
-- task backfill. Deploy this migration before the v4 worker; old workers leave
-- new digest/CC jobs untouched so retries never change an existing provider payload.
-- Freeze a deliberately selected application digest, never tokens, internal
-- review notes, street addresses, attachments, or arbitrary metadata.
create function public.fiscal_application_email_snapshot(p_project_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'project_name',a.project_name,'applicant_full_name',a.applicant_full_name,'primary_email',a.primary_email,
  'project_description',a.project_description,'project_location',a.project_location,'focus_area',a.focus_area,
  'project_duration_type',a.project_duration_type,'temporary_start_date',a.temporary_start_date,'temporary_end_date',a.temporary_end_date,
  'legal_entity_type',a.legal_entity_type,'legal_entity_has_501c3',a.legal_entity_has_501c3,'formation_status',a.formation_status,
  'fundraising_goal',a.metadata->'fundraisingGoal','estimated_budget_cents',a.estimated_budget_cents,
  'expense_summary',a.expense_summary,'prospective_funding_sources',a.prospective_funding_sources,'public_benefit',a.public_benefit,
  'leadership_background',a.leadership_background,'initiative_history',a.initiative_history,
  'operates_outside_united_states',a.operates_outside_united_states,'engages_in_lobbying',a.engages_in_lobbying,
  'has_legal_compliance_financial_concerns',a.has_legal_compliance_financial_concerns,'concerns_explanation',a.concerns_explanation
 ) from public.fiscal_sponsorship_applications a where a.project_id=p_project_id;
$$;
revoke all on function public.fiscal_application_email_snapshot(uuid) from public,anon,authenticated;
alter table public.fiscal_guest_email_outbox
 add column review_snapshot jsonb,
 add column template_version smallint not null default 1 check(template_version in (1,2)),
 add column message_snapshot jsonb,
 add column to_recipients text[] not null default '{}';
alter table public.fiscal_guest_email_outbox add constraint fiscal_team_to_only
 check(cardinality(to_recipients)=0 or (kind in ('reviewer_notification','reviewer_update')
  and to_recipients=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org']::text[]));
alter table public.fiscal_guest_email_outbox add constraint fiscal_review_snapshot_check
 check (review_snapshot is null or (kind in ('reviewer_notification','reviewer_update') and jsonb_typeof(review_snapshot)='object' and octet_length(review_snapshot::text)<=100000));
alter table public.fiscal_guest_email_outbox add column cc_recipients text[] not null default '{}';
alter table public.fiscal_guest_email_outbox add constraint fiscal_staff_cc_only
 check (cardinality(cc_recipients)=0 or (kind in ('reviewer_notification','reviewer_update') and cc_recipients=array['caleb@bandto.com']::text[]));

create function public.capture_fiscal_reviewer_cc() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.template_version is distinct from old.template_version or new.message_snapshot is distinct from old.message_snapshot
   or new.to_recipients is distinct from old.to_recipients then raise exception 'Fiscal message envelope is immutable'; end if;
  if new.cc_recipients is distinct from old.cc_recipients then raise exception 'Fiscal CC recipients are immutable'; end if;
  if new.review_snapshot is distinct from old.review_snapshot then raise exception 'Fiscal review snapshot is immutable'; end if;
 else
  new.template_version:=2;
  select jsonb_build_object('projectName',a.project_name,'eventType',e.event_type)
   into new.message_snapshot from public.fiscal_guest_submissions s
   join public.fiscal_sponsorship_applications a on a.id=s.application_id
   left join public.fiscal_sponsorship_events e on e.id=new.event_id where s.id=new.submission_id;
  if new.message_snapshot is null then raise exception 'Fiscal message snapshot unavailable'; end if;
  if new.kind in ('reviewer_notification','reviewer_update') then
  if lower(new.recipient)<>'joel@coachhousesolutions.org' then raise exception 'Invalid fiscal team recipient'; end if;
  new.to_recipients:=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org'];
  new.cc_recipients:=array['caleb@bandto.com'];
  select public.fiscal_application_email_snapshot(s.project_id) into new.review_snapshot
   from public.fiscal_guest_submissions s where s.id=new.submission_id;
  if new.review_snapshot is null then raise exception 'Fiscal application snapshot unavailable'; end if;
  new.review_snapshot:=new.review_snapshot||jsonb_build_object('received_at',new.created_at);
 else
  new.cc_recipients:='{}';
  new.review_snapshot:=null;
  new.to_recipients:='{}';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.capture_fiscal_reviewer_cc() from public,anon,authenticated;
create trigger fiscal_reviewer_cc before insert or update of cc_recipients,review_snapshot,to_recipients,template_version,message_snapshot
 on public.fiscal_guest_email_outbox for each row execute function public.capture_fiscal_reviewer_cc();

create function public.fiscal_digest_recipients_available(p_project_id uuid,p_emails text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from unnest(p_emails) as requested(email) where not exists(
  select 1 from public.profiles p join public.platform_staff_members staff on staff.user_id=p.id
  where lower(p.email)=lower(requested.email) and coalesce(public.fiscal_guest_project_reviewer_access(p_project_id,p.id),true)
 ));
$$;
revoke all on function public.fiscal_digest_recipients_available(uuid,text[]) from public,anon,authenticated;

do $patch$
declare original text; updated text; legacy text;
 ready text:=$a$where (status='pending' and available_at<=now()) or (status='sending' and leased_until<=now())$a$;
begin
 original:=pg_get_functiondef('public.claim_fiscal_guest_emails_v3()'::regprocedure);
 if strpos(original,ready)=0 or strpos(original,'q.receipt_snapshot')=0
  or strpos(original,$a$'receiptSnapshot',c.receipt_snapshot$a$)=0 then raise exception 'Unexpected v3 fiscal worker'; end if;
 updated:=replace(original,'FUNCTION public.claim_fiscal_guest_emails_v3()', 'FUNCTION public.claim_fiscal_guest_emails_v4()');
 updated:=replace(updated,'q.receipt_snapshot','q.receipt_snapshot,q.cc_recipients,q.review_snapshot,q.to_recipients,q.template_version,q.message_snapshot');
 updated:=replace(updated,$a$'receiptSnapshot',c.receipt_snapshot$a$,$b$'receiptSnapshot',c.receipt_snapshot,'ccRecipients',c.cc_recipients,'reviewSnapshot',c.review_snapshot,'toRecipients',c.to_recipients,'templateVersion',c.template_version,'messageSnapshot',c.message_snapshot$b$);
 updated:=replace(updated,'with ready as (',$b$
 update public.fiscal_guest_email_outbox q set status='failed',last_error_code='reviewer_unavailable',lease_token=null,leased_until=null
  from public.fiscal_guest_submissions s where q.submission_id=s.id and q.review_snapshot is not null
  and q.status in ('pending','sending') and (q.leased_until is null or q.leased_until<=now())
  and not public.fiscal_digest_recipients_available(s.project_id,q.to_recipients||q.cc_recipients);
 with ready as ($b$);
 execute updated;
 execute replace(original,ready,$b$where template_version=1 and cardinality(cc_recipients)=0 and ((status='pending' and available_at<=now()) or (status='sending' and leased_until<=now()))$b$);
 legacy:=pg_get_functiondef('public.claim_fiscal_guest_emails()'::regprocedure);
 if strpos(legacy,'where receipt_snapshot is null and')=0 then raise exception 'Unexpected legacy fiscal worker'; end if;
 execute replace(legacy,'where receipt_snapshot is null and','where template_version=1 and cardinality(cc_recipients)=0 and receipt_snapshot is null and');
end $patch$;
revoke all on function public.claim_fiscal_guest_emails_v4() from public,anon,authenticated;
grant execute on function public.claim_fiscal_guest_emails_v4() to service_role;

create function public.create_fiscal_application_review_task() returns trigger
language plpgsql security definer set search_path='' as $$
declare submission public.fiscal_guest_submissions%rowtype; reviewers uuid[]; system_actor uuid;
begin
 if new.event_type <> 'application_submitted' or new.metadata->>'previousStatus'='needs_info' then return new; end if;
 select * into submission from public.fiscal_guest_submissions where project_id=new.project_id;
 if not found or exists(select 1 from public.organization_tasks where id=submission.id) then return new; end if;
 select array_agg(p.id) into reviewers from public.profiles p join public.platform_staff_members s on s.user_id=p.id
  where lower(p.email) in ('joel@coachhousesolutions.org','fs@coachhousesolutions.org','caleb@bandto.com');
 if cardinality(reviewers) is distinct from 3 then raise exception 'Fiscal review team is not configured'; end if;
 select system_actor_id into system_actor from public.fiscal_guest_intake_settings where singleton;
 insert into public.fiscal_project_reviewers(project_id,user_id)
  select new.project_id,unnest(reviewers) on conflict do nothing;
 -- Submission UUID is the stable task ID. Repeated events cannot duplicate it.
 insert into public.organization_tasks(id,org_id,project_id,title,description,task_type,status,start_date,end_date,created_source,created_by,updated_by)
  values(submission.id,new.org_id,new.project_id,'Review fiscal sponsorship application',
   'Shared review for Joel, Caleb and Karissa. Open this project’s Fiscal Sponsorship tab to review the application.',
   'task','todo',null,null,'system',system_actor,system_actor) on conflict(id) do nothing;
 if not exists(select 1 from public.organization_tasks where id=submission.id and project_id=new.project_id and created_source='system') then
  raise exception 'Fiscal review task identity conflict';
 end if;
 insert into public.organization_task_assignees(org_id,task_id,user_id,created_by)
  select new.org_id,submission.id,unnest(reviewers),system_actor on conflict(task_id,user_id) do nothing;
 return new;
end $$;
revoke all on function public.create_fiscal_application_review_task() from public,anon,authenticated;
-- Alphabetical ordering puts task/reviewer setup before initial notifications.
create trigger fiscal_guest_application_review_task after insert on public.fiscal_sponsorship_events
 for each row execute function public.create_fiscal_application_review_task();

-- Keep guest assignments as private as their tasks; no host-member discovery or edits.
create policy fiscal_guest_task_assignment_scope on public.organization_task_assignees as restrictive for all to authenticated
 using (exists(select 1 from public.organization_tasks t where t.id=task_id and public.can_access_fiscal_guest_project(t.project_id)))
 with check (exists(select 1 from public.organization_tasks t where t.id=task_id and public.fiscal_guest_project_reviewer_access(t.project_id,(select auth.uid())) is null));
create policy fiscal_guest_task_assignment_update on public.organization_task_assignees as restrictive for update to authenticated
 using (exists(select 1 from public.organization_tasks t where t.id=task_id and public.fiscal_guest_project_reviewer_access(t.project_id,(select auth.uid())) is null));
create policy fiscal_guest_task_assignment_delete on public.organization_task_assignees as restrictive for delete to authenticated
 using (exists(select 1 from public.organization_tasks t where t.id=task_id and public.fiscal_guest_project_reviewer_access(t.project_id,(select auth.uid())) is null));

create function public.list_fiscal_review_tasks(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'projectId',t.project_id,'projectName',p.name,'title',t.title,'description',t.description,'status',t.status,
  'reviewers',(select jsonb_agg(coalesce(nullif(prof.full_name,''),prof.email) order by prof.email)
   from public.organization_task_assignees a join public.profiles prof on prof.id=a.user_id where a.task_id=t.id)
 ) order by t.created_at,t.id),'[]'::jsonb)
 from public.organization_tasks t join public.fiscal_guest_submissions s on s.id=t.id and s.project_id=t.project_id
 join public.organization_projects p on p.id=t.project_id
 where t.created_source='system' and public.fiscal_guest_project_reviewer_access(t.project_id,p_user_id) is true
  and exists(select 1 from public.organization_task_assignees a where a.task_id=t.id and a.user_id=p_user_id));
end $$;

create function public.update_fiscal_review_task_status(p_task_id uuid,p_user_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare task public.organization_tasks%rowtype;
begin
 select t.* into task from public.organization_tasks t join public.fiscal_guest_submissions s on s.id=t.id and s.project_id=t.project_id
  where t.id=p_task_id and t.created_source='system' for update of t;
 if not found then return null; end if;
 if p_status is null or p_status not in ('todo','in-progress','done')
  or public.fiscal_guest_project_reviewer_access(task.project_id,p_user_id) is distinct from true
  or not exists(select 1 from public.organization_task_assignees where task_id=task.id and user_id=p_user_id) then
  return jsonb_build_object('ok',false);
 end if;
 update public.organization_tasks set status=p_status,updated_by=p_user_id where id=task.id;
 return jsonb_build_object('ok',true,'projectId',task.project_id);
end $$;
revoke all on function public.list_fiscal_review_tasks(uuid),public.update_fiscal_review_task_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.list_fiscal_review_tasks(uuid),public.update_fiscal_review_task_status(uuid,uuid,text) to service_role;
-- Karissa receives the same application digest; other milestones retain their
-- existing notification. Old jobs and old workers keep their original payload.
alter table public.fiscal_staff_email_outbox
 add column review_snapshot jsonb,
 add column template_version smallint not null default 1 check(template_version in (1,2)),
 add column message_snapshot jsonb,
 add column to_recipients text[] not null default '{}',
 add column cc_recipients text[] not null default '{}';
alter table public.fiscal_staff_email_outbox add constraint fiscal_staff_envelope_check
 check(template_version=1 or ((to_recipients=array['fs@coachhousesolutions.org']::text[] or (event_type='application_submitted' and to_recipients=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org']::text[]))
  and (cardinality(cc_recipients)=0 or (event_type='application_submitted' and cc_recipients=array['caleb@bandto.com']::text[]))));

-- Guest application/correction milestones have one team digest in the guest
-- outbox. Other staff milestones and non-guest applications keep this queue.
create or replace function public.queue_fiscal_staff_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.event_type='application_submitted' and exists(select 1 from public.fiscal_guest_submissions where project_id=new.project_id) then return new; end if;
 if new.event_type not in ('draft_saved','application_draft_saved') then
  insert into public.fiscal_staff_email_outbox(event_id,project_id,event_type)
   values(new.id,new.project_id,new.event_type) on conflict do nothing;
 end if;
 return new;
end $$;
alter table public.fiscal_staff_email_outbox add constraint fiscal_staff_snapshot_check
 check(review_snapshot is null or (event_type='application_submitted' and jsonb_typeof(review_snapshot)='object' and octet_length(review_snapshot::text)<=100000));
create function public.capture_fiscal_staff_digest() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.template_version is distinct from old.template_version or new.message_snapshot is distinct from old.message_snapshot
   or new.to_recipients is distinct from old.to_recipients or new.cc_recipients is distinct from old.cc_recipients then raise exception 'Fiscal message envelope is immutable'; end if;
  if new.review_snapshot is distinct from old.review_snapshot then raise exception 'Fiscal review snapshot is immutable'; end if;
 else
  new.template_version:=2;
  new.to_recipients:=array['fs@coachhousesolutions.org'];
  new.cc_recipients:='{}';
  select jsonb_build_object('projectName',p.name) into new.message_snapshot from public.organization_projects p where p.id=new.project_id;
  if new.message_snapshot is null then raise exception 'Fiscal message snapshot unavailable'; end if;
  if new.event_type='application_submitted' then
  new.to_recipients:=array['joel@coachhousesolutions.org','fs@coachhousesolutions.org'];
  new.cc_recipients:=array['caleb@bandto.com'];
  new.review_snapshot:=public.fiscal_application_email_snapshot(new.project_id);
  if new.review_snapshot is null then raise exception 'Fiscal application snapshot unavailable'; end if;
  new.review_snapshot:=new.review_snapshot||jsonb_build_object('received_at',new.created_at,
   'corrections',(select coalesce(metadata->>'previousStatus'='needs_info',false) from public.fiscal_sponsorship_events where id=new.event_id));
 else new.review_snapshot:=null;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.capture_fiscal_staff_digest() from public,anon,authenticated;
create trigger fiscal_staff_digest before insert or update of review_snapshot,template_version,message_snapshot,to_recipients,cc_recipients on public.fiscal_staff_email_outbox
 for each row execute function public.capture_fiscal_staff_digest();
do $patch$
declare original text; updated text;
 ready text:=$a$where (status='pending' and available_at<=now()) or (status='sending' and leased_until<=now())$a$;
begin
 original:=pg_get_functiondef('public.claim_fiscal_staff_emails()'::regprocedure);
 if strpos(original,ready)=0 or strpos(original,'q.event_type, q.lease_token')=0 then raise exception 'Unexpected fiscal staff worker'; end if;
 updated:=replace(original,'FUNCTION public.claim_fiscal_staff_emails()', 'FUNCTION public.claim_fiscal_staff_emails_v2()');
 updated:=replace(updated,'q.event_type, q.lease_token','q.event_type, q.lease_token, q.review_snapshot, q.template_version, q.message_snapshot, q.to_recipients, q.cc_recipients');
 updated:=replace(updated,'with ready as (',$b$
 update public.fiscal_staff_email_outbox q set status='failed',lease_token=null,leased_until=null
  where q.template_version=2 and q.status in ('pending','sending') and (q.leased_until is null or q.leased_until<=now())
  and not public.fiscal_digest_recipients_available(q.project_id,q.to_recipients||q.cc_recipients);
 with ready as ($b$);
 execute updated;
 execute replace(original,ready,$b$where template_version=1 and review_snapshot is null and ((status='pending' and available_at<=now()) or (status='sending' and leased_until<=now()))$b$);
end $patch$;
revoke all on function public.claim_fiscal_staff_emails_v2() from public,anon,authenticated;
grant execute on function public.claim_fiscal_staff_emails_v2() to service_role;
-- Validate the leased recipient envelope again immediately before the provider
-- call. Revocation during earlier jobs in a batch must withhold private answers.
create function public.fiscal_guest_email_send_allowed(p_id uuid,p_lease_token uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select status='sending' and lease_token=p_lease_token and leased_until>now()
  and (kind not in ('reviewer_notification','reviewer_update') or public.fiscal_digest_recipients_available(s.project_id,q.to_recipients||q.cc_recipients))
  from public.fiscal_guest_email_outbox q join public.fiscal_guest_submissions s on s.id=q.submission_id where q.id=p_id),false);
$$;
create function public.fiscal_staff_email_send_allowed(p_event_id uuid,p_lease_token uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select status='sending' and lease_token=p_lease_token and leased_until>now()
  and public.fiscal_digest_recipients_available(q.project_id,q.to_recipients||q.cc_recipients)
  from public.fiscal_staff_email_outbox q where q.event_id=p_event_id),false);
$$;
revoke all on function public.fiscal_guest_email_send_allowed(uuid,uuid),public.fiscal_staff_email_send_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fiscal_guest_email_send_allowed(uuid,uuid),public.fiscal_staff_email_send_allowed(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
