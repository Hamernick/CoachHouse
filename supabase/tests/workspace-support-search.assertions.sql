-- Search-only fixture identities, never public production seeds.
insert into auth.users(id,email,raw_user_meta_data) values
 ('87000000-0000-0000-0000-000000000001','search-staff@example.org','{}'),
 ('87000000-0000-0000-0000-000000000002','karen@offshootz.example','{"full_name":"Karen Jones"}'),
 ('87000000-0000-0000-0000-000000000003','jenny@example.org','{}'),
 ('87000000-0000-0000-0000-000000000004','owner@example.org','{}');
insert into public.profiles values('87000000-0000-0000-0000-000000000003','Jenny Jordan');
insert into public.platform_staff_members values('87000000-0000-0000-0000-000000000001','coach');
insert into public.workspace_support_grants(user_id) values('87000000-0000-0000-0000-000000000001');
insert into public.organizations(user_id,profile,public_slug) values
 ('87000000-0000-0000-0000-000000000002','{}',null),
 ('87000000-0000-0000-0000-000000000004','{"name":"CalebsOrganization"}','community-partners');
insert into public.organization_memberships values
 ('87000000-0000-0000-0000-000000000002','87000000-0000-0000-0000-000000000003'),
 ('87000000-0000-0000-0000-000000000004','87000000-0000-0000-0000-000000000003');
insert into auth.users(id,email,raw_user_meta_data)
 select ('88000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'paging-'||n||'@example.org','{}' from generate_series(1,25) n;
insert into public.organizations(user_id,profile)
 select ('88000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('name','Directory Page '||lpad(n::text,3,'0')) from generate_series(1,25) n;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='87000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ declare row record; page_ids uuid[]; second_ids uuid[]; begin
 select * into row from public.search_workspace_support_organizations_v2('KAREN@Offshootz');
 if row.org_id is distinct from '87000000-0000-0000-0000-000000000002'::uuid or row.contact_email<>'karen@offshootz.example' then raise exception 'unnamed email match missing'; end if;
 if (select count(*) from public.search_workspace_support_organizations('karen@offshootz'))<>1 then raise exception 'old caller did not gain email search'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('Jones Karen'))<>1 then raise exception 'multi-term owner name failed'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('off shootz'))<>1 then raise exception 'punctuation normalization failed'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('calebs organization'))<>1 then raise exception 'spaced organization search failed'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('Jenny Jordan'))<>2 then raise exception 'member name search missing workspaces'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('jenny@example.org') where contact_email='jenny@example.org')<>2 then raise exception 'matching member identity missing'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('community partners'))<>1 then raise exception 'slug search failed'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2(''))<>0 then raise exception 'default search exposes global list'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('organization'))<>20 then raise exception 'generic organization browse missing'; end if;
 if (select min(total_count) from public.search_workspace_support_organizations_v2('Directory Page'))<>25 then raise exception 'total count missing'; end if;
 select array_agg(org_id) into page_ids from public.search_workspace_support_organizations_v2('Directory Page',null,0);
 select array_agg(org_id) into second_ids from public.search_workspace_support_organizations_v2('Directory Page',null,20);
 if cardinality(page_ids)<>20 or cardinality(second_ids)<>5 or page_ids&&second_ids then raise exception 'pagination loses/duplicates results'; end if;
 select * into row from public.search_workspace_support_organizations_v2('karen@offshootz.example');
 if row.owner_email<>'karen@offshootz.example' then raise exception 'exact email ranking failed'; end if;
 if (select count(*) from public.search_workspace_support_organizations_v2('', '87000000-0000-0000-0000-000000000002'))<>1 then raise exception 'explicit target lookup failed'; end if;
 begin perform public.search_workspace_support_organizations_v2('organization',null,-1); raise exception 'invalid page accepted'; exception when raise_exception then if sqlerrm='invalid page accepted' then raise; end if; end;
end $$;
reset role;
-- An ordinary member cannot search other people's contact identity.
set request.jwt.claim.sub='87000000-0000-0000-0000-000000000003';
set role authenticated;
do $$ begin
 begin perform public.search_workspace_support_organizations_v2('Karen'); raise exception 'ungranted identity search allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
