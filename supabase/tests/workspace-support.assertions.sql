-- Isolated identities: granted staff, ordinary coach, owner; two private workspaces.
insert into auth.users(id) values ('77000000-0000-0000-0000-000000000001'),('77000000-0000-0000-0000-000000000002'),('77000000-0000-0000-0000-000000000003');
insert into public.profiles values ('77000000-0000-0000-0000-000000000001','Verified coach');
insert into public.platform_staff_members values ('77000000-0000-0000-0000-000000000001','coach'),('77000000-0000-0000-0000-000000000002','coach');
insert into public.workspace_support_grants(user_id) values('77000000-0000-0000-0000-000000000001');
insert into public.organizations(user_id,profile) values ('77000000-0000-0000-0000-000000000003','{"name":"Support alpha"}'),('77000000-0000-0000-0000-000000000002','{"name":"Support beta"}');
-- A granted coach can have an account but no personal organization.
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000001';
set request.headers='{"x-coach-house-organization-id":"77000000-0000-0000-0000-000000000001"}';
set role authenticated;
do $$ begin
 begin
  perform public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000001','/workspace',null,false);
  raise exception 'unpersisted owner target accepted';
 exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
set request.headers='{"x-coach-house-organization-id":"77000000-0000-0000-0000-000000000099"}';
set role authenticated;
do $$ begin
 begin
  perform public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000099','78000000-0000-0000-0000-000000000001','/workspace',null,false);
  raise exception 'missing support target accepted';
 exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.workspace_support_presence) then raise exception 'missing target created presence'; end if;
 if exists(select 1 from public.organizations where user_id='77000000-0000-0000-0000-000000000001') then raise exception 'presence created organization'; end if;
end $$;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000001';
set request.headers='{"x-coach-house-organization-id":"77000000-0000-0000-0000-000000000003"}';
set role authenticated;
do $$ begin
 if not public.has_workspace_support_access() then raise exception 'explicit grant unavailable'; end if;
 if (select count(*) from public.search_workspace_support_organizations(''))<>0 then raise exception 'empty search leaked full directory'; end if;
 if (select count(*) from public.search_workspace_support_organizations('Support'))<>2 then raise exception 'search missing org'; end if;
 if (select count(*) from public.organizations)<>1 then raise exception 'unselected tenant visible'; end if;
 if public.workspace_support_can_write('77000000-0000-0000-0000-000000000003') then raise exception 'invisible support can write'; end if;
 perform public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000003','78000000-0000-0000-0000-000000000001','/workspace','{"x":0.5,"y":0.5}',true);
 if not public.workspace_support_can_write('77000000-0000-0000-0000-000000000003') then raise exception 'visible support cannot edit'; end if;
 update public.organizations set profile=profile||'{"mission":"supported"}' where user_id='77000000-0000-0000-0000-000000000003';
 if not found then raise exception 'support edit denied'; end if;
 update public.organizations set profile='{}' where user_id='77000000-0000-0000-0000-000000000002';
 if found then raise exception 'cross-org write allowed'; end if;
 delete from public.organizations where user_id='77000000-0000-0000-0000-000000000003';
 if found then raise exception 'support can delete organization'; end if;
 begin
 insert into public.workspace_support_grants(user_id) values('77000000-0000-0000-0000-000000000002');
 raise exception 'support can self grant'; exception when insufficient_privilege then null; end;
 insert into storage.objects values('79000000-0000-0000-0000-000000000001','org-documents','77000000-0000-0000-0000-000000000003/file');
 begin
 insert into storage.objects values('79000000-0000-0000-0000-000000000002','org-documents','77000000-0000-0000-0000-000000000002/file');
 raise exception 'cross-org upload allowed'; exception when insufficient_privilege then null; end;
 begin
 perform public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000002','78000000-0000-0000-0000-000000000001','/workspace',null,false);
 raise exception 'cross-org presence allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.workspace_support_audit where actor_id='77000000-0000-0000-0000-000000000001' and action='organizations.update') then raise exception 'audit missing'; end if;
end $$;
-- Ordinary coaches and client metadata do not grant support access.
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000002';
set role authenticated;
do $$ begin
 if public.has_workspace_support_access() then raise exception 'ordinary coach gained support'; end if;
 begin perform public.search_workspace_support_organizations('Support'); raise exception 'ordinary coach searched support'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Owner can see authenticated staff presence; cannot forge staff identity.
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000003';
set role authenticated;
do $$ declare result jsonb; begin
 result:=public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000003','78000000-0000-0000-0000-000000000003','/workspace',null,false);
 if jsonb_array_length(result)<>1 or result->0->>'name'<>'Verified coach' then raise exception 'verified presence missing'; end if;
end $$;
reset role;
-- A target deleted after the page opened cannot leave a retrying orphan session.
insert into auth.users(id) values('77000000-0000-0000-0000-000000000099');
insert into public.organizations(user_id,profile) values('77000000-0000-0000-0000-000000000099','{}');
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000001';
set request.headers='{"x-coach-house-organization-id":"77000000-0000-0000-0000-000000000099"}';
set role authenticated;
select public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000099','78000000-0000-0000-0000-000000000099','/workspace',null,false);
reset role;
delete from public.organizations where user_id='77000000-0000-0000-0000-000000000099';
set role authenticated;
do $$ begin
 begin
  perform public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000099','78000000-0000-0000-0000-000000000099','/workspace',null,false);
  raise exception 'deleted target accepted';
 exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.workspace_support_presence where org_id='77000000-0000-0000-0000-000000000099') then raise exception 'deleted target retained presence'; end if;
end $$;
set request.headers='{"x-coach-house-organization-id":"77000000-0000-0000-0000-000000000003"}';
update public.workspace_support_grants set revoked_at=now() where user_id='77000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin
 if public.has_workspace_support_access() or public.workspace_support_can_write('77000000-0000-0000-0000-000000000003') then raise exception 'revocation ignored'; end if;
 if exists(select 1 from public.organizations) then raise exception 'revoked support can read'; end if;
end $$;
reset role;
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000003';
set role authenticated;
do $$ begin
 if jsonb_array_length(public.sync_workspace_support_presence('77000000-0000-0000-0000-000000000003','78000000-0000-0000-0000-000000000003','/workspace',null,false))<>0 then raise exception 'revoked actor still visible'; end if;
end $$;
reset role;
-- Expired presence, suspended Auth users and removed staff membership all deny writes.
update public.workspace_support_grants set revoked_at=null where user_id='77000000-0000-0000-0000-000000000001';
update public.workspace_support_presence set seen_at=now()-interval '1 minute';
set request.jwt.claim.sub='77000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin
 if public.workspace_support_can_write('77000000-0000-0000-0000-000000000003') then raise exception 'expired presence allowed write'; end if;
end $$;
reset role;
update auth.users set banned_until=now()+interval '1 day' where id='77000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin if public.has_workspace_support_access() then raise exception 'suspended user retained support'; end if; end $$;
reset role;
update auth.users set banned_until=null where id='77000000-0000-0000-0000-000000000001';
delete from public.platform_staff_members where user_id='77000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin if public.has_workspace_support_access() then raise exception 'removed staff retained support'; end if; end $$;
reset role;
