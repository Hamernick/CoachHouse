\set ON_ERROR_STOP on
begin;
select public.fixture_closure_publication();
insert into public.organization_workspace_boards(org_id,state,updated_by) values(public.fixture_form_id(2),'{}',public.fixture_form_id(2));
do $$ declare source jsonb; command jsonb; board jsonb; result jsonb; action text; signature text; role_name text; response jsonb;
begin
 source:=public.organization_form_source_command(public.fixture_form_id(1),jsonb_build_object('action','read_form_source','versionId',public.fixture_form_id(80)));
 command:=jsonb_build_object('action','save_form_source','versionId',public.fixture_form_id(80),
   'operationId',public.fixture_form_id(750),'expectedRevision',source->>'revision',
   'content',(source-array['formId','revision'])||'{"title":"Corrected source"}'::jsonb);
 perform public.organization_form_source_command(public.fixture_form_id(1),command);
 perform public.organization_form_source_command(public.fixture_form_id(1),command);
 perform public.organization_form_viewer_access(public.fixture_form_id(1),jsonb_build_object('action','invite_viewer','versionId',public.fixture_form_id(80),
   'email','person2@example.org','responsePermission','edit','operationId',public.fixture_form_id(751),'expectedRevision',1));
 perform public.organization_form_viewer_access(public.fixture_form_id(2),jsonb_build_object('action','accept_viewer','versionId',public.fixture_form_id(80),'invitationId',public.fixture_form_id(751)));
 perform public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),
   'email','person3@example.org','role','edit','operationId',public.fixture_form_id(752),'expectedRevision',3));
 select state into board from public.organization_workspace_boards where org_id=public.fixture_form_id(1);
 perform public.fixture_closure('request',600,0);
 -- Source RPC, direct writes, and old acknowledged operations are equally fenced.
 begin perform public.organization_form_source_command(public.fixture_form_id(1),command); raise exception 'Source replay bypass'; exception when insufficient_privilege then null; end;
 begin perform public.organization_form_source_command(public.fixture_form_id(2),jsonb_build_object('action','read_form_source','versionId',public.fixture_form_id(80))); raise exception 'Source read bypass'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"late edit"'),updated_by=public.fixture_form_id(1) where org_id=public.fixture_form_id(1); raise exception 'Direct source bypass'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state=state||'{"placement":"late"}'::jsonb where org_id=public.fixture_form_id(1); raise exception 'Placement bypass'; exception when insufficient_privilege then null; end;
 begin delete from public.organization_workspace_boards where org_id=public.fixture_form_id(1); raise exception 'Board deletion bypass'; exception when insufficient_privilege then null; end;
 begin insert into public.organization_workspace_boards(org_id,state,updated_by) values(public.fixture_form_id(1),'{}',public.fixture_form_id(1)) on conflict(org_id) do update set state=excluded.state; raise exception 'Upsert bypass'; exception when insufficient_privilege then null; end;
 foreach action in array array['review_access','grant_reviewer','revoke_reviewer'] loop
   begin
     perform public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80)));
     raise exception 'Access command bypass: %',action;
   exception when insufficient_privilege then null; end;
 end loop;
 foreach action in array array['viewer_offer','viewer_invitations','invite_viewer','revoke_viewer','accept_viewer'] loop
   begin
     perform public.organization_form_viewer_access(public.fixture_form_id(2),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80),'invitationId',public.fixture_form_id(751)));
     raise exception 'Invitation command bypass: %',action;
   exception when insufficient_privilege then null; end;
 end loop;
 foreach action in array array['recoverable_forms','recover_form'] loop
   begin
     perform public.organization_form_recovery(public.fixture_form_id(1),jsonb_build_object('action',action,'organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20)));
     raise exception 'Owner recovery bypass: %',action;
   exception when insufficient_privilege then null; end;
 end loop;
 result:=public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action','source_access','organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20)));
 if result->>'canEdit'<>'false' or result->>'canManageAccess'<>'false' then raise exception 'Source edit affordance survived'; end if;
 -- Existing accepted collaborator retains only its permitted response export.
 response:=public.fixture_form_command('responses',2);
 if response#>>'{responses,0,answers,0,value}'<>'Joan' or response#>>'{permissions,canCorrect}'<>'false' then raise exception 'Response export changed'; end if;
 if jsonb_array_length(public.list_accessible_organization_forms(public.fixture_form_id(2),public.fixture_form_id(80))->'forms')<>1
   or jsonb_array_length(public.list_organization_form_response_versions(public.fixture_form_id(2),public.fixture_form_id(80))->'versions')<>1
   or jsonb_array_length(public.list_organization_form_versions(public.fixture_form_id(1),public.fixture_form_id(10))->'versions')<>1 then raise exception 'Export navigation lost'; end if;
 begin perform public.list_accessible_organization_forms(public.fixture_form_id(6),public.fixture_form_id(80)); raise exception 'Page guest gained form discovery'; exception when insufficient_privilege then null; end;
 -- Another organization's board can still change under the same shared login.
 update public.organization_workspace_boards set state='{"unrelated":"saved"}' where org_id=public.fixture_form_id(2);
 if (select state from public.organization_workspace_boards where org_id=public.fixture_form_id(1))<>board
   or (select count(*) from public.organization_form_source_operations)<>1
   or (select count(*) from public.organization_form_invitation_operations)<>1
   or (select count(*) from public.organization_form_access_operations)<>1 then raise exception 'Denied operation wrote data/receipt'; end if;
 perform public.fixture_closure('cancel',601,1);
 -- Explicit cancellation reopens ordinary authorized work, without redoing a
 -- prior source operation or reinstating a revoked publication/page invitation.
 perform public.organization_form_source_command(public.fixture_form_id(1),command);
 update public.organization_workspace_boards set state=state||'{"afterCancel":true}' where org_id=public.fixture_form_id(1);
 if (select count(*) from public.organization_form_source_operations)<>1
   or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null then raise exception 'Cancel/replay restored publication'; end if;
 perform public.fixture_closure('request',602,2);
 update public.organization_closures set requested_at=statement_timestamp()-interval '721 hours',export_until=statement_timestamp()-interval '1 hour' where org_id=public.fixture_form_id(1);
 begin perform public.list_accessible_organization_forms(public.fixture_form_id(2),public.fixture_form_id(80)); raise exception 'Expired directory'; exception when insufficient_privilege then null; end;
 begin perform public.list_organization_form_response_versions(public.fixture_form_id(2),public.fixture_form_id(80)); raise exception 'Expired versions'; exception when insufficient_privilege then null; end;
 begin perform public.list_organization_form_versions(public.fixture_form_id(1),public.fixture_form_id(10)); raise exception 'Expired page versions'; exception when insufficient_privilege then null; end;
 begin perform public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action','source_access','organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20))); raise exception 'Expired source capabilities'; exception when insufficient_privilege then null; end;
 -- Closing an organization without a board prevents first insertion too.
 delete from public.organization_workspace_boards where org_id=public.fixture_form_id(2);
 perform public.fixture_closure('request',610,0,2,2);
 begin insert into public.organization_workspace_boards(org_id,state,updated_by) values(public.fixture_form_id(2),'{}',public.fixture_form_id(2)); raise exception 'First insert bypass'; exception when insufficient_privilege then null; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
   for signature in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and (p.proname like '%before_closure' or p.proname in ('guard_workspace_board_closure','lock_closing_organization_board','organization_closure_command')) loop
     if has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Private function exposed: % %',role_name,signature; end if;
   end loop;
 end loop;
end $$;
rollback;
