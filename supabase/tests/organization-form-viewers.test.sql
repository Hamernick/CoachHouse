\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(4),'staff') on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=public.fixture_form_id(1) and id=public.fixture_form_id(20)),public.fixture_form_id(1));
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function pg_temp.viewer(action text,actor integer default 4,op integer default 600,rev integer default 1,inv integer default 600,email text default 'person2@example.org') returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80),
 'email',email,'operationId',public.fixture_form_id(op),'expectedRevision',rev,'invitationId',public.fixture_form_id(inv)));
$$;
select pg_temp.viewer('invite_viewer');
do $$ begin
 if (pg_temp.viewer('viewer_invitations')->'invitations'->0->>'accepted')<>'false' then raise exception 'Invitation preaccepted'; end if;
 begin perform public.fixture_form_command('responses',2); raise exception 'Unaccepted viewer read answers'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.viewer('viewer_offer',3); raise exception 'Wrong email saw offer'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.viewer('accept_viewer',3); raise exception 'Wrong email accepted'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.viewer('viewer_invitations',2); raise exception 'Viewer listed invitations'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.viewer('invite_viewer',1); raise exception 'Owner bypassed primary manager'; exception when insufficient_privilege then null; end;
 if pg_temp.viewer('viewer_offer',2)->>'title'<>'Sign up' then raise exception 'Missing offer'; end if;
end $$;
update auth.users set email_confirmed_at=null where id=public.fixture_form_id(2);
do $$ begin
 begin perform pg_temp.viewer('accept_viewer',2); raise exception 'Unverified account accepted'; exception when insufficient_privilege then null; end;
end $$;
update auth.users set email_confirmed_at=now() where id=public.fixture_form_id(2);
select pg_temp.viewer('accept_viewer',2);
select pg_temp.viewer('accept_viewer',2);
do $$ begin
 if (select access_revision from public.organization_forms)<>3 then raise exception 'Acceptance duplicated'; end if;
 if exists(select 1 from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(2)) then raise exception 'Joined organization'; end if;
 if public.fixture_form_command('responses',2)#>>'{responses,0,answers,0,value}'<>'Joan' then raise exception 'Missing answers'; end if;
 if public.fixture_form_command('responses',2)#>>'{permissions,canCorrect}'<>'false' or public.fixture_form_command('responses',2)#>>'{permissions,canManageAccess}'<>'false' then raise exception 'Viewer escalated'; end if;
 perform public.fixture_form_command('response',2);
 begin perform public.fixture_form_command('correct',2); raise exception 'Viewer corrected'; exception when insufficient_privilege then null; end;
 begin perform public.organization_form_review_access(public.fixture_form_id(2),jsonb_build_object('action','source_access','organizationId',public.fixture_form_id(1),'formId',public.fixture_form_id(20))); raise exception 'Viewer opened source'; exception when insufficient_privilege then null; end;
 begin perform public.list_organization_form_versions(public.fixture_form_id(2),public.fixture_form_id(10),null); raise exception 'Viewer discovered other forms'; exception when insufficient_privilege then null; end;
 -- A form grant cannot become another form's read, even on the same page.
 insert into public.organization_forms(org_id,id,intake_manager) values(public.fixture_form_id(1),public.fixture_form_id(21),public.fixture_form_id(4));
 insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
   select public.fixture_form_id(81),org_id,public.fixture_form_id(21),page_id,version from public.organization_form_versions where id=public.fixture_form_id(80);
 begin perform public.fixture_form_command('responses',2,jsonb_build_object('versionId',public.fixture_form_id(81))); raise exception 'Viewer crossed form scope'; exception when insufficient_privilege then null; end;
 delete from public.organization_forms where id=public.fixture_form_id(21);
 -- Invitation expiration applies to accepting, not already accepted access.
 update public.organization_form_viewer_invitations set expires_at=now()-interval '1 day';
 perform public.fixture_form_command('responses',2);
end $$;
select pg_temp.viewer('revoke_viewer',4,601,3);
do $$ begin
 begin perform public.fixture_form_command('responses',2); raise exception 'Revoked viewer read'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.viewer('accept_viewer',2); raise exception 'Revoked invite accepted'; exception when insufficient_privilege then null; end;
 -- Old exact operation receipt cannot resurrect revoked access.
 perform pg_temp.viewer('invite_viewer');
 if exists(select 1 from public.organization_form_viewer_invitations where revoked_at is null) then raise exception 'Retry restored invite'; end if;
 begin perform pg_temp.viewer('invite_viewer',4,600,1,600,'person3@example.org'); raise exception 'Operation reused'; exception when unique_violation then null; end;
 begin perform pg_temp.viewer('invite_viewer',4,602,1); raise exception 'Stale invite created'; exception when serialization_failure then null; end;
end $$;
select pg_temp.viewer('invite_viewer',4,602,4);
update public.organization_form_viewer_invitations set expires_at=now()-interval '1 day' where id=public.fixture_form_id(602);
do $$ begin
 begin perform pg_temp.viewer('accept_viewer',2,602,4,602); raise exception 'Expired accepted'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.viewer('invite_viewer',4,603,5);
select pg_temp.viewer('accept_viewer',2,603,5,603);
update public.organization_memberships set role='member' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
update public.organization_memberships set role='staff' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(4);
do $$ begin
 begin perform public.fixture_form_command('responses',2); raise exception 'Manager rejoin restored viewer'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.organization_form_viewer_invitations where revoked_at is null) then raise exception 'Manager loss retained invitations'; end if;
 if (select original_hash from public.organization_form_responses)<>repeat('a',64) then raise exception 'Changed original receipt'; end if;
 if has_function_privilege('authenticated','public.organization_form_viewer_access(uuid,jsonb)','EXECUTE') or has_function_privilege('service_role','public.can_view_invited_form_responses(uuid,uuid,uuid)','EXECUTE') then raise exception 'Exposed helper'; end if;
 if has_table_privilege('anon','public.organization_form_viewer_invitations','SELECT') or has_table_privilege('authenticated','public.organization_form_viewer_invitations','INSERT') or has_table_privilege('service_role','public.organization_form_invitation_operations','INSERT') then raise exception 'Exposed tables'; end if;
 if not (select relrowsecurity from pg_class where oid='public.organization_form_viewer_invitations'::regclass) or not (select relrowsecurity from pg_class where oid='public.organization_form_invitation_operations'::regclass) then raise exception 'RLS disabled'; end if;
end $$;
rollback;
