\set ON_ERROR_STOP on
begin;
insert into public.profiles values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
insert into public.organizations(user_id,profile) values('11111111-1111-4111-8111-111111111111','{"name":"Actual organization","roadmap":{"sections":[{"id":"mission_vision_values","content":"Original mission"}]}}'),('44444444-4444-4444-8444-444444444444','{}');
insert into public.organization_memberships values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','board');
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id) values('11111111-1111-4111-8111-111111111111','active','{"plan_tier":"organization"}','sub_paid');
insert into public.classes values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.modules values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
insert into public.module_assignments values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"fields":[{"name":"mission","type":"long_text","required":true}],"completion_mode":"all_answered"}',true,'2026-10-26T00:00:00Z');
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$ declare org uuid:='11111111-1111-4111-8111-111111111111'; lesson uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; state jsonb; original jsonb; stamp timestamptz; next_profile jsonb; receipt jsonb;
begin
 perform public.companion_authorize(org,true);
 state:=public.companion_read_draft(org,lesson);
 if state->>'revision'<>'0' or state->'answers'<>'{}'::jsonb then raise exception 'initial draft wrong'; end if;
 perform public.companion_write_assignment(org,lesson,'test-client','draft-0001',0,'{"mission":"First draft"}',false,false,null,'2026-10-26T00:00:00Z',false);
 if exists(select 1 from public.assignment_submissions) then raise exception 'draft submitted accidentally'; end if;
 state:=public.companion_read_draft(org,lesson);
 if state->>'revision'<>'1' or state->'answers'->>'mission'<>'First draft' then raise exception 'draft readback wrong'; end if;
 perform public.companion_write_assignment(org,lesson,'test-client','draft-0001',0,'{"mission":"First draft"}',false,false,null,'2026-10-26T00:00:00Z',false);
 begin
  perform public.companion_write_assignment(org,lesson,'test-client','draft-0001',0,'{"mission":"Different"}',false,false,null,'2026-10-26T00:00:00Z',false);
  raise exception 'reused request accepted';
 exception when raise_exception then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
 begin
  perform public.companion_write_assignment(org,lesson,'test-client','draft-stale',0,'{"mission":"Stale"}',false,false,null,'2026-10-26T00:00:00Z',false);
  raise exception 'stale revision accepted';
 exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 begin
  perform public.companion_write_assignment(org,lesson,'test-client','submit-noconfirm',1,'{"mission":"First draft"}',true,false,null,'2026-10-26T00:00:00Z',true);
  raise exception 'unconfirmed submit accepted';
 exception when raise_exception then if sqlerrm<>'confirmation_required' then raise; end if; end;
 perform public.companion_write_assignment(org,lesson,'test-client','submit-0001',1,'{"mission":"First draft"}',true,true,null,'2026-10-26T00:00:00Z',true);
 -- Same canonical rows the native app reads, under its normal actor RLS.
 if not exists(select 1 from public.assignment_submissions where user_id=org and answers->>'mission'='First draft' and status='submitted') then raise exception 'native submission mismatch'; end if;
 if not exists(select 1 from public.module_progress where user_id=org and status='completed') then raise exception 'native completion mismatch'; end if;
 perform public.companion_write_assignment(org,lesson,'test-client','submit-0001',1,'{"mission":"First draft"}',true,true,null,'2026-10-26T00:00:00Z',true);
 begin
  perform public.companion_write_assignment(org,lesson,'test-client','submit-stale',1,'{"mission":"Stale"}',true,true,null,'2026-10-26T00:00:00Z',true);
  raise exception 'stale native submission overwritten';
 exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 begin
  perform public.companion_read_draft(org,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'); raise exception 'unpublished lesson exposed';
 exception when raise_exception then if sqlerrm<>'lesson_unavailable' then raise; end if; end;
 select profile,updated_at into original,stamp from public.organizations where user_id=org;
 next_profile:=jsonb_set(original,'{roadmap,sections,0,content}','"Reviewed mission"');
 perform public.companion_save_document(org,'mission','test-client','document-0001',repeat('a',64),'Reviewed mission',original,stamp,true);
 if not exists(select 1 from public.organizations where user_id=org and profile#>>'{roadmap,sections,0,content}'='<p>Reviewed mission</p>' and profile->>'name'='Actual organization') then raise exception 'native document mismatch'; end if;
 perform public.companion_save_document(org,'mission','test-client','document-0001',repeat('a',64),'Reviewed mission',original,stamp,true);
 begin
  perform public.companion_save_document(org,'mission','test-client','document-stale',repeat('a',64),'Reviewed mission',original,stamp,true); raise exception 'stale doc accepted';
 exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 if has_table_privilege('authenticated','public.companion_assignment_drafts','select') or has_table_privilege('authenticated','public.companion_mutation_receipts','insert') then raise exception 'private storage exposed'; end if;
end $$;
-- Publication and unrelated sections are derived from the stored row, never caller input.
reset role;
update public.organizations set profile='{"name":"Keep name","mission":"Legacy mission","roadmap":{"heroUrl":"keep-hero","sections":[{"id":"mission_vision_values","content":"<p>Published original</p>","status":"complete","isPublic":true,"publicProfileStatusControlled":true,"custom":"keep"},{"id":"vision","content":"Do not change","status":"complete","isPublic":false}]}}' where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$ declare org uuid:='11111111-1111-4111-8111-111111111111'; original jsonb; stamp timestamptz; saved jsonb; begin
 select profile,updated_at into original,stamp from public.organizations where user_id=org;
 -- The old payload-bearing signature is absent: cannot inject another section, publication
 -- flags, a mismatched HTML body, or arbitrary caller/user ownership via profile JSON.
 if to_regprocedure('public.companion_save_document(uuid,text,text,text,text,text,jsonb,timestamptz,jsonb,boolean)') is not null then raise exception 'unrestricted profile RPC remains'; end if;
 perform public.companion_save_document(org,'mission','test-client','publication-1',repeat('b',64),'Reviewed <script>literal</script> & text',original,stamp,true);
 select profile into saved from public.organizations where user_id=org;
 if saved#>>'{roadmap,sections,0,content}' <> '<p>Reviewed &lt;script&gt;literal&lt;/script&gt; &amp; text</p>' then raise exception 'approved content mismatch or HTML injection'; end if;
 if saved#>'{roadmap,sections,1}' is distinct from original#>'{roadmap,sections,1}' then raise exception 'other section changed'; end if;
 if saved#>>'{roadmap,heroUrl}' <> 'keep-hero' or saved->>'name' <> 'Keep name' then raise exception 'unrelated profile changed'; end if;
 if saved#>>'{roadmap,sections,0,publishedContent}' <> '<p>Published original</p>' then raise exception 'published version changed'; end if;
 if saved#>'{roadmap,sections,0,isPublic}' <> 'true'::jsonb or saved#>>'{roadmap,sections,0,custom}' <> 'keep' then raise exception 'target publication/settings changed'; end if;
 if saved#>>'{roadmap,sections,0,status}' <> 'in_progress' then raise exception 'draft accidentally published'; end if;
 -- A second draft must preserve the original published version, not expose the first draft.
 select updated_at into stamp from public.organizations where user_id=org;
 perform public.companion_save_document(org,'mission','test-client','publication-2',repeat('c',64),'Second draft',saved,stamp,true);
 if (select profile#>>'{roadmap,sections,0,publishedContent}' from public.organizations where user_id=org) <> '<p>Published original</p>' then raise exception 'draft published on second save'; end if;
end $$;
reset role;
update public.organizations set profile='{"name":"Legacy organization","mission":"Legacy public","roadmap":{"heroUrl":"legacy-hero","sections":{"mission_vision_values":{"content":"Private","custom":"preserve"},"vision":{"content":"Other section"}}}}' where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$ declare org uuid:='11111111-1111-4111-8111-111111111111'; original jsonb; stamp timestamptz; saved jsonb; begin
 select profile,updated_at into original,stamp from public.organizations where user_id=org;
 perform public.companion_save_document(org,'mission','test-client','legacy-draft',repeat('d',64),'New legacy draft',original,stamp,true);
 select profile into saved from public.organizations where user_id=org;
 if jsonb_typeof(saved#>'{roadmap,sections}') <> 'object' then raise exception 'legacy shape rewritten'; end if;
 if saved#>'{roadmap,sections,vision}' is distinct from original#>'{roadmap,sections,vision}' then raise exception 'legacy unrelated section changed'; end if;
 if saved#>>'{roadmap,sections,mission_vision_values,publishedContent}' <> 'Legacy public' then raise exception 'legacy public version lost'; end if;
end $$;
reset role;
update public.organizations set profile='{"origin_story":[],"originStory":"Secondary public original","roadmap":{"sections":[]}}' where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$ declare org uuid:='11111111-1111-4111-8111-111111111111'; original jsonb; stamp timestamptz; begin
 select profile,updated_at into original,stamp from public.organizations where user_id=org;
 perform public.companion_save_document(org,'originStory','test-client','legacy-alias',repeat('e',64),'New draft',original,stamp,true);
 if (select profile#>>'{roadmap,sections,0,publishedContent}' from public.organizations where user_id=org) <> 'Secondary public original' then raise exception 'empty primary legacy alias hid public content'; end if;
end $$;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$ begin
 perform public.companion_authorize('11111111-1111-4111-8111-111111111111',false);
 begin
  perform public.companion_authorize('11111111-1111-4111-8111-111111111111',true); raise exception 'board edited organization';
 exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
 if exists(select 1 from public.assignment_submissions) or exists(select 1 from public.module_progress) then raise exception 'cross-user native records exposed'; end if;
 if public.companion_read_draft('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->'answers'<>'{}'::jsonb then raise exception 'cross-user draft exposed'; end if;
end $$;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$ begin
 begin perform public.companion_authorize('11111111-1111-4111-8111-111111111111',false); raise exception 'outsider allowed';
 exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
end $$;
set local request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
do $$ begin
 begin perform public.companion_authorize('44444444-4444-4444-8444-444444444444',false); raise exception 'free account allowed';
 exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
end $$;
reset role;
delete from public.organization_memberships;
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$ begin
 begin perform public.companion_read_draft('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'); raise exception 'revoked membership allowed';
 exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
end $$;
reset role;
update public.subscriptions set status='canceled';
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$ begin
 begin perform public.companion_authorize('11111111-1111-4111-8111-111111111111',false); raise exception 'revoked entitlement allowed';
 exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.companion_read_draft('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'); raise exception 'anonymous RPC allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
