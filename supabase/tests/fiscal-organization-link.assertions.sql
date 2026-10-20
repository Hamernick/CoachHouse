begin;
create temporary table fiscal_link_fixture(reference uuid,project_id uuid,owner_id uuid,reviewer_id uuid,request_id uuid,version text,project_before jsonb,application_before jsonb,event_count bigint);
do $$ declare s public.fiscal_guest_submissions%rowtype; owner_id uuid:='81000000-0000-4000-8000-000000000001'; reviewer uuid:='81000000-0000-4000-8000-000000000002'; begin
 select * into strict s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(owner_id,s.contact_email),(reviewer,'fiscal-link-reviewer@example.test'),
 ('81000000-0000-4000-8000-000000000003','fiscal-link-editor@example.test'),
 ('81000000-0000-4000-8000-000000000004','fiscal-link-board@example.test');
 insert into auth.users values(owner_id,s.contact_email,now()),(reviewer,'fiscal-link-reviewer@example.test',now()),
 ('81000000-0000-4000-8000-000000000003','fiscal-link-editor@example.test',now()),
 ('81000000-0000-4000-8000-000000000004','fiscal-link-board@example.test',now());
 insert into public.organizations(user_id,profile,is_public) values(owner_id,'{"name":"Existing Applicant Org","mission":"Keep existing info"}',true);
 insert into public.platform_staff_members(user_id,access_level) values(reviewer,'coach');
 insert into public.fiscal_project_reviewers(project_id,user_id) values(s.project_id,reviewer);
 insert into public.organization_memberships values(owner_id,'81000000-0000-4000-8000-000000000003','staff'),(owner_id,'81000000-0000-4000-8000-000000000004','board');
 insert into fiscal_link_fixture select s.id,s.project_id,owner_id,reviewer,gen_random_uuid(),null,to_jsonb(p),to_jsonb(a),
 (select count(*) from public.fiscal_sponsorship_events) from public.organization_projects p join public.fiscal_sponsorship_applications a on a.project_id=p.id where p.id=s.project_id;
end $$;
grant select,update on fiscal_link_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true);
do $$ declare f record; begin
 select * into f from fiscal_link_fixture;
 if public.search_fiscal_organization_link(f.project_id,'Applicant') is not null then raise exception 'Unassigned reviewer searched applicants'; end if;
 if public.link_fiscal_organization(f.project_id,f.owner_id,f.request_id,repeat('a',32))->>'state'<>'denied' then raise exception 'Unassigned reviewer linked'; end if;
 if has_table_privilege('authenticated','public.fiscal_application_organization_links','select') then raise exception 'Link table exposed'; end if;
 if has_function_privilege('authenticated','public.attach_fiscal_application_organization(uuid,uuid,uuid,uuid,text,text)','execute') then raise exception 'Internal transition exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
do $$ declare f record; candidate jsonb; result jsonb; begin
 select * into f from fiscal_link_fixture;
 candidate:=public.search_fiscal_organization_link(f.project_id,'Applicant')->'candidates'->0;
 if candidate->>'organizationId'<>f.owner_id::text then raise exception 'Eligible confirmed owner missing'; end if;
 update fiscal_link_fixture set version=candidate->>'version';
 if public.link_fiscal_organization(f.project_id,f.owner_id,f.request_id,repeat('0',32))->>'state'<>'conflict' then raise exception 'Stale source accepted'; end if;
 result:=public.link_fiscal_organization(f.project_id,f.owner_id,f.request_id,candidate->>'version');
 if result->>'state'<>'linked' then raise exception 'Assigned reviewer failed: %',result; end if;
 if public.link_fiscal_organization(f.project_id,f.owner_id,f.request_id,candidate->>'version')<>result then raise exception 'Replay changed result'; end if;
 if public.link_fiscal_organization(f.project_id,f.owner_id,f.request_id,repeat('0',32))->>'state'<>'conflict' then raise exception 'Changed replay accepted'; end if;
 if public.link_fiscal_organization(f.project_id,'10000000-0000-0000-0000-000000000001',gen_random_uuid(),candidate->>'version')->>'state'<>'conflict' then raise exception 'Reparented existing link'; end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
