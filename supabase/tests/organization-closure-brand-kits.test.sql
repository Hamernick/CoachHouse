\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_brand_kits();
set local role anon;
do $$ begin
 begin perform 1 from public.organization_brand_kits; raise exception 'Anonymous kit exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if (select count(*) from public.organization_brand_kits)<>1 then raise exception 'Owner kit scope changed'; end if;
 begin delete from public.organization_brand_kits; raise exception 'Owner deletion authority broadened'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 update public.organization_brand_kits set identity='{}';
 if found then raise exception 'Read-only member wrote kit'; end if;
 begin perform public.fixture_brand_save(); raise exception 'Read-only member saved profile/kit'; exception when insufficient_privilege then
 if sqlerrm<>'Organization editor required' then raise; end if; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000014';
do $$ begin
 if exists(select 1 from public.organization_brand_kits) then raise exception 'Unrelated identity read kit'; end if;
end $$;
reset role;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ begin
 begin update public.organization_brand_kits set org_id=public.fixture_form_id(3) where org_id=public.fixture_form_id(1);
 raise exception 'Reparent admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Brand kit organization cannot change' then raise; end if; end;
end $$;
savepoint active_save;
set local role authenticated;
do $$ begin
 if not public.fixture_brand_save() then raise exception 'Active save failed'; end if;
 begin perform public.fixture_brand_save(); raise exception 'Stale kit revision accepted'; exception when serialization_failure then
 if sqlerrm<>'This brand kit was updated elsewhere. Reload before saving.' then raise; end if; end;
 begin perform public.save_organization_profile_with_brand_kit(public.fixture_form_id(1),'2000-01-01Z',public.fixture_form_id(1311),'{}','{}');
 raise exception 'Stale profile revision accepted'; exception when serialization_failure then
 if sqlerrm<>'This organization was updated elsewhere. Reload before saving.' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select identity#>>'{draft,name}' from public.organization_brand_kits where org_id=public.fixture_form_id(1))<>'Edited'
 or (select profile->>'name' from public.organizations where user_id=public.fixture_form_id(1))<>'Edited' then raise exception 'Atomic save diverged'; end if;
end $$;
rollback to active_save;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare command text; begin
 foreach command in array array[
 'insert into public.organization_brand_kits select * from public.organization_brand_kits where org_id=public.fixture_form_id(1) on conflict(org_id) do update set identity=excluded.identity',
 'update public.organization_brand_kits set identity=''{}'' where org_id=public.fixture_form_id(1)',
 'delete from public.organization_brand_kits where org_id=public.fixture_form_id(1)',
 'update public.organization_brand_kits set updated_by=null where org_id=public.fixture_form_id(1)'
 ] loop
 begin execute command; raise exception 'Closing kit effect admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform public.fixture_brand_save(); raise exception 'Closing atomic save admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 begin update public.organization_brand_kits set identity='{}' where org_id=public.fixture_form_id(1);
 raise exception 'Closing owner edit admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
-- Nested trigger depth alone is not a cleanup capability; a real absent parent
-- and an otherwise identical row are required.
create function public.fixture_counterfeit_brand_cleanup() returns trigger language plpgsql as $$ begin
 update public.organization_brand_kits set updated_by=null where org_id=public.fixture_form_id(1); return new; end $$;
create temporary table counterfeit_brand_cleanup(n integer);
create trigger counterfeit after insert on counterfeit_brand_cleanup for each row execute function public.fixture_counterfeit_brand_cleanup();
do $$ begin
 begin insert into counterfeit_brand_cleanup values(1); raise exception 'Counterfeit cleanup admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 if (select identity#>>'{draft,name}' from public.organization_brand_kits where org_id=public.fixture_form_id(1))<>'Original'
 or (select profile->>'name' from public.organizations where user_id=public.fixture_form_id(1))='Edited' then raise exception 'Denied save left partial effects'; end if;
 delete from auth.users where id=public.fixture_form_id(13);
 if (select count(*) from public.organization_brand_kits)<>2
 or exists(select 1 from public.organization_brand_kits where updated_by is not null or identity#>>'{draft,name}'<>'Original')
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Account cleanup crossed boundaries'; end if;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if (select count(*) from public.organization_brand_kits)<>1 or not exists(select 1 from auth.users where id=public.fixture_form_id(2)) then raise exception 'Active cascade erased shared identity'; end if;
 perform public.fixture_closure('cancel',601,1);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1))
 or (select identity#>>'{draft,name}' from public.organization_brand_kits where org_id=public.fixture_form_id(1))<>'Original' then raise exception 'Cancel restored publication or changed draft'; end if;
end $$;
set local role authenticated;
select public.fixture_brand_save();
reset role;
select public.fixture_closure('request',602,2);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
do $$ declare role_name text; begin
 begin delete from public.organization_brand_kits where org_id=public.fixture_form_id(1);
 raise exception 'Expiry authorized purge'; exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_brand_kit_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private lifecycle authority exposed'; end if;
 end loop;
 if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.organization_brand_kits'::regclass) then raise exception 'Kit RLS removed'; end if;
end $$;
rollback;
