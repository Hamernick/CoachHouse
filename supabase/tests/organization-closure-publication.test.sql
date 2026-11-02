\set ON_ERROR_STOP on
begin;
select public.fixture_closure_publication();
do $$ declare before_page jsonb; other_page jsonb; external_source jsonb; ids jsonb; deadline text; role_name text; signature text; audience text;
begin
 select to_jsonb(p) into before_page from public.organization_workspace_pages p where id=public.fixture_form_id(10);
 select to_jsonb(p) into other_page from public.organization_workspace_pages p where id=public.fixture_form_id(11);
 select jsonb_agg(to_jsonb(d)) into external_source from public.organization_external_documents d;
 select jsonb_agg(to_jsonb(u)) into ids from auth.users u;
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is null then raise exception 'Active page missing'; end if;
 if public.read_workspace_page_public('other',public.fixture_form_id(10)) is not null then raise exception 'Wrong slug read'; end if;
 foreach audience in array array['public','guest','editor'] loop
   if public.read_workspace_page_image(public.fixture_form_id(60),audience,public.fixture_form_id(1)) is null
     or public.read_workspace_page_document(public.fixture_form_id(61),audience,public.fixture_form_id(1)) is null then raise exception 'Active assets missing'; end if;
 end loop;
 -- Failed transaction must roll back lifecycle and every withdrawal together.
 begin
   perform public.fixture_closure('request',600,0);
   raise exception 'rollback probe' using errcode='P0002';
 exception when no_data_found then null; end;
 if exists(select 1 from public.organization_closures) or
   (select to_jsonb(p) from public.organization_workspace_pages p where id=public.fixture_form_id(10))<>before_page
   or (select count(*) from public.workspace_page_image_grants)<>2 then raise exception 'Partial withdrawal after rollback'; end if;
 deadline:=public.fixture_closure('request',600,0)->>'exportUntil';
 if public.fixture_closure('request',600,0)->>'exportUntil'<>deadline then raise exception 'Retry extended deadline'; end if;
 if (select revision from public.organization_workspace_pages where id=public.fixture_form_id(10))<>2 then raise exception 'Retry repeated page withdrawal'; end if;
 if exists(select 1 from public.organization_workspace_pages where org_id=public.fixture_form_id(1) and (visibility<>'private' or guest_snapshot is not null or last_operation_id is not null))
   or exists(select 1 from public.workspace_page_invitations where page_id=public.fixture_form_id(10) and revoked_at is null)
   or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1))
   or exists(select 1 from public.workspace_page_document_grants where org_id=public.fixture_form_id(1)) then raise exception 'Publication survived closure'; end if;
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null then raise exception 'Closing page leaked'; end if;
 foreach audience in array array['public','guest','editor'] loop
   if public.read_workspace_page_image(public.fixture_form_id(60),audience,public.fixture_form_id(1)) is not null
     or public.read_workspace_page_document(public.fixture_form_id(61),audience,public.fixture_form_id(1)) is not null then raise exception 'Closing asset leaked'; end if;
 end loop;
 begin perform public.fixture_form_publish(0); raise exception 'Publish replay bypassed closure'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_publish(2,'publish',81); raise exception 'Publish bypassed closure'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_form_publish(2,'save_draft',81); raise exception 'Draft write bypassed closure'; exception when insufficient_privilege then null; end;
 begin perform public.workspace_page_guest_command(public.fixture_form_id(6),public.fixture_form_id(10),'{"action":"read"}',null); raise exception 'Guest read bypass'; exception when insufficient_privilege then null; end;
 begin perform public.workspace_page_guest_command(public.fixture_form_id(1),public.fixture_form_id(10),'{"action":"invite"}',repeat('a',64)); raise exception 'Invitation bypass'; exception when insufficient_privilege then null; end;
 if public.fixture_form_command('responses',1)#>>'{responses,0,answers,0,value}'<>'Joan' then raise exception 'Lost authorized export'; end if;
 -- Other organization, shared login, externally owned Google references, stored
 -- private bytes and immutable response versions are not deletion targets.
 if (select to_jsonb(p) from public.organization_workspace_pages p where id=public.fixture_form_id(11))<>other_page
   or public.read_workspace_page_public('other',public.fixture_form_id(11)) is null
   or (select count(*) from public.workspace_page_image_grants)<>1
   or (select count(*) from public.workspace_page_document_grants)<>1
   or (select revoked_at from public.workspace_page_invitations where id=public.fixture_form_id(71)) is not null
   or (select jsonb_agg(to_jsonb(d)) from public.organization_external_documents d)<>external_source
   or (select jsonb_agg(to_jsonb(u)) from auth.users u)<>ids
   or (select count(*) from storage.objects)<>2
   or (select count(*) from public.organization_form_versions)<>1 then raise exception 'Unrelated data changed'; end if;
 perform public.fixture_closure('cancel',601,1);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
   or exists(select 1 from public.workspace_page_invitations where page_id=public.fixture_form_id(10) and revoked_at is null)
   or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel restored publication'; end if;
 begin perform public.fixture_form_publish(0); raise exception 'Old publication replay succeeded'; exception when serialization_failure then null; end;
 -- Explicit newly reviewed publication works only after cancellation.
 perform public.fixture_form_publish(2,'publish',81);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is null then raise exception 'Explicit republish failed'; end if;
 perform public.fixture_closure('request',600,0); -- stale request remains a no-op
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is null then raise exception 'Old close withdrew new publication'; end if;
 update public.organization_workspace_pages set revision=2147483647 where id=public.fixture_form_id(10);
 perform public.fixture_closure('request',602,2);
 if public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null then raise exception 'Saturated revision blocked closure'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
   for signature in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and (p.proname like '%before_closure' or p.proname in ('close_organization_publication','organization_closure_command')) loop
     if has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Private implementation exposed: % %',role_name,signature; end if;
   end loop;
 end loop;
end $$;
rollback;