do $$ declare f record; visible jsonb; begin
 select * into f from fiscal_link_fixture;
 visible:=public.list_fiscal_organization_applications(f.owner_id);
 if jsonb_array_length(visible)<>1 or visible->0->>'reference'<>f.reference::text then raise exception 'Owner missing same application'; end if;
 if (select count(*) from jsonb_object_keys(visible->0))<>4 then raise exception 'Projection exposed internal fields'; end if;
 if public.read_linked_fiscal_application(f.reference) is null then raise exception 'Owner cannot open linked status'; end if;
 if public.list_fiscal_organization_applications('10000000-0000-0000-0000-000000000001')<>'[]'::jsonb then raise exception 'Other org discovered data'; end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
do $$ declare f record; begin
 select * into f from fiscal_link_fixture;
 if jsonb_array_length(public.list_fiscal_organization_applications(f.owner_id))<>1 then raise exception 'Accepted editor denied'; end if;
 if public.read_linked_fiscal_application(f.reference) is null then raise exception 'Editor cannot open application'; end if;
 if public.fiscal_profile_owner_linked(f.reference) then raise exception 'Editor can open wrong personal profile'; end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true);
do $$ declare f record; begin
 select * into f from fiscal_link_fixture;
 if public.list_fiscal_organization_applications(f.owner_id)<>'[]'::jsonb or public.read_linked_fiscal_application(f.reference) is not null then raise exception 'Board sees application PII'; end if;
end $$;
reset role;
do $$ declare f record; begin
 select * into f from fiscal_link_fixture;
 if (select count(*) from public.fiscal_application_organization_links where submission_id=f.reference)<>1 then raise exception 'Duplicate association'; end if;
 if (select to_jsonb(p) from public.organization_projects p where id=f.project_id)<>f.project_before
 or (select to_jsonb(a) from public.fiscal_sponsorship_applications a where project_id=f.project_id)<>f.application_before
 or (select count(*) from public.fiscal_sponsorship_events)<>f.event_count then raise exception 'Internal history/project/application changed'; end if;
 if (select profile from public.organizations where user_id=f.owner_id)<>'{"name":"Existing Applicant Org","mission":"Keep existing info"}'::jsonb
 or not (select is_public from public.organizations where user_id=f.owner_id) then raise exception 'Profile overwritten'; end if;
 delete from public.organization_memberships where member_id='81000000-0000-4000-8000-000000000003';
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
 if public.list_fiscal_organization_applications(f.owner_id)<>'[]'::jsonb then raise exception 'Removed editor retained access'; end if;
 update auth.users set email='changed-link-owner@example.test' where id=f.owner_id;
 perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
 if public.list_fiscal_organization_applications(f.owner_id)<>'[]'::jsonb then raise exception 'Changed owner identity retained access'; end if;
 delete from public.fiscal_project_reviewers where project_id=f.project_id and user_id=f.reviewer_id;
 perform set_config('request.jwt.claim.sub',f.reviewer_id::text,true);
 if public.link_fiscal_organization(f.project_id,f.owner_id,f.request_id,f.version)->>'state'<>'denied' then raise exception 'Revoked reviewer replay accepted'; end if;
end $$;
rollback;

-- Self-service keeps selected-only import and creates the same association atomically.
begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; actor uuid:='82000000-0000-4000-8000-000000000001'; preview jsonb; result jsonb; begin
 select * into strict s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email);
 insert into auth.users values(actor,s.contact_email,now());
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('8',64),s.id,now()+interval '1 day');
 preview:=public.preview_fiscal_guest_profile(s.id,repeat('8',64),actor);
 result:=public.save_fiscal_guest_profile(s.id,repeat('8',64),actor,gen_random_uuid(),preview->>'version','{"name":"Saved organization"}');
 if result->>'state'<>'linked' then raise exception 'Self-service link failed: %',result; end if;
 if not exists(select 1 from public.fiscal_application_organization_links where submission_id=s.id and org_id=actor and basis='verified_applicant') then raise exception 'Self-service did not converge'; end if;
 if (select org_id from public.organization_projects where id=s.project_id)=actor then raise exception 'Self-service moved project'; end if;
end $$;
rollback;

