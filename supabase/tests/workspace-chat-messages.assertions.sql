begin;
update public.ai_credit_policy set daily_provider_microdollars=10000000,user_hourly_runs=100;
insert into public.ai_credit_wallets(org_id,enabled) values('00000000-0000-0000-0000-000000000004',true);
insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('00000000-0000-0000-0000-000000000004','history-fixture','adjustment',100);
insert into public.organization_memberships values('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','staff');
do $$ declare
  org uuid:='00000000-0000-0000-0000-000000000004';
  root uuid:='85000000-0000-4000-8000-000000000001';
  v_run_id uuid; parent uuid; messages jsonb; page jsonb; receipt jsonb; i integer;
  scope jsonb:='{"mode":"new_objective","kind":"particle_research","userId":"00000000-0000-0000-0000-000000000004","organizationId":"00000000-0000-0000-0000-000000000004","revision":0,"canvasId":null}';
begin
  for i in 1..16 loop
    v_run_id:=('85000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    perform public.reserve_workspace_ai_research_run(v_run_id,org,org,repeat('a',64),scope||jsonb_build_object('conversation',jsonb_build_object('id',root,'parentId',parent,'turn',i,'draftRevision',0)), 'Question '||i,'{}',1,1000);
    select conversation_messages into messages from public.workspace_ai_runs where workspace_ai_runs.id=v_run_id;
    perform public.assert_ai(jsonb_array_length(messages)=1 and messages->0->>'id'=v_run_id::text||':user','admission persists stable user message');
    perform public.claim_workspace_ai_run(v_run_id,org);
    perform public.record_workspace_ai_result(v_run_id,'succeeded',1,1,jsonb_build_object('summary','Answer '||i,'title','Plan '||i)::text,'{}',null);
    perform public.settle_recorded_workspace_ai_run(v_run_id);
    select conversation_messages into messages from public.workspace_ai_runs where workspace_ai_runs.id=v_run_id;
    perform public.assert_ai(jsonb_array_length(messages)=2 and messages->1->>'id'=v_run_id::text||':assistant','settlement persists one stable assistant message');
    perform public.assert_ai(messages->1->'parts'->0->>'text'='Answer '||i,'actual answer retained');
    -- Exact request replay must not duplicate either message or reservation.
    receipt:=public.reserve_workspace_ai_research_run(v_run_id,org,org,repeat('a',64),scope||jsonb_build_object('conversation',jsonb_build_object('id',root,'parentId',parent,'turn',i,'draftRevision',0)), 'Question '||i,'{}',1,1000);
    perform public.assert_ai(not (receipt->>'created')::boolean,'replay is idempotent');
    parent:=v_run_id;
  end loop;
  page:=public.page_workspace_research_conversation(org,org,null,root);
  perform public.assert_ai(jsonb_array_length(page)=12 and page->0->>'turn'='5' and page->11->>'turn'='16','latest bounded page reaches beyond twelve');
  page:=public.page_workspace_research_conversation(org,org,null,root,5);
  perform public.assert_ai(jsonb_array_length(page)=4 and page->0->>'turn'='1' and page->3->>'turn'='4','older keyset page has no duplicates');
  perform public.assert_ai(public.page_workspace_research_conversation(org,org,null,root,1)='[]','history terminates');
  begin perform public.page_workspace_research_conversation(org,'00000000-0000-0000-0000-000000000002',null,root); raise exception 'Private chat leaked'; exception when insufficient_privilege then null; end;
  begin perform public.page_workspace_research_conversation(org,org,'other',root); raise exception 'Wrong canvas leaked'; exception when insufficient_privilege then null; end;
  perform public.assert_ai(not has_function_privilege('authenticated','public.page_workspace_research_conversation(uuid,uuid,text,uuid,integer,boolean)','execute'),'browser cannot spoof actor');
  perform public.assert_ai(not has_table_privilege('authenticated','public.workspace_ai_runs','select'),'raw messages remain private');
  update public.workspace_ai_runs set conversation_messages='[{"injected":true}]' where workspace_ai_runs.id=root;
  perform public.assert_ai((select conversation_messages->0->>'id'=root::text||':user' from public.workspace_ai_runs where workspace_ai_runs.id=root),'caller cannot replace transcript');
  -- Repeated failed turns must not eject the last complete artifact from context.
  update public.workspace_ai_runs set status='failed',proposal=null where target->'conversation'->>'id'=root::text and id<>root;
  page:=public.page_workspace_research_conversation(org,org,null,root,null,true);
  perform public.assert_ai(jsonb_array_length(page)=5 and page->0->>'turn'='1' and page->1->>'turn'='13' and page->4->>'turn'='16','bounded context retains latest complete draft across failures');
  perform public.manage_workspace_research_conversation(org,org,null,root,'delete',0);
  begin perform public.page_workspace_research_conversation(org,org,null,root); raise exception 'Deleted chat leaked'; exception when insufficient_privilege then null; end;
  perform public.assert_ai((select count(*)=16 from public.workspace_ai_runs where target->'conversation'->>'id'=root::text),'deletion preserves accounting');
end $$;
rollback;
