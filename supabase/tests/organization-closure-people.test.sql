\set ON_ERROR_STOP on
begin;
select public.fixture_closure_people();
-- Exercise the original production RLS, including a board member denied edits.
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ declare changed integer; begin
 update public.organization_people_tags set label='Denied' where id=public.fixture_form_id(810);
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Board member gained write access'; end if;
 begin insert into public.organization_people_segment_members(segment_id,person_id) values(public.fixture_form_id(820),'board-write');
   raise exception 'Board member inserted'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.organization_people_tags set label='Owner save' where id=public.fixture_form_id(810);
insert into public.organization_people_segment_members(segment_id,person_id) values(public.fixture_form_id(820),'owner-save');
reset role;
-- Immutable parent ownership/keys make membership organization resolution safe
-- without taking a parent lock in reverse order. Prove this while still active.
do $$ declare kind text; target integer; command text; begin
 foreach kind in array array['tag','segment'] loop
   target:=case when kind='tag' then 810 else 820 end;
   foreach command in array array[
     format('update public.organization_people_%ss set org_id=public.fixture_form_id(2) where id=public.fixture_form_id(%s)',kind,target),
     format('update public.organization_people_%ss set id=public.fixture_form_id(830) where id=public.fixture_form_id(%s)',kind,target),
     format('update public.organization_people_%s_members set %I=public.fixture_form_id(%s) where %I=public.fixture_form_id(%s)',kind,kind||'_id',target+1,kind||'_id',target)
   ] loop
     begin execute command; raise exception 'Active taxonomy identity moved';
     exception when insufficient_privilege then
       if sqlerrm<>'People taxonomy identity cannot change' then raise; end if;
     end;
   end loop;
 end loop;
end $$;
select public.fixture_closure('request',600,0);
-- All four table paths, including service-role UPDATE/reparent/UPSERT attempts.
set local role service_role;
do $$ declare kind text; target integer; parent_table text; member_table text; foreign_key text; command text;
begin
 foreach kind in array array['tag','segment'] loop
   target:=case when kind='tag' then 810 else 820 end;
   parent_table:='public.organization_people_'||kind||'s';
   member_table:='public.organization_people_'||kind||'_members'; foreign_key:=kind||'_id';
   foreach command in array array[
     format('insert into %s(id,org_id,label) values(public.fixture_form_id(830),public.fixture_form_id(1),''Late'')',parent_table),
     format('update %s set label=''Late'' where id=public.fixture_form_id(%s)',parent_table,target),
     format('delete from %s where id=public.fixture_form_id(%s)',parent_table,target),
     format('update %s set org_id=public.fixture_form_id(2) where id=public.fixture_form_id(%s)',parent_table,target),
     format('update %s set created_by=null where id=public.fixture_form_id(%s)',parent_table,target),
     format('insert into %s(%I,person_id) values(public.fixture_form_id(%s),''late'')',member_table,foreign_key,target),
     format('insert into %s(%I,person_id) values(public.fixture_form_id(%s),''person-a'') on conflict(%I,person_id) do update set added_by=null',member_table,foreign_key,target,foreign_key),
     format('delete from %s where %I=public.fixture_form_id(%s)',member_table,foreign_key,target),
     format('update %s set added_by=null where %I=public.fixture_form_id(%s)',member_table,foreign_key,target),
     format('update %s set %I=public.fixture_form_id(%s) where %I=public.fixture_form_id(%s)',member_table,foreign_key,target+1,foreign_key,target)
   ] loop
     begin execute command; raise exception 'Closing taxonomy mutation bypass: %',command;
     exception when insufficient_privilege then null; end;
   end loop;
   -- Same actor can still edit another organization; no global closure lock.
   execute format('update %s set label=''Other saved'' where id=public.fixture_form_id(%s)',parent_table,target+1);
 end loop;
end $$;
reset role;
do $$ declare role_name text; begin
 if (select label from public.organization_people_tags where id=public.fixture_form_id(810))<>'Owner save'
   or (select count(*) from public.organization_people_tag_members)<>1
   or (select count(*) from public.organization_people_segment_members)<>2 then raise exception 'Denied operation changed taxonomy'; end if;
 -- Actual auth -> profile deletion cascades clear only actor attribution while
 -- preserving all organizations, people references and shared-owner identities.
 delete from auth.users where id=public.fixture_form_id(12);
 if exists(select 1 from public.profiles where id=public.fixture_form_id(12))
   or exists(select 1 from public.organization_people_tags where created_by is not null)
   or exists(select 1 from public.organization_people_segments where created_by is not null)
   or exists(select 1 from public.organization_people_tag_members where added_by is not null)
   or exists(select 1 from public.organization_people_segment_members where added_by is not null)
   or (select count(*) from public.organizations)<>2
   or not exists(select 1 from auth.users where id=public.fixture_form_id(1)) then raise exception 'Separate account cleanup lost data or failed'; end if;
 perform public.fixture_closure('cancel',601,1);
 delete from public.organization_people_tags where id=public.fixture_form_id(810);
 delete from public.organization_people_segments where id=public.fixture_form_id(820);
 if exists(select 1 from public.organization_people_tag_members) or exists(select 1 from public.organization_people_segment_members) then raise exception 'Admitted parent cascade failed'; end if;
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null then raise exception 'Cancel republished'; end if;
 -- Existing active parent-org cascade remains possible; closing deletion is
 -- independently prohibited by the canonical organization-row fence.
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if exists(select 1 from public.organization_people_tags) or exists(select 1 from public.organization_people_segments) then raise exception 'Active organization cascade failed'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(role_name,'public.guard_organization_people_closure()','EXECUTE')
     or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private function exposed'; end if;
 end loop;
end $$;
rollback;
