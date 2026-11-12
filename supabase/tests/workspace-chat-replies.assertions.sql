begin;
update public.ai_credit_policy set daily_provider_microdollars=10000000,user_hourly_runs=100;
insert into public.ai_credit_wallets(org_id,enabled) values('00000000-0000-0000-0000-000000000004',true);
insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('00000000-0000-0000-0000-000000000004','replies-fixture','adjustment',100);
insert into public.organization_memberships values('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','staff');
do $$ declare
  org uuid:='00000000-0000-0000-0000-000000000004';
  root uuid:='86000000-0000-4000-8000-000000000001';
  v_run_id uuid; parent uuid; messages jsonb; page jsonb; receipt jsonb; i integer;
  scope jsonb:='{"mode":"new_objective","kind":"particle_research","userId":"00000000-0000-0000-0000-000000000004","organizationId":"00000000-0000-0000-0000-000000000004","revision":0,"canvasId":null}';
begin
  for i in 1..7 loop
    v_run_id:=('86000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    perform public.reserve_workspace_ai_research_run(v_run_id,org,org,repeat('a',64),scope||jsonb_build_object('conversation',jsonb_build_object('id',root,'parentId',parent,'turn',i,'draftRevision',0)), 'Question '||i,'{}',1,1000);
    select conversation_messages into messages from public.workspace_ai_runs where workspace_ai_runs.id=v_run_id;
    perform public.assert_ai(jsonb_array_length(messages)=1 and messages->0->>'id'=v_run_id::text||':user','admission persists stable user message');
    perform public.claim_workspace_ai_run(v_run_id,org);
    perform public.record_workspace_ai_result(v_run_id,'succeeded',1,1,jsonb_build_object('responseKind',case when i=1 then 'proposal' when i=2 then 'clarify' else 'answer' end,'summary','Answer '||i,'title','Plan '||i)::text,'{}',null);
    perform public.settle_recorded_workspace_ai_run(v_run_id);
    select conversation_messages into messages from public.workspace_ai_runs where workspace_ai_runs.id=v_run_id;
    perform public.assert_ai(jsonb_array_length(messages)=2 and messages->1->>'id'=v_run_id::text||':assistant','settlement persists one stable assistant message');
    perform public.assert_ai(messages->1->'parts'->0->>'text'='Answer '||i,'actual answer retained');
    -- Exact request replay must not duplicate either message or reservation.
    receipt:=public.reserve_workspace_ai_research_run(v_run_id,org,org,repeat('a',64),scope||jsonb_build_object('conversation',jsonb_build_object('id',root,'parentId',parent,'turn',i,'draftRevision',0)), 'Question '||i,'{}',1,1000);
    perform public.assert_ai(not (receipt->>'created')::boolean,'replay is idempotent');
    parent:=v_run_id;
  end loop;
  select conversation_messages into messages from public.workspace_ai_runs where id=parent;
  perform public.assert_ai(messages->1->'parts'->1->>'type'='data-reply','reply has no artifact reference');
  perform public.assert_ai(messages->1->'parts'->1->'data'->>'kind'='answer','answer kind retained');
  perform public.assert_ai((select conversation_messages->1->'parts'->1->'data'->>'kind'='clarify' from public.workspace_ai_runs where target->'conversation'->>'id'=root::text and target->'conversation'->>'turn'='2'),'clarification retained');
  perform public.assert_ai((select sum(charged_credits)=7 from public.workspace_ai_runs where target->'conversation'->>'id'=root::text),'all successful turns charged once including clarification');
  begin
    perform public.access_workspace_research_draft(parent,org,org,repeat('b',64),gen_random_uuid(),0,'{"title":"Injected plan"}',true);
    raise exception 'Reply became editable artifact';
  exception when insufficient_privilege then null; end;
  perform public.assert_ai(not exists(select 1 from public.workspace_research_drafts where run_id=parent),'reply draft not written');
  page:=public.page_workspace_research_conversation(org,org,null,root,null,true);
  perform public.assert_ai(jsonb_array_length(page)=5 and page->0->>'turn'='1' and page->1->>'turn'='4' and page->4->>'turn'='7','bounded context retains proposal after successful answers');
  perform public.assert_ai(page->0->>'responseKind'='proposal' and page->4->>'responseKind'='answer','metadata distinguishes readable replies from applicable proposals');
end $$;
rollback;
