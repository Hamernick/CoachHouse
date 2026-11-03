-- Retire raw AI content without inventing a settlement or erasing its ledger.
begin;
create function public.ai_retirement_hash(p_text text) returns text
 language sql immutable strict set search_path='' as $$select encode(sha256(convert_to(p_text,'UTF8')),'hex')$$;
create function public.ai_retained_usage(p_usage jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare result jsonb:='{}';key text;
begin
 if p_usage is null or p_usage='null'::jsonb then return null;end if;
 if jsonb_typeof(p_usage)<>'object' then raise exception 'AI usage facts require reconciliation' using errcode='42501';end if;
 foreach key in array array['input','cachedInput','output','webSearchCalls'] loop
  if p_usage ? key then
   if jsonb_typeof(p_usage->key)<>'number' or (p_usage->>key)::numeric<0 then raise exception 'AI usage facts require reconciliation' using errcode='42501';end if;
   result:=result||jsonb_build_object(key,p_usage->key);
  end if;
 end loop;
 return result;
end $$;
create function public.ai_retained_tariff(p_tariff jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare result jsonb:='{}';key text;
begin
 if jsonb_typeof(p_tariff) is distinct from 'object' then raise exception 'AI tariff facts require reconciliation' using errcode='42501';end if;
 foreach key in array array['version','model'] loop
  if jsonb_typeof(p_tariff->key) is distinct from 'string' or length(p_tariff->>key) not between 1 and 200 then raise exception 'AI tariff identity requires reconciliation' using errcode='42501';end if;
  result:=result||jsonb_build_object(key,p_tariff->key);
 end loop;
 foreach key in array array['inputMicrodollarsPerMillion','cachedMicrodollarsPerMillion','outputMicrodollarsPerMillion','microdollarsPerCredit','webSearchMicrodollarsPerCall'] loop
  if key='webSearchMicrodollarsPerCall' and not(p_tariff ? key) then continue;end if;
  if jsonb_typeof(p_tariff->key) is distinct from 'number' or (p_tariff->>key)::numeric<0 or (key='microdollarsPerCredit' and (p_tariff->>key)::numeric=0) then raise exception 'AI tariff facts require reconciliation' using errcode='42501';end if;
  result:=result||jsonb_build_object(key,p_tariff->key);
 end loop;
 return result;
end $$;
create function public.ai_retained_result(p_result jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p_result) is distinct from 'object'
  or p_result->>'status' is null or p_result->>'status' not in('succeeded','failed','canceled')
  or jsonb_typeof(p_result->'cost') is distinct from 'number' or (p_result->>'cost')::numeric<0
  or jsonb_typeof(p_result->'credits') is distinct from 'number' or (p_result->>'credits')::numeric<0
  or not(p_result ? 'responseId') or jsonb_typeof(p_result->'responseId') not in('string','null') then
  raise exception 'AI result facts require reconciliation' using errcode='42501';end if;
 return jsonb_build_object('status',p_result->'status','cost',p_result->'cost','credits',p_result->'credits',
  'responseId',p_result->'responseId','proposal',null,'usage',public.ai_retained_usage(p_result->'usage'));
end $$;
revoke all on function public.ai_retirement_hash(text),public.ai_retained_usage(jsonb),public.ai_retained_tariff(jsonb),public.ai_retained_result(jsonb) from public,anon,authenticated,service_role;

alter table public.workspace_ai_runs add column content_retired_at timestamptz,add column retired_proposal_hash text check(retired_proposal_hash is null or length(retired_proposal_hash)=64);
alter table public.workspace_ai_runs drop constraint workspace_ai_runs_prompt_check,drop constraint workspace_ai_runs_check2;
alter table public.workspace_ai_runs add constraint workspace_ai_runs_prompt_check check(
 (content_retired_at is null and length(prompt) between 1 and 4000) or (content_retired_at is not null and prompt='')),
 add constraint workspace_ai_runs_success_content check(content_retired_at is not null or status<>'succeeded' or (proposal is not null and length(proposal)>0)),
 add constraint workspace_ai_runs_retirement_shape check(content_retired_at is null or
  (target='{}'::jsonb and proposal is null and status in('succeeded','failed','canceled') and settled_at is not null
   and provider_cost_state='measured' and charged_credits is not null and provider_microdollars is not null));
alter table public.workspace_ai_result_receipts add column content_retired_at timestamptz,add column retired_result_hash text check(retired_result_hash is null or length(retired_result_hash)=64);

create table public.organization_closure_ai_cleanups (
 org_id uuid not null,closure_request_id uuid not null,operation_id uuid not null,
 closure_revision integer not null check(closure_revision>0),transaction_id bigint not null,operator_role text not null,
 run_ids uuid[] not null,state text not null check(state in('running','complete')),result jsonb,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 primary key(org_id,closure_request_id,operation_id),check((state='complete')=(result is not null and completed_at is not null))
);
alter table public.organization_closure_ai_cleanups enable row level security;
revoke all on public.organization_closure_ai_cleanups from public,anon,authenticated,service_role;
create function public.guard_closure_ai_cleanup_receipt() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'AI cleanup receipts are retained' using errcode='42501';end if;
 if (to_jsonb(new)-array['state','result','completed_at']) is distinct from (to_jsonb(old)-array['state','result','completed_at'])
  or old.state<>'running' or new.state<>'complete' or new.result is null or new.completed_at is null then raise exception 'AI cleanup receipt is immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_closure_ai_cleanup_receipt() from public,anon,authenticated,service_role;
create trigger closure_ai_cleanup_immutable before update or delete on public.organization_closure_ai_cleanups for each row execute function public.guard_closure_ai_cleanup_receipt();
create trigger closure_ai_cleanup_retained before truncate on public.organization_closure_ai_cleanups for each statement execute function public.guard_closure_ai_cleanup_receipt();

create function public.closure_ai_retirement_allowed(p_run uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),'none'),session_user)<>session_user
  or not exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then return false;end if;
 return exists(select 1 from public.organization_closure_ai_cleanups r join public.organization_closures c
  on c.org_id=r.org_id and c.request_id=r.closure_request_id and c.revision=r.closure_revision
  join public.workspace_ai_runs run on run.org_id=r.org_id and run.id=p_run
  where p_run=any(r.run_ids) and r.transaction_id=txid_current() and r.operator_role=session_user and r.state='running'
   and c.state='closing' and c.export_until=c.requested_at+interval '720 hours' and clock_timestamp()>=c.export_until);
