begin;
create function public.fixture_ai_receipt_failure() returns trigger language plpgsql as $$
begin raise exception 'fixture_receipt_failure'; end $$;
-- Existing settled fixture: owner, org1, successful request1.
update public.workspace_ai_runs set target='{"sectionId":"vision","revision":null}' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  begin perform * from public.workspace_ai_document_applications; raise exception 'Private receipt leaked'; exception when insufficient_privilege then null; end;
  begin perform public.commit_workspace_ai_document(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),now(),null,'{}','{}',repeat('a',64));
    raise exception 'Client forged a document receipt'; exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ declare expected timestamptz; receipt jsonb; original jsonb; begin
  select updated_at,profile into expected,original from public.organizations where user_id='00000000-0000-0000-0000-000000000001';
  begin perform public.commit_workspace_ai_document('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004',expected,null,
    '{"vision":"Unauthorized"}','{"id":"vision","lastUpdated":"version1","isPublic":false,"status":"in_progress"}',repeat('a',64));
    raise exception 'Cross-organization application allowed'; exception when raise_exception then if sqlerrm<>'AI application target unavailable' then raise; end if; end;
  begin perform public.commit_workspace_ai_document('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',expected,null,
    '{"vision":"Public"}','{"id":"vision","lastUpdated":"version1","isPublic":true,"status":"complete"}',repeat('a',64));
    raise exception 'AI application published a document'; exception when raise_exception then if sqlerrm<>'Invalid AI document application' then raise; end if; end;
  begin perform public.commit_workspace_ai_document('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',expected-interval '1 second',null,
    '{"vision":"Stale"}','{"id":"vision","lastUpdated":"version1","isPublic":false,"status":"in_progress"}',repeat('a',64));
    raise exception 'Stale organization overwrite allowed'; exception when serialization_failure then null; end;
  perform public.assert_ai((select count(*)=0 from public.workspace_ai_document_applications),'failed writes create no receipt');
  perform public.assert_ai((select profile=original from public.organizations where user_id='00000000-0000-0000-0000-000000000001'),'failed write preserves profile');
  execute 'create trigger fixture_ai_receipt_failure before insert on public.workspace_ai_document_applications for each row execute function public.fixture_ai_receipt_failure()';
  begin perform public.commit_workspace_ai_document('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',expected,null,
    '{"vision":"Unacknowledged write"}','{"id":"vision","lastUpdated":"version1","isPublic":false,"status":"in_progress"}',repeat('a',64));
    raise exception 'Receipt failure did not abort save'; exception when raise_exception then if sqlerrm<>'fixture_receipt_failure' then raise; end if; end;
  execute 'drop trigger fixture_ai_receipt_failure on public.workspace_ai_document_applications';
  perform public.assert_ai((select profile=original from public.organizations where user_id='00000000-0000-0000-0000-000000000001'),'receipt failure rolls back document write');
  receipt:=public.commit_workspace_ai_document('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',expected,null,
    '{"vision":"Reviewed draft","untouched":"Retained"}','{"id":"vision","lastUpdated":"version1","isPublic":false,"status":"in_progress"}',repeat('a',64));
  perform public.assert_ai(not (receipt->>'replayed')::boolean,'first application writes once');
  perform public.assert_ai((select profile->>'vision'='Reviewed draft' and profile->>'untouched'='Retained' from public.organizations where user_id='00000000-0000-0000-0000-000000000001'),'profile and receipt persist together');
  receipt:=public.commit_workspace_ai_document('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',expected,null,
    '{"vision":"Replay must not overwrite"}','{"id":"vision","lastUpdated":"version2","isPublic":false,"status":"in_progress"}',repeat('b',64));
  perform public.assert_ai((receipt->>'replayed')::boolean and receipt->'application'->>'saved_revision'='version1','lost response returns original receipt');
  perform public.assert_ai((select profile->>'vision'='Reviewed draft' from public.organizations where user_id='00000000-0000-0000-0000-000000000001'),'replay never changes the document');
  perform public.assert_ai(public.read_workspace_ai_run('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')->'application'->>'saved_revision'='version1','reopen reads durable application acknowledgment');
  begin update public.workspace_ai_document_applications set saved_revision='forged'; raise exception 'Receipt mutable';
    exception when raise_exception then if sqlerrm<>'AI ledger history is immutable' then raise; end if; end;
end $$;
rollback;
