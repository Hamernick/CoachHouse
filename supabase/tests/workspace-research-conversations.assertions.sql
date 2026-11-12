begin;
update public.ai_credit_policy set daily_provider_microdollars=10000000;
insert into public.ai_credit_wallets(org_id,enabled) values('00000000-0000-0000-0000-000000000004',true);
insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values('00000000-0000-0000-0000-000000000004','conversation-fixture','adjustment',100);
insert into public.organization_memberships values('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','staff');
do $$ declare
  org uuid:='00000000-0000-0000-0000-000000000004';
  root uuid:='83000000-0000-4000-8000-000000000001';
  child uuid:='83000000-0000-4000-8000-000000000002';
  scope jsonb:='{"mode":"new_objective","kind":"particle_research","userId":"00000000-0000-0000-0000-000000000004","organizationId":"00000000-0000-0000-0000-000000000004","revision":0,"canvasId":null}';
  c jsonb; reply jsonb; reserved_before bigint;
begin
  c:=jsonb_build_object('id',root,'parentId',null,'turn',1,'draftRevision',0);
  perform public.reserve_workspace_ai_research_run(root,org,org,repeat('a',64),scope||jsonb_build_object('conversation',c),'Plan a garden','{}',10,50000);
  perform public.claim_workspace_ai_run(root,org);
  perform public.record_workspace_ai_result(root,'succeeded',1,1,'{}','{}',null);
  perform public.settle_recorded_workspace_ai_run(root);
  perform public.access_workspace_research_draft(root,org,org,repeat('b',64),gen_random_uuid(),0,'{"title":"Edited"}',false);
  c:=jsonb_build_object('id',root,'parentId',root,'turn',2,'draftRevision',0);
  begin
    perform public.reserve_workspace_ai_research_run(child,org,org,repeat('c',64),scope||jsonb_build_object('conversation',c),'Make it smaller','{}',10,50000);
    raise exception 'Stale draft admitted';
  exception when serialization_failure then null; end;
  perform public.assert_ai(not exists(select 1 from public.workspace_ai_runs where id=child),'rejected stale draft leaves no run');
  c:=c||'{"draftRevision":1}';
  reply:=public.reserve_workspace_ai_research_run(child,org,org,repeat('c',64),scope||jsonb_build_object('conversation',c),'Make it smaller','{}',10,50000);
  perform public.assert_ai((reply->>'created')::boolean,'followup admitted');
  reply:=public.reserve_workspace_ai_research_run(child,org,org,repeat('c',64),scope||jsonb_build_object('conversation',c),'Make it smaller','{}',10,50000);
  perform public.assert_ai(not (reply->>'created')::boolean,'same request reserves once');
  perform public.claim_workspace_ai_run(child,org);
  perform public.record_workspace_ai_result(child,'failed',0,0,null,'{}',null);
  perform public.settle_recorded_workspace_ai_run(child);
  select count(*) into reserved_before from public.ai_credit_reservations;
  begin
    perform public.reserve_workspace_ai_research_run(gen_random_uuid(),org,org,repeat('d',64),scope||jsonb_build_object('conversation',c),'Competing tab','{}',10,50000);
    raise exception 'Fork admitted';
  exception when unique_violation then null; end;
  perform public.assert_ai((select count(*)=reserved_before from public.ai_credit_reservations),'rejected fork reserves nothing');
  begin
    perform public.access_workspace_research_draft(root,org,org,repeat('b',64),gen_random_uuid(),1,'{"title":"Edited"}',true);
    raise exception 'Old draft applied';
  exception when serialization_failure then null; end;
  perform public.assert_ai(jsonb_array_length(public.list_workspace_research_conversation(org,org,null,root))=2,'both turns recovered');
  perform public.assert_ai(public.list_workspace_research_conversation(org,org,null,null)->0->>'id'=child::text,'discovery returns latest turn');
  perform public.assert_ai(public.list_workspace_research_conversation(org,org,'other',root)='[]','canvas scoped');
  perform public.assert_ai(public.list_workspace_research_conversation(org,'00000000-0000-0000-0000-000000000002',null,root)='[]','other team member cannot read a private chat');
  perform public.assert_ai(not (public.list_workspace_research_conversation(org,org,null,root)->0 ? 'prompt'),'discovery contains no private prose');
  c:=jsonb_build_object('id',root,'parentId',child,'turn',3,'draftRevision',0);
  perform public.reserve_workspace_ai_research_run('83000000-0000-4000-8000-000000000003',org,org,repeat('e',64),scope||jsonb_build_object('conversation',c),'Try a smaller plan','{}',10,50000);
  perform public.assert_ai(jsonb_array_length(public.list_workspace_research_conversation(org,org,null,root))=3,'failed turn can continue without replaying it');
  reply:=public.manage_workspace_research_conversation(org,org,null,root,'rename',0,'Garden chat',null);
  perform public.assert_ai(reply->>'title'='Garden chat' and (reply->>'revision')::int=1,'rename persists');
  begin perform public.manage_workspace_research_conversation(org,org,null,root,'pin',0,null,true); raise exception 'Stale pin allowed'; exception when serialization_failure then null; end;
  reply:=public.manage_workspace_research_conversation(org,org,null,root,'pin',1,null,true);
  perform public.assert_ai((public.list_workspace_research_conversation(org,org,null,null)->0->>'pinned')::boolean,'pin readback');
  perform public.assert_ai(public.list_workspace_research_conversation(org,org,null,null)->0->>'customTitle'='Garden chat','custom title readback');
  begin perform public.manage_workspace_research_conversation(org,'00000000-0000-0000-0000-000000000002',null,root,'rename',2,'Other actor',null); raise exception 'Cross-actor rename'; exception when insufficient_privilege then null; end;
  begin perform public.manage_workspace_research_conversation(org,org,'other',root,'delete',2); raise exception 'Cross-canvas delete'; exception when insufficient_privilege then null; end;
  begin perform public.manage_workspace_research_conversation(org,org,null,root,'delete',2); raise exception 'Running delete'; exception when object_not_in_prerequisite_state then null; end;
  perform public.claim_workspace_ai_run('83000000-0000-4000-8000-000000000003',org);
  perform public.record_workspace_ai_result('83000000-0000-4000-8000-000000000003','failed',0,0,null,'{}',null);
  perform public.settle_recorded_workspace_ai_run('83000000-0000-4000-8000-000000000003');
  select count(*) into reserved_before from public.ai_credit_reservations;
  perform public.manage_workspace_research_conversation(org,org,null,root,'delete',2);
  perform public.assert_ai(public.list_workspace_research_conversation(org,org,null,null)='[]','deleted hidden from discovery');
  perform public.assert_ai(public.list_workspace_research_conversation(org,org,null,root)='[]','deleted hidden from thread read');
  perform public.assert_ai((public.manage_workspace_research_conversation(org,org,null,root,'read')->>'deleted')::boolean,'run reader sees tombstone');
  perform public.assert_ai((select count(*)=3 from public.workspace_ai_runs where target->'conversation'->>'id'=root::text),'accounting records retained');
  c:=jsonb_build_object('id',root,'parentId','83000000-0000-4000-8000-000000000003','turn',4,'draftRevision',0);
  begin
    perform public.reserve_workspace_ai_research_run(gen_random_uuid(),org,org,repeat('f',64),scope||jsonb_build_object('conversation',c),'Continue deleted','{}',10,50000);
    raise exception 'Deleted continuation admitted';
  exception when serialization_failure then null; end;
  perform public.assert_ai((select count(*)=reserved_before from public.ai_credit_reservations),'deleted continuation reserves nothing');