end $$;
create function public.closure_ai_run_projection_allowed(p_old jsonb,p_new jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if not public.closure_ai_retirement_allowed((p_old->>'id')::uuid) then return false;end if;
 return p_old->>'content_retired_at' is null and p_new->>'content_retired_at' is not null
  and (p_old-array['target','prompt','proposal','usage','tariff','content_retired_at','retired_proposal_hash'])=(p_new-array['target','prompt','proposal','usage','tariff','content_retired_at','retired_proposal_hash'])
  and p_new->'target'='{}'::jsonb and p_new->>'prompt'='' and p_new->'proposal'='null'::jsonb
  and p_new->>'retired_proposal_hash' is not distinct from public.ai_retirement_hash(p_old->>'proposal')
  and p_new->'usage' is not distinct from coalesce(public.ai_retained_usage(nullif(p_old->'usage','null'::jsonb)),'null'::jsonb)
  and p_new->'tariff'=public.ai_retained_tariff(p_old->'tariff');
end $$;
create function public.closure_ai_result_projection_allowed(p_old jsonb,p_new jsonb) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 if not public.closure_ai_retirement_allowed((p_old->>'run_id')::uuid) then return false;end if;
 return p_old->>'content_retired_at' is null and p_new->>'content_retired_at' is not null
  and (p_old-array['result','content_retired_at','retired_result_hash'])=(p_new-array['result','content_retired_at','retired_result_hash'])
  and p_new->'result'=public.ai_retained_result(p_old->'result')
  and p_new->>'retired_result_hash'=public.ai_retirement_hash((p_old->'result')::text);
end $$;
revoke all on function public.closure_ai_retirement_allowed(uuid),public.closure_ai_run_projection_allowed(jsonb,jsonb),public.closure_ai_result_projection_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.guard_ai_retired_content() returns trigger
 language plpgsql security definer set search_path='' as $$
declare run public.workspace_ai_runs;item jsonb;
begin
 if tg_table_name='workspace_ai_runs' then
  if tg_op='INSERT' then
   if new.content_retired_at is not null or new.retired_proposal_hash is not null then raise exception 'AI retirement is private' using errcode='42501';end if;
  else
   if public.closure_ai_run_projection_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;
   if old.content_retired_at is not null and to_jsonb(old) is distinct from to_jsonb(new) then raise exception 'Retired AI content and settlement are immutable' using errcode='42501';end if;
   if new.content_retired_at is distinct from old.content_retired_at or new.retired_proposal_hash is distinct from old.retired_proposal_hash then raise exception 'AI retirement is private' using errcode='42501';end if;
  end if;
  return new;
 end if;
 item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 -- Serialize direct child writes too; a delayed insert cannot restore bytes.
 select * into run from public.workspace_ai_runs where id=(item->>'run_id')::uuid for share nowait;
 if tg_table_name='workspace_ai_result_receipts' then
  if tg_op='UPDATE' and public.closure_ai_result_projection_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;
  if tg_op='INSERT' and (new.content_retired_at is not null or new.retired_result_hash is not null) then raise exception 'AI retirement is private' using errcode='42501';end if;
 elsif tg_table_name='workspace_ai_plan_applications' and tg_op='UPDATE' and public.closure_ai_retirement_allowed(run.id)
  and to_jsonb(new)->'before_draft'='null'::jsonb and (to_jsonb(old)-'before_draft')=(to_jsonb(new)-'before_draft') then return new;
 end if;
 if run.content_retired_at is not null then raise exception 'AI content was retired' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.guard_ai_retired_content() from public,anon,authenticated,service_role;
create trigger workspace_ai_content_retirement before insert or update on public.workspace_ai_runs for each row execute function public.guard_ai_retired_content();
create trigger workspace_ai_content_retirement before insert or update or delete on public.workspace_ai_result_receipts for each row execute function public.guard_ai_retired_content();
create trigger workspace_ai_content_retirement before insert or update or delete on public.workspace_ai_plan_applications for each row execute function public.guard_ai_retired_content();

create trigger workspace_ai_content_retirement before insert or update on public.workspace_research_drafts for each row execute function public.guard_ai_retired_content();

-- Preserve ordinary accounting and immutable ledger behavior. Hash-only exact
-- retries after retirement cannot return or repersist deleted provider content.
do $migration$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.guard_workspace_ai_closure()'::regprocedure);needle:='begin'||chr(10);
 replacement:=needle||' if tg_op=''UPDATE'' and public.closure_ai_run_projection_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;'||chr(10);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected AI closure guard';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.ai_credit_immutable()'::regprocedure);needle:='begin';
 replacement:=needle||' if tg_table_name=''workspace_ai_result_receipts'' and tg_op=''UPDATE'' and public.closure_ai_result_projection_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected AI immutable guard';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.record_workspace_ai_result(uuid,text,bigint,integer,text,jsonb,text)'::regprocedure);
 needle:='  select result into previous from public.workspace_ai_result_receipts where run_id=p_id;';
 replacement:='  if run.content_retired_at is not null then
    if exists(select 1 from public.workspace_ai_result_receipts where run_id=p_id and content_retired_at is not null and retired_result_hash=public.ai_retirement_hash(receipt::text)) then return;end if;
    raise exception ''Retired AI result identity conflict'' using errcode=''42501'';
  end if;'||chr(10)||needle;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected AI result writer';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.settle_workspace_ai_run(uuid,text,bigint,integer,text,jsonb,text)'::regprocedure);
 needle:='or run.proposal is distinct from p_proposal';
 replacement:='or (run.content_retired_at is null and run.proposal is distinct from p_proposal)
      or (run.content_retired_at is not null and run.retired_proposal_hash is distinct from public.ai_retirement_hash(p_proposal))';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected AI settlement writer';end if;execute replace(definition,needle,replacement);
