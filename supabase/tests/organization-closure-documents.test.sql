\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_documents();
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';
do $$ begin
 if (select count(*) from public.organization_document_files)<>1
 or (select count(*) from public.document_collaboration_rooms)<>1
 or (select count(*) from public.document_collaboration_updates)<>1
 or (select count(*) from public.document_file_versions)<>1 then raise exception 'Member document visibility changed'; end if;
 update public.organization_document_files set name='Unauthorized.md';
 if found then raise exception 'Read-only member wrote file'; end if;
 begin perform public.fixture_document_append(); raise exception 'Board appended';
 exception when insufficient_privilege then null; end;
 begin perform * from public.document_version_operations; raise exception 'Private reservations exposed';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';
do $$ begin
 if exists(select 1 from public.organization_document_files)
 or exists(select 1 from public.document_collaboration_rooms)
 or exists(select 1 from public.document_collaboration_updates)
 or exists(select 1 from public.document_file_versions) then raise exception 'Outsider read documents'; end if;
end $$;
reset role;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
-- Identity changes cannot move a write to a different admission domain.
do $$ declare target text; key text; begin
 foreach target in array array['organization_document_files','document_collaboration_rooms','document_file_versions','document_version_operations'] loop
 begin execute format('update public.%I set org_id=public.fixture_form_id(2) where org_id=public.fixture_form_id(1)',target);
 raise exception 'Reparent admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Document identity cannot change' then raise; end if; end;
 end loop;
 foreach key in array array['room_id','sequence','batch_id'] loop
 begin
 if key='sequence' then update public.document_collaboration_updates set sequence=7 where room_id=public.fixture_form_id(1011);
 else execute format('update public.document_collaboration_updates set %I=public.fixture_form_id(999) where room_id=public.fixture_form_id(1011)',key); end if;
 raise exception 'Tail identity changed'; exception when insufficient_privilege then
 if sqlerrm<>'Document identity cannot change' then raise; end if; end;
 end loop;
end $$;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ declare target text; scope text; command text; begin
 foreach target in array array['organization_document_files','document_collaboration_rooms','document_file_versions','document_version_operations','document_collaboration_updates'] loop
 scope:=case when target='document_collaboration_updates' then 'room_id=public.fixture_form_id(1011)' else 'org_id=public.fixture_form_id(1)' end;
 foreach command in array array[
 format('insert into public.%1$I select * from public.%1$I where %2$s on conflict do nothing',target,scope),
 format('update public.%I set %I=%I where %s',target,case when target='document_collaboration_updates' then 'room_id' else 'org_id' end,case when target='document_collaboration_updates' then 'room_id' else 'org_id' end,scope),
 format('delete from public.%I where %s',target,scope)
 ] loop
 begin execute command; raise exception 'Closing document write admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop; end loop;
 foreach command in array array[
 'select public.fixture_document_reserve()', -- exact staged replay is admission too
 'select public.fixture_document_reserve(1052)',
 'select public.fixture_document_commit()',
 'select public.fixture_document_compact()',
 'update public.document_version_operations set state=''abandoned'',fingerprint=''forged'' where org_id=public.fixture_form_id(1)'
 ] loop
 begin execute command; raise exception 'Closing RPC or forged cleanup admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 end loop;
 -- Another organization's existing canonical records remain writable.
 update public.organization_document_files set name='Other.md' where org_id=public.fixture_form_id(2);
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform public.fixture_document_append(); raise exception 'Closing authenticated append admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.document_file_versions)<>1
 or (select storage_path from public.organization_document_files where id=public.fixture_form_id(1001))<>public.fixture_form_id(1)::text||'/library/source.md'
 or (select last_sequence from public.document_collaboration_rooms where id=public.fixture_form_id(1011))<>1
 or (select state from public.document_version_operations where file_id=public.fixture_form_id(1001))<>'staged' then raise exception 'Denied effects partially committed'; end if;
 -- Version retention still restricts deletion of a referenced file/account.
 begin delete from auth.users where id=public.fixture_form_id(1); raise exception 'Owner identity deleted'; exception when foreign_key_violation then null; end;
 delete from public.organizations where user_id=public.fixture_form_id(2);
 if not exists(select 1 from auth.users where id=public.fixture_form_id(2))
 or (select count(*) from public.document_collaboration_rooms)<>1
 or (select count(*) from public.document_collaboration_updates)<>1 then raise exception 'Active cascade changed another identity/document'; end if;
