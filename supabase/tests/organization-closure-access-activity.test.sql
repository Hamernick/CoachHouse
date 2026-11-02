\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_access_activity();
insert into public.organization_invites(id,org_id,email,token,expires_at,accepted_at)
values(public.fixture_form_id(2003),public.fixture_form_id(1),'synthetic-history@example.org','synthetic-accepted-invite',now()+interval '1 day',now());
insert into public.organization_access_requests(id,org_id,invitee_user_id,invitee_email,status,expires_at)
values(public.fixture_form_id(2013),public.fixture_form_id(1),public.fixture_form_id(6),'synthetic-history@example.org','accepted',now());
set local role authenticated;
do $$ begin
 update public.organization_invites set token='synthetic-refreshed-invite',expires_at=now()+interval '2 days' where id=public.fixture_form_id(2001);
 if not found then raise exception 'Active invite refresh lost'; end if;
 update public.organization_access_requests set invitee_email='synthetic-refreshed@example.org' where id=public.fixture_form_id(2011);
 if not found then raise exception 'Active request refresh lost'; end if;
 update public.organization_access_settings set admins_can_invite=false where org_id=public.fixture_form_id(1);
 if not found then raise exception 'Owner settings write lost'; end if;
 begin insert into public.organization_project_activity_events(org_id,entity_type,entity_id,event_type,title)
 values(public.fixture_form_id(1),'file',public.fixture_form_id(1101),'updated','Forged'); raise exception 'Activity write exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 update public.organization_access_settings set admins_can_invite=true where org_id=public.fixture_form_id(1);
 if found then raise exception 'Read-only member edited settings'; end if;
end $$;
reset role;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare relation text; begin
 foreach relation in array array['organization_access_settings','organization_memberships','organization_invites','organization_access_requests','organization_project_activity_events'] loop
 begin execute format('update public.%I set org_id=public.fixture_form_id(2) where org_id=public.fixture_form_id(1)',relation);
 raise exception 'Identity reassigned'; exception when insufficient_privilege then
 if sqlerrm not in ('Organization access identity cannot change','Organization activity identity cannot change') then raise; end if; end;
 end loop;
end $$;
select public.fixture_closure('request',600,0);
do $$ begin
 if exists(select 1 from public.organization_invites where org_id=public.fixture_form_id(1) and accepted_at is null)
 or not exists(select 1 from public.organization_invites where id=public.fixture_form_id(2003) and accepted_at is not null)
 or not exists(select 1 from public.organization_access_requests where id=public.fixture_form_id(2013) and status='accepted')
 or not exists(select 1 from public.organization_access_requests where id=public.fixture_form_id(2011) and status='revoked' and organization_invite_id is null)
 or not exists(select 1 from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13))
 or not exists(select 1 from public.organization_invites where org_id=public.fixture_form_id(2)) then raise exception 'Pending access shutdown crossed boundaries'; end if;
end $$;
set local role service_role;
do $$ declare command text; begin
 foreach command in array array[
 'update public.organization_access_settings set admins_can_invite=true where org_id=public.fixture_form_id(1)',
 'delete from public.organization_access_settings where org_id=public.fixture_form_id(1)',
 'insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(6),''staff'')',
 'update public.organization_memberships set role=''admin'' where org_id=public.fixture_form_id(1)',
 'update public.organization_access_requests set status=''accepted'' where id=public.fixture_form_id(2011)',
 'update public.organization_access_requests set status=''revoked'' where id=public.fixture_form_id(2013)',
 'update public.organization_project_activity_events set title=''Changed'' where id=public.fixture_form_id(2021)',
 'delete from public.organization_project_activity_events where id=public.fixture_form_id(2021)'
 ] loop begin execute command; raise exception 'Closing access/activity write admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end; end loop;
 begin insert into public.organization_closure_activity_admissions values(gen_random_uuid(),txid_current(),'{}'); raise exception 'Private admission mint exposed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.organization_closure_activity_admissions; raise exception 'Private admission read exposed'; exception when insufficient_privilege then null; end;
 delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(6);
end $$;
reset role;
-- Exact nested shapes cannot forge the source trigger's one-use admission.
create function public.fixture_forged_cleanup_activity() returns trigger language plpgsql as $$ begin
 insert into public.organization_project_activity_events(org_id,entity_type,entity_id,event_type,title,actor_id,metadata)
 select org_id,'file',id,'updated',name,public.organization_activity_actor_id(),jsonb_build_object('source','organization_external_documents')
 from public.organization_external_documents where id=public.fixture_form_id(1101); return new; end $$;
create temporary table forged_cleanup_activity(n integer);
create trigger forged after insert on forged_cleanup_activity for each row execute function public.fixture_forged_cleanup_activity();
select public.fixture_drive_disconnect();
do $$ begin
 if exists(select 1 from public.organization_external_documents where status<>'needs_reconnect') then raise exception 'Shared revocation failed'; end if;
 begin insert into forged_cleanup_activity values(1); raise exception 'Forged nested revocation audit admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if exists(select 1 from public.organization_closure_activity_admissions) then raise exception 'One-use admission persisted'; end if;
 delete from public.google_drive_connections where id=public.fixture_form_id(1110);
 if exists(select 1 from public.organization_external_documents where connection_id is not null or status<>'needs_reconnect') then raise exception 'Connection FK cleanup failed'; end if;
 delete from auth.users where id=public.fixture_form_id(13);
 if exists(select 1 from public.organization_external_documents where attached_by is not null)
 or exists(select 1 from public.organization_project_assets where created_by is not null or updated_by is not null)
 or exists(select 1 from public.organization_project_activity_events where actor_id=public.fixture_form_id(13))
 or exists(select 1 from public.organization_memberships where member_id=public.fixture_form_id(13))
 or exists(select 1 from public.organization_access_requests where invitee_user_id=public.fixture_form_id(13))
 or (select count(*) from public.organization_external_documents)<>2
 or (select count(*) from public.organization_project_assets)<>2
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Separate account cleanup crossed boundaries'; end if;
 if exists(select 1 from public.organization_closure_activity_admissions) then raise exception 'Account cleanup admission persisted'; end if;
 perform public.fixture_closure('cancel',601,1);
 if exists(select 1 from public.organization_invites where org_id=public.fixture_form_id(1) and accepted_at is null)
 or exists(select 1 from public.organization_memberships where member_id=public.fixture_form_id(13))
 or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel resurrected access'; end if;
end $$;
set local role service_role;
update public.organization_access_settings set admins_can_invite=true where org_id=public.fixture_form_id(1);
reset role;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
do $$ declare role_name text; begin
 begin delete from public.organization_project_activity_events where org_id=public.fixture_form_id(1); raise exception 'Expiry authorized history purge'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_organization_access_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.guard_organization_activity_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.record_organization_file_activity()','EXECUTE')
 or has_function_privilege(role_name,'public.revoke_organization_pending_access_on_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle/cleanup authority exposed'; end if;
 end loop;
end $$;
rollback;