-- Invalid owner identity and an existing destination application never import fields.
begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; actor uuid:='83000000-0000-4000-8000-000000000001'; own_project uuid:=gen_random_uuid(); preview jsonb; result jsonb; begin
 select * into strict s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email);
 insert into auth.users values(actor,s.contact_email,null);
 insert into public.organizations(user_id,profile) values(actor,'{"name":"Do not overwrite"}');
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('7',64),s.id,now()+interval '1 day');
 if public.preview_fiscal_guest_profile(s.id,repeat('7',64),actor) is not null then raise exception 'Unverified owner previewed'; end if;
 if public.attach_fiscal_application_organization(s.id,actor,actor,gen_random_uuid(),'staff_confirmed_owner',repeat('a',32))->>'state'<>'denied' then raise exception 'Unverified owner linked'; end if;
 update auth.users set email='different@example.test',email_confirmed_at=now() where id=actor;
 if public.attach_fiscal_application_organization(s.id,actor,actor,gen_random_uuid(),'staff_confirmed_owner',repeat('a',32))->>'state'<>'denied' then raise exception 'Mismatched owner linked'; end if;
 update auth.users set email=s.contact_email where id=actor;
 insert into public.organization_projects(id,org_id,project_kind,name,created_source,created_by)
 values(own_project,actor,'organization_admin','Existing fiscal workflow','system',actor);
 insert into public.fiscal_sponsorship_applications select (jsonb_populate_record(null::public.fiscal_sponsorship_applications,
 to_jsonb(a)||jsonb_build_object('id',gen_random_uuid(),'project_id',own_project,'org_id',actor))).* from public.fiscal_sponsorship_applications a where a.id=s.application_id;
 preview:=public.preview_fiscal_guest_profile(s.id,repeat('7',64),actor);
 result:=public.save_fiscal_guest_profile(s.id,repeat('7',64),actor,gen_random_uuid(),preview->>'version','{"name":"Would overwrite"}');
 if result->>'state'<>'conflict' then raise exception 'Destination conflict accepted: %',result; end if;
 if (select profile->>'name' from public.organizations where user_id=actor)<>'Do not overwrite'
 or exists(select 1 from public.fiscal_application_organization_links where submission_id=s.id)
 or (select claimed_user_id from public.fiscal_guest_submissions where id=s.id) is not null then raise exception 'Partial profile or claim persisted'; end if;
end $$;
rollback;

-- After linkage, native application creation cannot produce a duplicate either.
begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; actor uuid:='84000000-0000-4000-8000-000000000001'; own_project uuid:=gen_random_uuid(); blocked boolean:=false; begin
 select * into strict s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email);
 insert into auth.users values(actor,s.contact_email,now());
 insert into public.organizations(user_id) values(actor);
 perform public.attach_fiscal_application_organization(s.id,actor,actor,gen_random_uuid(),'staff_confirmed_owner',repeat('a',32));
 insert into public.organization_projects(id,org_id,project_kind,name,created_source,created_by)
 values(own_project,actor,'organization_admin','Duplicate attempt','system',actor);
 begin
 insert into public.fiscal_sponsorship_applications select (jsonb_populate_record(null::public.fiscal_sponsorship_applications,
 to_jsonb(a)||jsonb_build_object('id',gen_random_uuid(),'project_id',own_project,'org_id',actor))).* from public.fiscal_sponsorship_applications a where a.id=s.application_id;
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Created second application after linking'; end if;
end $$;
rollback;

-- Legacy own claims skipped by backfill retain their precise profile-open path.
begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; actor uuid:='85000000-0000-4000-8000-000000000001'; begin
 select * into strict s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email);
 insert into auth.users values(actor,s.contact_email,now());
 insert into public.organizations(user_id) values(actor);
 update public.fiscal_guest_submissions set email_verified_at=now(),claimed_user_id=actor,claimed_org_id=actor,claimed_at=now() where id=s.id;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if not public.fiscal_profile_owner_linked(s.id) then raise exception 'Legacy owner lost profile reopen'; end if;
 if public.list_fiscal_organization_applications(actor)<>'[]'::jsonb then raise exception 'Legacy fixture unexpectedly mapped'; end if;
end $$;
rollback;