end $migration$;

create function public.purge_expired_organization_ai_content(p_org_id uuid,p_closure_request_id uuid,p_expected_closure_revision integer,p_operation_id uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare closure public.organization_closures;prior public.organization_closure_ai_cleanups;selected uuid[];
 item record;run_count integer;receipt_count integer;application_count integer;cleanup_result jsonb;
begin
 if session_user<>current_user or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
  or current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'Actual AI cleanup operator required' using errcode='42501';end if;
 if p_org_id is null or p_closure_request_id is null or p_operation_id is null or p_expected_closure_revision is null or p_expected_closure_revision<1 then raise exception 'Exact AI cleanup identity required' using errcode='22023';end if;
 perform 1 from public.organizations where user_id=p_org_id for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 select * into closure from public.organization_closures where org_id=p_org_id;
 if not found or closure.state<>'closing' or closure.request_id is distinct from p_closure_request_id or closure.revision is distinct from p_expected_closure_revision
  or closure.export_until is null or closure.requested_at is null or closure.export_until<>closure.requested_at+interval '720 hours' or clock_timestamp()<closure.export_until then raise exception 'Expired current closure required' using errcode='42501';end if;
 select * into prior from public.organization_closure_ai_cleanups where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 if found then
  if prior.closure_revision<>p_expected_closure_revision or prior.state<>'complete' then raise exception 'AI cleanup retry changed' using errcode='23505';end if;return prior.result;
 end if;
 -- Admission and settlement own this global accounting lock first. NOWAIT avoids
 -- reversing that order while cleanup already owns the lifecycle row.
 perform 1 from public.ai_credit_policy where id for update nowait;
 if not found then raise exception 'AI accounting policy requires reconciliation' using errcode='42501';end if;
 if exists(select 1 from public.workspace_ai_runs where org_id=p_org_id and
  (status not in('succeeded','failed','canceled') or settled_at is null or charged_credits is null or provider_microdollars is null or provider_cost_state<>'measured')) then
  raise exception 'AI provider settlement requires reconciliation' using errcode='42501';end if;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into selected from(
  select id from public.workspace_ai_runs where org_id=p_org_id and content_retired_at is null order by id limit 50 for update nowait) q;
 perform 1 from public.workspace_ai_result_receipts where run_id=any(selected) for update nowait;
 perform 1 from public.workspace_ai_plan_applications where run_id=any(selected) for update nowait;
 perform 1 from public.ai_credit_refill_attempts where run_id=any(selected) for update nowait;
 if exists(select 1 from public.ai_credit_refill_attempts where run_id=any(selected) and state not in('failed','canceled','succeeded')) then raise exception 'AI payment effects require reconciliation' using errcode='42501';end if;
 if exists(select 1 from public.workspace_research_drafts where run_id=any(selected)) then raise exception 'Research draft cleanup must complete first' using errcode='42501';end if;
 if exists(select 1 from public.workspace_ai_cost_resolutions where run_id=any(selected) and evidence<>'Recorded provider terminal result') then raise exception 'AI accounting evidence provenance requires reconciliation' using errcode='42501';end if;
 -- Plan snapshots contain only UUID/revision bindings; unknown embedded content
 -- cannot be relabeled as accounting. Their before_draft is a raw content copy.
 for item in select key,value from public.workspace_ai_plan_applications a cross join lateral jsonb_each(a.step_snapshots) where a.run_id=any(selected) loop
  perform item.key::uuid;
  if jsonb_typeof(item.value)<>'string' then raise exception 'AI plan receipt facts require reconciliation' using errcode='42501';end if;
  perform (item.value#>>'{}')::timestamptz;
 end loop;
 insert into public.organization_closure_ai_cleanups(org_id,closure_request_id,operation_id,closure_revision,transaction_id,operator_role,run_ids,state)
 values(p_org_id,p_closure_request_id,p_operation_id,p_expected_closure_revision,txid_current(),session_user,selected,'running');
 update public.workspace_ai_result_receipts set result=public.ai_retained_result(result),retired_result_hash=public.ai_retirement_hash(result::text),content_retired_at=clock_timestamp() where run_id=any(selected);
 get diagnostics receipt_count=row_count;
 update public.workspace_ai_plan_applications set before_draft=null where run_id=any(selected) and before_draft is not null;
 get diagnostics application_count=row_count;
 update public.workspace_ai_runs set target='{}',prompt='',proposal=null,usage=public.ai_retained_usage(usage),tariff=public.ai_retained_tariff(tariff),retired_proposal_hash=public.ai_retirement_hash(proposal),content_retired_at=clock_timestamp() where id=any(selected);
 get diagnostics run_count=row_count;
 cleanup_result:=jsonb_build_object('scope','ai_parent_content','retiredRuns',run_count,'retiredResultReceipts',receipt_count,'retiredPlanDrafts',application_count,
  'moreRemainingAtCommit',exists(select 1 from public.workspace_ai_runs where org_id=p_org_id and content_retired_at is null));
 update public.organization_closure_ai_cleanups set state='complete',result=cleanup_result,completed_at=clock_timestamp() where org_id=p_org_id and closure_request_id=p_closure_request_id and operation_id=p_operation_id;
 return cleanup_result;
end $$;
revoke all on function public.purge_expired_organization_ai_content(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
comment on function public.purge_expired_organization_ai_content(uuid,uuid,integer,uuid) is
 'Private batch of50 settled/measured AI parent-content retirements after exact closure expiry. Retains real ledger and settlement facts, refuses unresolved effects or unknown accounting evidence. No provider call, forced settlement, public control or whole-organization completion.';
commit;
