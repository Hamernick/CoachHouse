begin;
do $$ begin
 if has_table_privilege('authenticated','public.fiscal_guest_profile_imports','select')
 or has_function_privilege('anon','public.preview_fiscal_guest_profile(uuid,text,uuid)','execute')
 or has_function_privilege('authenticated','public.save_fiscal_guest_profile(uuid,text,uuid,uuid,text,jsonb)','execute') then
 raise exception 'Profile claim privilege exposed'; end if;
end $$;
do $$ declare
 s public.fiscal_guest_submissions%rowtype;
 actor uuid:='70000000-0000-4000-8000-000000000001'; other_actor uuid:='70000000-0000-4000-8000-000000000002';
 request_id uuid:=gen_random_uuid(); preview jsonb; result jsonb; original_org uuid; original_status text;
begin
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email),(other_actor,'not-the-applicant@example.test');
 insert into auth.users values(actor,s.contact_email,null),(other_actor,'not-the-applicant@example.test',now());
 select org_id,status into original_org,original_status from public.fiscal_sponsorship_applications where id=s.application_id;
 if public.preview_fiscal_guest_profile(s.id,repeat('7',64),actor) is not null then raise exception 'Missing proof accepted'; end if;
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('7',64),s.id,now()+interval '1 day');
 if public.preview_fiscal_guest_profile(s.id,repeat('7',64),actor) is not null then raise exception 'Unconfirmed account accepted'; end if;
 update auth.users set email_confirmed_at=now() where id=actor;
 if public.preview_fiscal_guest_profile(s.id,repeat('7',64),other_actor) is not null then raise exception 'Wrong account email accepted'; end if;
 if public.preview_fiscal_guest_profile(s.id,repeat('8',64),actor) is not null then raise exception 'Wrong browser accepted'; end if;
 preview:=public.preview_fiscal_guest_profile(s.id,repeat('7',64),actor);
 if preview->>'state'<>'preview' or (preview->'suggestions') ? 'mailingStreetAddress'
 or (select count(*) from jsonb_object_keys(preview->'suggestions'))<>4 then raise exception 'Unsafe preview'; end if;
 if exists(select 1 from public.organizations where user_id=actor) then raise exception 'Preview mutated profile'; end if;
 begin
  perform public.save_fiscal_guest_profile(s.id,repeat('7',64),actor,request_id,preview->>'version','{"is_public":true}');
  raise exception 'Accepted publication field';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_fiscal_guest_profile(s.id,repeat('7',64),actor,request_id,preview->>'version','{"description":"<script>bad</script>"}');
  raise exception 'Accepted HTML';
 exception when invalid_parameter_value then null; end;
 result:=public.save_fiscal_guest_profile(s.id,repeat('7',64),actor,request_id,preview->>'version','{"name":"Chosen name"}');
 if result->>'state'<>'linked' then raise exception 'Claim failed'; end if;
 if (select profile from public.organizations where user_id=actor)<>'{"name":"Chosen name"}'::jsonb
 or (select is_public from public.organizations where user_id=actor) then raise exception 'Unselected answers copied or profile published'; end if;
 if (select claimed_org_id from public.fiscal_guest_submissions where id=s.id)<>actor then raise exception 'Wrong linked org'; end if;
 if (select org_id from public.organization_projects where id=s.project_id)<>original_org
 or (select status from public.fiscal_sponsorship_applications where id=s.application_id)<>original_status then raise exception 'Claim changed internal review'; end if;
 -- A later edit must survive a lost-ack retry and a fresh claim attempt.
 update public.organizations set profile=profile||'{"name":"Later manual edit"}' where user_id=actor;
 if public.save_fiscal_guest_profile(s.id,repeat('7',64),actor,request_id,preview->>'version','{"name":"Chosen name"}')->>'state'<>'linked' then raise exception 'Retry failed'; end if;
 if public.save_fiscal_guest_profile(s.id,repeat('7',64),actor,gen_random_uuid(),preview->>'version','{"name":"Overwrite"}')->>'state'<>'already_linked' then raise exception 'Claim repeated'; end if;
 if (select profile->>'name' from public.organizations where user_id=actor)<>'Later manual edit' then raise exception 'Replay overwrote manual edit'; end if;
 if public.save_fiscal_guest_profile(s.id,repeat('7',64),other_actor,gen_random_uuid(),preview->>'version','{}') is not null then raise exception 'Double claim accepted'; end if;
 update public.fiscal_guest_verified_sessions set expires_at=now()-interval '1 second' where key_hash=repeat('7',64);
 if public.preview_fiscal_guest_profile(s.id,repeat('7',64),actor) is not null then raise exception 'Expired scope accepted'; end if;
