\set ON_ERROR_STOP on
begin;
select public.fixture_closure_storage();
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 if not public.organization_storage_write_admitted(public.fixture_form_id(1)) then raise exception 'Active cleanup denied'; end if;
 update storage.objects set metadata='{"active":true}' where id=public.fixture_form_id(2601);
 if not found then raise exception 'Existing owner storage policy unavailable'; end if;
end $$;
reset role;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare bucket text; begin
 if public.organization_storage_write_admitted(public.fixture_form_id(1)) then raise exception 'Closing cleanup preflight admitted'; end if;
 foreach bucket in array array['org-documents','project-assets','fiscal-signing','org-media','program-media','roadmap-media'] loop
  begin insert into storage.objects(bucket_id,name) values(bucket,public.fixture_form_id(1)::text||'/new-file'); raise exception 'Closing upload admitted: %',bucket;
  exception when insufficient_privilege then null; end;
 end loop;
 begin update storage.objects set metadata='{"changed":true}' where id=public.fixture_form_id(2601); raise exception 'Closing overwrite admitted'; exception when insufficient_privilege then null; end;
 begin delete from storage.objects where id=public.fixture_form_id(2604); raise exception 'Closing legacy host asset deletion admitted'; exception when insufficient_privilege then null; end;
 begin delete from storage.objects where id=public.fixture_form_id(2601); raise exception 'Closing deletion admitted'; exception when insufficient_privilege then null; end;
 begin update storage.objects set bucket_id='avatars',name='shared-path' where id=public.fixture_form_id(2601); raise exception 'Closing move escaped'; exception when insufficient_privilege then null; end;
 begin update storage.objects set name=public.fixture_form_id(1)::text||'/library/moved.txt' where id=public.fixture_form_id(2602); raise exception 'Move entered closing scope'; exception when insufficient_privilege then null; end;
 update storage.objects set metadata='{"independent":true}' where id in(public.fixture_form_id(2602),public.fixture_form_id(2603));
 insert into storage.objects(bucket_id,name) values('avatars','shared-identity'),('accelerator-slide-decks','module/deck.pdf');
 if has_function_privilege('service_role','public.guard_organization_storage_object(text,text)','execute') or has_function_privilege('authenticated','public.guard_organization_storage_mutation()','execute') then raise exception 'Private storage guard exposed'; end if;
end $$;
reset role;
update public.organization_closures set requested_at=now()-interval '721 hours',export_until=now()-interval '1 hour' where org_id=public.fixture_form_id(1);
set local role service_role;
do $$ begin
 begin delete from storage.objects where id=public.fixture_form_id(2601); raise exception 'Expiry granted purge'; exception when insufficient_privilege then null; end;
 if (select count(*) from storage.objects where id=public.fixture_form_id(2601))<>1 then raise exception 'Controlled metadata lost'; end if;
end $$;
reset role;
rollback;