end $$;
set local role service_role;
do $$ begin
 if public.abandon_uploaded_document_version(public.fixture_form_id(1001),public.fixture_form_id(2),public.fixture_form_id(1051)) then raise exception 'Wrong actor canceled stage'; end if;
 if not public.abandon_uploaded_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(1051))
 or not public.abandon_uploaded_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(1051))
 or not public.finish_abandoned_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(1051)) then raise exception 'Staging cancellation failed'; end if;
 begin update public.document_version_operations set state='staged' where file_id=public.fixture_form_id(1001);
 raise exception 'Closure resurrected canceled stage'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
select public.fixture_closure('cancel',601,1);
-- Cleanup-state advancement does not claim Storage deletion: staged objects remain.
do $$ begin
 if (select state from public.document_version_operations where file_id=public.fixture_form_id(1001))<>'cleaned'
 or (select staged_bytes from public.document_version_operations where file_id=public.fixture_form_id(1001))<>0
 or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored revoked effects'; end if;
end $$;
-- Explicit new save after cancel; actual immutable-path metadata check, not bytes.
insert into storage.objects(bucket_id,name,metadata)
select bucket_id,replace(name,public.fixture_form_id(1051)::text,public.fixture_form_id(1052)::text),metadata
from storage.objects where bucket_id='org-documents';
set local role service_role;
select public.fixture_document_reserve(1052);
select public.fixture_document_commit(1052);
select public.fixture_document_commit(1052);
do $$ begin
 if public.abandon_uploaded_document_version(public.fixture_form_id(1001),public.fixture_form_id(1),public.fixture_form_id(1052)) then raise exception 'Committed save canceled'; end if;
end $$;
reset role;
do $$ declare role_name text; begin
 if (select count(*) from public.document_file_versions)<>3
 or (select canonical_sequence from public.document_collaboration_rooms where id=public.fixture_form_id(1011))<>1
 or (select state from public.document_version_operations where request_id=public.fixture_form_id(1052))<>'committed' then raise exception 'Save/replay readback failed'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_uploaded_document_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.guard_uploaded_document_organization(uuid)','EXECUTE')
 or has_function_privilege(role_name,'public.reserve_uploaded_document_version_pre_closure(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid)','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Private authority exposed'; end if;
 end loop;
 if has_function_privilege('authenticated','public.reserve_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid)','EXECUTE') then raise exception 'Reservation exposed'; end if;
end $$;
-- Restore crosses history, file, room generation and tail deletion atomically.
insert into storage.objects(bucket_id,name,metadata) values('org-documents',
 public.fixture_form_id(1)::text||'/library/versions/'||public.fixture_form_id(1001)::text||'/'||public.fixture_form_id(1053)::text||'.md','{"size":3}');
set local role service_role;
select public.fixture_document_restore('reserve');
reset role;
select public.fixture_closure('request',602,2);
set local role service_role;
do $$ begin
 begin perform public.fixture_document_restore('commit'); raise exception 'Closing restore admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.document_file_versions)<>3
 or (select generation from public.document_collaboration_rooms where id=public.fixture_form_id(1011))<>public.fixture_form_id(1021)
 or not exists(select 1 from public.document_collaboration_updates where room_id=public.fixture_form_id(1011)) then raise exception 'Denied restore left effects'; end if;
end $$;
select public.fixture_closure('cancel',603,3);
set local role service_role;
select public.fixture_document_restore('commit');
reset role;
do $$ begin
 if (select count(*) from public.document_file_versions)<>4
 or not exists(select 1 from public.document_file_versions where request_id=public.fixture_form_id(1053) and restored_from=public.fixture_form_id(1041))
 or (select generation from public.document_collaboration_rooms where id=public.fixture_form_id(1011))=public.fixture_form_id(1021)
 or exists(select 1 from public.document_collaboration_updates where room_id=public.fixture_form_id(1011)) then raise exception 'Restore readback failed'; end if;
end $$;
select public.fixture_closure('request',604,4);
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
set local role service_role;
do $$ begin
 begin delete from public.document_file_versions where org_id=public.fixture_form_id(1);
 raise exception 'Expiry authorized history purge'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
end $$;
reset role;
rollback;