end $$;
rollback;

begin;
create function pg_temp.reject_profile_import() returns trigger language plpgsql as $$ begin raise exception 'fixture write failed'; end $$;
create trigger fail_import before insert on public.fiscal_guest_profile_imports for each row execute function pg_temp.reject_profile_import();
do $$ declare s public.fiscal_guest_submissions%rowtype; actor uuid:='70000000-0000-4000-8000-000000000005'; preview jsonb; begin
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email);
 insert into auth.users values(actor,s.contact_email,now());
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('5',64),s.id,now()+interval '1 day');
 preview:=public.preview_fiscal_guest_profile(s.id,repeat('5',64),actor);
 begin
  perform public.save_fiscal_guest_profile(s.id,repeat('5',64),actor,gen_random_uuid(),preview->>'version','{"name":"Rollback"}');
  raise exception 'Expected failure';
 exception when raise_exception then if sqlerrm<>'fixture write failed' then raise; end if; end;
 if exists(select 1 from public.organizations where user_id=actor)
 or exists(select 1 from public.fiscal_guest_submissions where id=s.id and claimed_at is not null) then raise exception 'Failed import partially persisted'; end if;
end $$;
rollback;

begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; actor uuid:='70000000-0000-4000-8000-000000000003'; preview jsonb; original jsonb; begin
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email);
 insert into auth.users values(actor,s.contact_email,now());
 insert into public.organizations(user_id,profile,is_public) values(actor,'{"name":"Existing","mission":"Preserve me"}',false);
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('9',64),s.id,now()+interval '1 day');
 preview:=public.preview_fiscal_guest_profile(s.id,repeat('9',64),actor);
 update public.organizations set profile=profile||'{"name":"Concurrent edit"}' where user_id=actor;
 if public.save_fiscal_guest_profile(s.id,repeat('9',64),actor,gen_random_uuid(),preview->>'version','{"name":"Stale"}')->>'state'<>'conflict' then raise exception 'Stale profile overwrite accepted'; end if;
 if exists(select 1 from public.fiscal_guest_submissions where id=s.id and claimed_at is not null) then raise exception 'Conflict partially claimed'; end if;
 preview:=public.preview_fiscal_guest_profile(s.id,repeat('9',64),actor);
 perform public.save_fiscal_guest_profile(s.id,repeat('9',64),actor,gen_random_uuid(),preview->>'version','{"phone":"555-0100"}');
 if (select profile from public.organizations where user_id=actor)<>'{"name":"Concurrent edit","mission":"Preserve me","phone":"555-0100"}'::jsonb then raise exception 'Unselected profile fields lost'; end if;
end $$;
rollback;

begin;
do $$ declare s public.fiscal_guest_submissions%rowtype; actor uuid:='70000000-0000-4000-8000-000000000004'; preview jsonb; begin
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 insert into public.profiles values(actor,s.contact_email);
 insert into auth.users values(actor,s.contact_email,now());
 insert into public.organizations(user_id,profile,is_public) values(actor,'{"name":"Published profile"}',true);
 update public.fiscal_guest_submissions set email_verified_at=now() where id=s.id;
 insert into public.fiscal_guest_verified_sessions values(repeat('6',64),s.id,now()+interval '1 day');
 preview:=public.preview_fiscal_guest_profile(s.id,repeat('6',64),actor);
 if public.save_fiscal_guest_profile(s.id,repeat('6',64),actor,gen_random_uuid(),preview->>'version','{"description":"Private application"}')->>'state'<>'public_profile' then raise exception 'Private answers published'; end if;
 if public.save_fiscal_guest_profile(s.id,repeat('6',64),actor,gen_random_uuid(),preview->>'version','{}')->>'state'<>'linked' then raise exception 'Link-only failed'; end if;
 if (select profile from public.organizations where user_id=actor)<>'{"name":"Published profile"}'::jsonb or not (select is_public from public.organizations where user_id=actor) then raise exception 'Changed public profile'; end if;
end $$;
rollback;
