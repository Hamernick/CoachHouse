\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('coach_house.workspace_sharing_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Fixture required'; end if;
end $$;
insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(4),'staff') on conflict(org_id,member_id) do update set role='staff';
update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where id=public.fixture_form_id(20)),public.fixture_form_id(1));
truncate public.organization_forms cascade;
delete from public.organization_workspace_pages;
select public.fixture_form_publish(0,'publish',80,4);
select public.fixture_form_command('submit');
create function pg_temp.access(actor integer,action text,patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_viewer_access(public.fixture_form_id(actor),jsonb_build_object('action',action,'versionId',public.fixture_form_id(80))||patch);
$$;
create function pg_temp.invite(actor integer,person integer,scope text,op integer) returns jsonb language sql as $$
 select pg_temp.access(actor,'invite_viewer',jsonb_build_object('email','person'||person||'@example.org','responsePermission',scope,'operationId',public.fixture_form_id(op),'expectedRevision',(select access_revision from public.organization_forms where id=public.fixture_form_id(20))));
$$;
create function pg_temp.accept(actor integer,op integer) returns jsonb language sql as $$
 select pg_temp.access(actor,'accept_viewer',jsonb_build_object('invitationId',public.fixture_form_id(op)));
$$;
create function pg_temp.revoke(actor integer,invitation integer,op integer) returns jsonb language sql as $$
 select pg_temp.access(actor,'revoke_viewer',jsonb_build_object('invitationId',public.fixture_form_id(invitation),'operationId',public.fixture_form_id(op),'expectedRevision',(select access_revision from public.organization_forms where id=public.fixture_form_id(20))));
$$;
select pg_temp.invite(4,2,'manage',800);
do $$ begin
 begin perform pg_temp.invite(2,3,'edit',801); raise exception 'Pending manager granted access'; exception when insufficient_privilege then null; end;
 if pg_temp.access(2,'viewer_offer')->>'responsePermission'<>'manage' then raise exception 'Missing Manage disclosure'; end if;
end $$;
select pg_temp.accept(2,800);
do $$ declare r jsonb; begin
 r:=pg_temp.access(2,'viewer_invitations');
 if (r->>'canGrantManage')::boolean or r->'invitations'<>'[]'::jsonb then raise exception 'Delegate roster over-disclosed'; end if;
 if not (public.fixture_form_command('responses',2)#>>'{permissions,canManageInvitations}')::boolean
   or (public.fixture_form_command('responses',2)#>>'{permissions,canManageAccess}')::boolean then raise exception 'Wrong presentation capabilities'; end if;
 perform public.organization_form_source_command(public.fixture_form_id(2),jsonb_build_object('action','read_form_source','versionId',public.fixture_form_id(80)));
 begin perform public.fixture_form_publish(1,'publish',81,2); raise exception 'External manager published'; exception when insufficient_privilege then null; end;
 begin perform public.organization_form_review_access(public.fixture_form_id(2),jsonb_build_object('action','review_access','versionId',public.fixture_form_id(80))); raise exception 'Internal roster disclosed'; exception when insufficient_privilege then null; end;
 begin update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(2); raise exception 'External manager removed source'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite(2,3,'manage',802); raise exception 'Manage redelegated'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access(1,'viewer_invitations'); raise exception 'Implicit owner access'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite(2,3,'edit',803);
select pg_temp.accept(3,803);
select pg_temp.invite(4,5,'view',804);
select pg_temp.accept(5,804);
do $$ declare r jsonb; begin
 r:=pg_temp.access(2,'viewer_invitations');
 if jsonb_array_length(r->'invitations')<>1 or r#>>'{invitations,0,email}'<>'person3@example.org' then raise exception 'Other grantor roster leaked'; end if;
 if not public.can_edit_invited_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(3)) then raise exception 'Child Edit missing'; end if;
 if public.can_edit_invited_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(5)) then raise exception 'View gained Edit'; end if;
 begin perform pg_temp.invite(2,5,'edit',805); raise exception 'Delegate replaced primary grant'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.revoke(2,804,806); raise exception 'Delegate revoked primary grant'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.revoke(2,800,807); raise exception 'Delegate mutated own authority'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.invite(3,6,'view',808); raise exception 'Child redelegated'; exception when insufficient_privilege then null; end;
end $$;
-- A delegate can revoke and replace only their own children; acceptance is renewed.
select pg_temp.revoke(2,803,809);
do $$ begin
 begin perform public.fixture_form_command('responses',3); raise exception 'Revoked child read'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.invite(2,3,'edit',810); select pg_temp.accept(3,810);
-- Primary adopts a child with a new direct invitation. Parent removal cannot remove it.
select pg_temp.invite(4,3,'edit',811); select pg_temp.accept(3,811);
select pg_temp.invite(2,6,'correct',812); select pg_temp.accept(6,812);
do $$ begin
 begin perform pg_temp.invite(2,3,'view',813); raise exception 'Adopted child overwritten'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.revoke(4,800,814);
do $$ begin
 if public.can_view_invited_form_responses(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(6)) then raise exception 'Child survived parent revoke'; end if;
 begin perform pg_temp.accept(6,812); raise exception 'Child revived by accept retry'; exception when insufficient_privilege then null; end;
 begin perform pg_temp.access(2,'viewer_invitations'); raise exception 'Revoked manager read roster'; exception when insufficient_privilege then null; end;
 perform public.fixture_form_command('responses',3); perform public.fixture_form_command('responses',5);
end $$;
select pg_temp.invite(4,2,'manage',815); select pg_temp.accept(2,815);
do $$ begin
 if public.can_correct_invited_form_responses(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(6)) then raise exception 'New Manage revived old child'; end if;
end $$;
-- Replace Manage with Edit: exact dependent grant ends, unrelated grants survive.
select pg_temp.invite(2,6,'edit',816); select pg_temp.accept(6,816);
select pg_temp.invite(4,2,'edit',817); select pg_temp.accept(2,817);
do $$ begin
 if public.can_view_invited_form_responses(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(6)) then raise exception 'Downgrade retained child'; end if;
 if public.can_manage_invited_form(public.fixture_form_id(1),public.fixture_form_id(20),public.fixture_form_id(2)) then raise exception 'Downgrade retained Manage'; end if;
 perform public.fixture_form_command('responses',2); perform public.fixture_form_command('responses',3);
 if (select count(*) from public.organization_form_responses)<>1 or exists(select 1 from public.organization_form_corrections)
   or (select version->>'title' from public.organization_form_versions limit 1)<>'Sign up' then raise exception 'Intake changed'; end if;
 if exists(select 1 from public.organization_memberships where member_id in (public.fixture_form_id(2),public.fixture_form_id(6))) then raise exception 'Manufactured membership'; end if;
 if has_function_privilege('authenticated','public.valid_organization_form_invitation(uuid)','EXECUTE')
   or has_function_privilege('authenticated','public.can_manage_invited_form(uuid,uuid,uuid)','EXECUTE')
   or has_table_privilege('authenticated','public.organization_form_viewer_invitations','SELECT') then raise exception 'Private authority exposed'; end if;
end $$;
-- Existing internal View does not hide a pending external Manage offer.
select public.organization_form_review_access(public.fixture_form_id(4),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80),'email','person3@example.org','role','view','operationId',public.fixture_form_id(840),'expectedRevision',(select access_revision from public.organization_forms where id=public.fixture_form_id(20))));
select pg_temp.invite(4,3,'manage',841);
do $$ declare r jsonb; begin
 r:=public.fixture_form_command('responses',3);
 if not (r#>>'{permissions,hasPendingInvitation}')::boolean or (r#>>'{permissions,canManageInvitations}')::boolean then raise exception 'Pending upgrade hidden or automatically granted'; end if;
end $$;
select pg_temp.accept(3,841);
do $$ declare r jsonb; begin
 r:=public.fixture_form_command('responses',3);
 if (r#>>'{permissions,hasPendingInvitation}')::boolean or not (r#>>'{permissions,canManageInvitations}')::boolean then raise exception 'Accepted upgrade not reflected'; end if;
end $$;
-- Primary manager loss kills the complete chain permanently, not just direct grants.
select pg_temp.invite(4,2,'manage',818); select pg_temp.accept(2,818);
select pg_temp.invite(2,6,'view',819); select pg_temp.accept(6,819);
update public.organization_memberships set role='member' where member_id=public.fixture_form_id(4);
update public.organization_memberships set role='staff' where member_id=public.fixture_form_id(4);
do $$ begin
 begin perform public.fixture_form_command('responses',6); raise exception 'Manager rejoin revived child'; exception when insufficient_privilege then null; end;
end $$;
rollback;