end $$;
-- Applied/accepted transition is checked independently at ledger admission.
do $$ declare
  org uuid:='00000000-0000-0000-0000-000000000004';
  root uuid:='84000000-0000-4000-8000-000000000001';
  child uuid:='84000000-0000-4000-8000-000000000002';
  objective uuid:='84000000-0000-4000-8000-000000000003';
  plan uuid:='84000000-0000-4000-8000-000000000004';
  scope jsonb; c jsonb; obj jsonb; proposal jsonb; reply jsonb; before_count bigint;
begin
  scope:=jsonb_build_object('mode','new_objective','kind','particle_research','userId',org,'organizationId',org,'revision',0,'canvasId',null);
  c:=jsonb_build_object('id',root,'parentId',null,'turn',1,'draftRevision',0);
  perform public.reserve_workspace_ai_research_run(root,org,org,repeat('1',64),scope||jsonb_build_object('conversation',c),'First plan','{}',10,50000);
  perform public.claim_workspace_ai_run(root,org);
  perform public.record_workspace_ai_result(root,'succeeded',0,0,'{}','{}',null);
  perform public.settle_recorded_workspace_ai_run(root);
  perform public.access_workspace_research_draft(root,org,org,repeat('2',64),gen_random_uuid(),0,'{"title":"Plan"}',true);
  proposal:=jsonb_build_object('planId',plan,'status','pending','researchRunId',root);
  obj:=jsonb_build_object('id',objective,'type','objective','revision',3,'data',jsonb_build_object('planning',jsonb_build_object('plans',jsonb_build_array(jsonb_build_object('id',plan,'revision',1)), 'proposals',jsonb_build_array(proposal))));
  insert into public.organization_workspace_boards(org_id,state) values(org,jsonb_build_object('particleGraph',jsonb_build_object('revision',4,'particles',jsonb_build_array(obj))));
  scope:=(scope-'mode')||jsonb_build_object('objectiveId',objective,'revision',3,'plan',jsonb_build_object('id',plan,'revision',1));
  c:=jsonb_build_object('id',root,'parentId',root,'turn',2,'draftRevision',1);
  select count(*) into before_count from public.ai_credit_reservations;
  begin
    perform public.reserve_workspace_ai_research_run(child,org,org,repeat('3',64),scope||jsonb_build_object('conversation',c),'Revise pending','{}',10,50000);
    raise exception 'Pending silently accepted';
  exception when serialization_failure then null; end;
  obj:=jsonb_set(obj,'{data,planning,proposals,0,status}','"accepted"');
  update public.organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object('revision',4,'particles',jsonb_build_array(obj))) where org_id=org;
  begin
    perform public.reserve_workspace_ai_research_run(child,org,org,repeat('3',64),(scope||jsonb_build_object('plan',jsonb_build_object('id',plan,'revision',0),'conversation',c)),'Stale revision','{}',10,50000);
    raise exception 'Stale plan admitted';
  exception when serialization_failure then null; end;
  perform public.assert_ai((select count(*)=before_count from public.ai_credit_reservations),'invalid transitions spend nothing');
  reply:=public.reserve_workspace_ai_research_run(child,org,org,repeat('3',64),scope||jsonb_build_object('conversation',c),'Revise accepted','{}',10,50000);
  perform public.assert_ai((reply->>'created')::boolean,'accepted plan continuation admitted');
  reply:=public.reserve_workspace_ai_research_run(child,org,org,repeat('3',64),scope||jsonb_build_object('conversation',c),'Revise accepted','{}',10,50000);
  perform public.assert_ai(not (reply->>'created')::boolean,'accepted continuation replay reserves once');
  perform public.assert_ai(jsonb_array_length(public.list_workspace_research_conversation(org,org,null,root))=2,'mixed target chat restores both turns');
  perform public.assert_ai(public.list_workspace_research_conversation(org,org,null,null)->0->>'id'=child::text,'discovery includes revision turn');
  perform public.assert_ai(public.list_workspace_research_conversation(org,org,'elsewhere',root)='[]','revision remains canvas scoped');
end $$;
set local role authenticated;
do $$ begin
  begin perform 1 from public.workspace_research_chats; raise exception 'Direct metadata read'; exception when insufficient_privilege then null; end;
  begin perform public.manage_workspace_research_conversation(gen_random_uuid(),gen_random_uuid(),null,gen_random_uuid(),'read'); raise exception 'Direct chat mutation'; exception when insufficient_privilege then null; end;
  begin perform public.list_workspace_research_conversation(gen_random_uuid(),gen_random_uuid(),null,null); raise exception 'Direct chat read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
