-- Exact independent publication/copy consent withdrawal. No activation or reopening.
begin;
do $$ begin
 if to_regprocedure('public.assert_organization_suppression_capacity()') is null
  or to_regprocedure('public.read_organization_suppression_events_before_capacity()') is null then
  raise exception 'Suppression capacity migration required'; end if;
end $$;
lock table public.organization_workspace_pages,public.workspace_page_image_grants,
 public.workspace_page_document_grants,public.organization_suppression_capture_state,
 public.organization_suppression_events in access exclusive mode;
alter table public.organization_suppression_capture_state add column page_access_generation_id uuid not null default gen_random_uuid();
alter table public.organization_workspace_pages
 add column public_grant_id uuid,add column public_granted_at timestamptz,
 add column guest_grant_id uuid,add column guest_granted_at timestamptz;
update public.organization_workspace_pages set
 public_grant_id=case when visibility='public' then gen_random_uuid() end,
 public_granted_at=case when visibility='public' then clock_timestamp() end,
 guest_grant_id=case when guest_snapshot is not null then gen_random_uuid() end,
 guest_granted_at=case when guest_snapshot is not null then clock_timestamp() end;
alter table public.organization_workspace_pages add constraint workspace_publication_generation_pairs check(
 (visibility='public')=(public_grant_id is not null) and (public_grant_id is null)=(public_granted_at is null)
 and (guest_snapshot is not null)=(guest_grant_id is not null) and (guest_grant_id is null)=(guest_granted_at is null));
alter table public.organization_suppression_events add column page_access jsonb;
-- Preserve the existing strictly disjoint payload constraints, extending only one branch.
do $migration$ declare old_shape text; begin
 select pg_get_constraintdef(oid) into strict old_shape from pg_constraint
 where conrelid='public.organization_suppression_events'::regclass and conname='organization_suppression_events_check';
 alter table public.organization_suppression_events drop constraint organization_suppression_events_kind_check;
 alter table public.organization_suppression_events add constraint organization_suppression_events_kind_check
 check(kind in ('closure_request','closure_cancel','response_deleted','form_invitation_revoked','form_reviewer_revoked','form_primary_manager_revoked','workspace_page_invitation_revoked','workspace_page_note_scope_revoked','workspace_page_access_revoked'));
 alter table public.organization_suppression_events drop constraint organization_suppression_events_check;
 execute 'alter table public.organization_suppression_events add constraint organization_suppression_events_check CHECK ((page_access is null and '||substring(old_shape from 7)||') or (kind=''workspace_page_access_revoked'' and page_access is not null))';
end $migration$;
alter table public.organization_suppression_events add constraint organization_suppression_page_access_shape check(
 kind<>'workspace_page_access_revoked' or (
 request_id is null and requested_at is null and export_until is null and form_id is null and version_id is null and response_id is null and submitted_at is null
 and invitation_id is null and invitation_parent_id is null and invitation_permission is null and invitation_created_at is null
 and reviewer_generation_id is null and reviewer_grant_id is null and reviewer_permission is null and reviewer_created_at is null
 and primary_manager_generation_id is null and primary_grant_id is null and primary_granted_at is null
 and workspace_page_id is null and page_invitation_id is null and page_invitation_parent_id is null and page_invitation_permission is null and page_invitation_created_at is null
 and note_scope_generation_id is null and note_scope_grant_id is null and note_scope_page_id is null and note_scope_particle_id is null and note_scope_canvas_id is null and note_scope_source_created_at is null and note_scope_granted_at is null));
create unique index workspace_page_public_grant_identity on public.organization_workspace_pages(public_grant_id) where public_grant_id is not null;
create unique index workspace_page_guest_grant_identity on public.organization_workspace_pages(guest_grant_id) where guest_grant_id is not null;
create unique index organization_suppression_page_access_identity on public.organization_suppression_events((page_access->>'domain'),operation_id) where kind='workspace_page_access_revoked';

alter function public.organization_suppression_event_json(public.organization_suppression_events) rename to organization_suppression_event_json_before_page_access;
create function public.organization_suppression_event_json(e public.organization_suppression_events) returns jsonb
 language sql immutable set search_path='' set timezone='UTC' as $$
 select public.organization_suppression_event_json_before_page_access(e)||
 case when e.kind='workspace_page_access_revoked' then jsonb_build_object('pageAccess',e.page_access) else '{}'::jsonb end;
$$;
revoke all on function public.organization_suppression_event_json(public.organization_suppression_events),public.organization_suppression_event_json_before_page_access(public.organization_suppression_events) from public,anon,authenticated,service_role;

create function public.validate_workspace_page_access_event(e jsonb) returns void
 language plpgsql security definer set search_path='' as $$
declare a jsonb:=e->'pageAccess'; allocated timestamptz; happened timestamptz;
begin
 if e-'sequence'-'eventId'-'kind'-'organizationId'-'operationId'-'revision'-'occurredAt'-'pageAccess'<>'{}'::jsonb
  or jsonb_typeof(a) is distinct from 'object'
  or a-array['domain','pageId','grantId','generationId','createdAt']<>'{}'::jsonb
  or a->>'domain' is null or a->>'domain' not in ('public','guest','image','document')
  or jsonb_typeof(a->'pageId') is distinct from 'string'
  or jsonb_typeof(a->'generationId') is distinct from 'string'
  or jsonb_typeof(a->'grantId') is distinct from 'string'
  or a->>'grantId' is distinct from e->>'operationId'
  or jsonb_typeof(a->'createdAt') is distinct from 'string'
  or (a->>'createdAt')!~'(Z|[+-]00:00)$'
  or (a->>'domain' in ('public','guest') and e->'revision'<>'1'::jsonb) then
  raise exception 'Invalid page access suppression event' using errcode='22023'; end if;
 perform (a->>'pageId')::uuid;perform (a->>'grantId')::uuid;
 allocated:=(a->>'createdAt')::timestamptz;happened:=(e->>'occurredAt')::timestamptz;
 if not isfinite(allocated) or allocated>happened then
  raise exception 'Invalid page access suppression time' using errcode='22023'; end if;
 if not exists(select 1 from public.organization_suppression_capture_state where singleton and page_access_generation_id=(a->>'generationId')::uuid) then
  raise exception 'Page access generation lineage conflicts' using errcode='40001'; end if;
 if exists(select 1 from public.organization_workspace_pages where id=(a->>'pageId')::uuid and org_id<>(e->>'organizationId')::uuid) then
  raise exception 'Page access source identity conflicts' using errcode='40001'; end if;
end $$;
revoke all on function public.validate_workspace_page_access_event(jsonb) from public,anon,authenticated,service_role;

create function public.record_workspace_page_access_suppression(p_org uuid,p_page uuid,p_domain text,p_grant uuid,p_created timestamptz,p_revision integer)
 returns void language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare c public.organization_suppression_capture_state%rowtype; expected jsonb; emitted public.organization_suppression_events%rowtype;
 stamp timestamptz:=clock_timestamp(); event_uuid uuid:=gen_random_uuid(); payload jsonb;
begin
 select expected_event into expected from public.organization_suppression_replay_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
 if found then
  if not exists(select 1 from pg_roles where rolname=session_user and rolsuper)
   or current_setting('session_replication_role')<>'origin'
   or exists(select 1 from pg_database where datname=current_database() and datallowconn) then
   raise exception 'Offline suppression replay context required' using errcode='42501'; end if;
  stamp:=(expected->>'occurredAt')::timestamptz;event_uuid:=(expected->>'eventId')::uuid;
 end if;
 begin select * into strict c from public.organization_suppression_capture_state where singleton for update nowait;
 exception when lock_not_available then raise exception 'Suppression capture busy; retry transaction' using errcode='40001'; end;
 if not exists(select 1 from public.organization_restore_identity where singleton and source_id=c.source_id) then
  raise exception 'Suppression source identity changed' using errcode='40001'; end if;
 payload:=jsonb_build_object('domain',p_domain,'pageId',p_page,'grantId',p_grant,'generationId',c.page_access_generation_id,'createdAt',p_created);
 update public.organization_suppression_capture_state set high_water=high_water+1 where singleton returning high_water into c.high_water;
 insert into public.organization_suppression_events(sequence,event_id,kind,organization_id,operation_id,revision,occurred_at,page_access)
 values(c.high_water,event_uuid,'workspace_page_access_revoked',p_org,p_grant,p_revision,stamp,payload) returning * into emitted;
 perform public.validate_workspace_page_access_event(public.organization_suppression_event_json(emitted));
 if expected is not null and public.organization_suppression_event_json(emitted)<>expected then
  raise exception 'Replayed page access differs from retained evidence' using errcode='40001'; end if;
end $$;
revoke all on function public.record_workspace_page_access_suppression(uuid,uuid,text,uuid,timestamptz,integer) from public,anon,authenticated,service_role;

create function public.guard_workspace_publication_generation() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 begin perform 1 from public.organization_suppression_capture_state where singleton for share nowait;
  if not found then raise exception 'Suppression capture unavailable' using errcode='40001'; end if;
 exception when lock_not_available then raise exception 'Suppression capture busy; retry transaction' using errcode='40001'; end;
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or new.org_id is distinct from old.org_id
   or new.public_grant_id is distinct from old.public_grant_id or new.public_granted_at is distinct from old.public_granted_at
   or new.guest_grant_id is distinct from old.guest_grant_id or new.guest_granted_at is distinct from old.guest_granted_at then
   raise exception 'Publication identity cannot change' using errcode='42501'; end if;
  if new.visibility='public' and (old.visibility<>'public' or new.published_snapshot is distinct from old.published_snapshot or new.link_id is distinct from old.link_id) then
   new.public_grant_id:=gen_random_uuid();new.public_granted_at:=clock_timestamp(); end if;
  if new.guest_snapshot is not null and (old.guest_snapshot is null or new.guest_snapshot is distinct from old.guest_snapshot or new.link_id is distinct from old.link_id) then
   new.guest_grant_id:=gen_random_uuid();new.guest_granted_at:=clock_timestamp(); end if;
 else
  -- New rows cannot choose/recycle an old publication authority.
  new.public_grant_id:=case when new.visibility='public' then gen_random_uuid() end;
  new.public_granted_at:=case when new.visibility='public' then clock_timestamp() end;
  new.guest_grant_id:=case when new.guest_snapshot is not null then gen_random_uuid() end;
  new.guest_granted_at:=case when new.guest_snapshot is not null then clock_timestamp() end;
 end if;
 if new.visibility<>'public' then new.public_grant_id:=null;new.public_granted_at:=null; end if;
 if new.guest_snapshot is null then new.guest_grant_id:=null;new.guest_granted_at:=null; end if;
 if exists(select 1 from public.organization_suppression_events where kind='workspace_page_access_revoked'
  and ((page_access->>'domain'='public' and operation_id=new.public_grant_id) or (page_access->>'domain'='guest' and operation_id=new.guest_grant_id))) then
  raise exception 'Publication generation is suppressed' using errcode='42501'; end if;
 return new;
end $$;
create trigger workspace_publication_generation_guard before insert or update on public.organization_workspace_pages for each row execute function public.guard_workspace_publication_generation();

create function public.capture_workspace_publication_suppression() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if old.public_grant_id is not null and (tg_op='DELETE' or new.public_grant_id is distinct from old.public_grant_id) then
  perform public.record_workspace_page_access_suppression(old.org_id,old.id,'public',old.public_grant_id,old.public_granted_at,1); end if;
 if old.guest_grant_id is not null and (tg_op='DELETE' or new.guest_grant_id is distinct from old.guest_grant_id) then
  perform public.record_workspace_page_access_suppression(old.org_id,old.id,'guest',old.guest_grant_id,old.guest_granted_at,1); end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger workspace_publication_suppression_capture after update or delete on public.organization_workspace_pages for each row execute function public.capture_workspace_publication_suppression();

create function public.guard_workspace_asset_generation() returns trigger
 language plpgsql security definer set search_path='' as $$
declare domain text:=case when tg_table_name='workspace_page_image_grants' then 'image' else 'document' end;
begin
 begin perform 1 from public.organization_suppression_capture_state where singleton for share nowait;
  if not found then raise exception 'Suppression capture unavailable' using errcode='40001'; end if;
 exception when lock_not_available then raise exception 'Suppression capture busy; retry transaction' using errcode='40001'; end;
 if tg_op='UPDATE' and to_jsonb(new) is distinct from to_jsonb(old) then
  raise exception 'Reviewed asset grant is immutable; issue a new grant' using errcode='42501'; end if;
 if not isfinite(new.created_at) or new.created_at>clock_timestamp() then
  raise exception 'Invalid asset grant time' using errcode='22023'; end if;
 if exists(select 1 from public.organization_suppression_events where kind='workspace_page_access_revoked' and page_access->>'domain'=domain and operation_id=new.id) then
  raise exception 'Asset grant is suppressed' using errcode='42501'; end if;
 return new;
end $$;
create function public.capture_workspace_asset_suppression() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 perform public.record_workspace_page_access_suppression(old.org_id,old.page_id,
  case when tg_table_name='workspace_page_image_grants' then 'image' else 'document' end,old.id,old.created_at,old.revision);
 return old;
end $$;
create trigger workspace_image_generation_guard before insert or update on public.workspace_page_image_grants for each row execute function public.guard_workspace_asset_generation();
create trigger workspace_document_generation_guard before insert or update on public.workspace_page_document_grants for each row execute function public.guard_workspace_asset_generation();
create trigger workspace_image_suppression_capture after delete on public.workspace_page_image_grants for each row execute function public.capture_workspace_asset_suppression();
create trigger workspace_document_suppression_capture after delete on public.workspace_page_document_grants for each row execute function public.capture_workspace_asset_suppression();
revoke all on function public.guard_workspace_publication_generation(),public.capture_workspace_publication_suppression(),public.guard_workspace_asset_generation(),public.capture_workspace_asset_suppression() from public,anon,authenticated,service_role;

create function public.apply_workspace_page_access_suppression(e jsonb) returns void
 language plpgsql security definer set search_path='' as $$
declare a jsonb:=e->'pageAccess'; target_page public.organization_workspace_pages%rowtype; asset jsonb; domain text:=a->>'domain';
 org uuid:=(e->>'organizationId')::uuid; grant_id uuid:=(e->>'operationId')::uuid; allocated timestamptz:=(a->>'createdAt')::timestamptz;
 affected integer:=0;
begin
 -- Only the already-validated, quarantined replay context can invoke this helper.
 if not exists(select 1 from public.organization_suppression_replay_context where backend_pid=pg_backend_pid() and transaction_id=txid_current() and expected_event=e)
  or not exists(select 1 from pg_roles where rolname=session_user and rolsuper)
  or exists(select 1 from pg_database where datname=current_database() and datallowconn) then
  raise exception 'Offline suppression replay context required' using errcode='42501'; end if;
 if domain in ('public','guest') then
  select * into target_page from public.organization_workspace_pages where
   (domain='public' and public_grant_id=grant_id) or (domain='guest' and guest_grant_id=grant_id);
  if found then
   if target_page.id<>(a->>'pageId')::uuid or target_page.org_id<>org
    or (domain='public' and target_page.public_granted_at is distinct from allocated)
    or (domain='guest' and target_page.guest_granted_at is distinct from allocated) then
    raise exception 'Restored publication identity conflicts' using errcode='40001'; end if;
   if domain='public' then update public.organization_workspace_pages set visibility='private' where id=target_page.id;
   else update public.organization_workspace_pages set guest_snapshot=null where id=target_page.id; end if;
   affected:=1;
  end if;
 else
  if domain='image' then select to_jsonb(g) into asset from public.workspace_page_image_grants g where id=grant_id;
  else select to_jsonb(g) into asset from public.workspace_page_document_grants g where id=grant_id; end if;
  if asset is not null then
   if (asset->>'org_id')::uuid<>org or (asset->>'page_id')::uuid<>(a->>'pageId')::uuid
    or (asset->>'revision')::integer<>(e->>'revision')::integer or (asset->>'created_at')::timestamptz is distinct from allocated then
    raise exception 'Restored asset identity conflicts' using errcode='40001'; end if;
   if domain='image' then delete from public.workspace_page_image_grants where id=grant_id;
   else delete from public.workspace_page_document_grants where id=grant_id; end if;
   affected:=1;
  end if;
 end if;
 if affected=0 then perform public.record_workspace_page_access_suppression(org,(a->>'pageId')::uuid,domain,grant_id,allocated,(e->>'revision')::integer); end if;
end $$;
create function public.assert_workspace_page_access_suppressed(e jsonb) returns void
 language plpgsql security definer set search_path='' as $$
declare domain text:=e#>>'{pageAccess,domain}'; grant_id uuid:=(e->>'operationId')::uuid;
begin
 if (domain='public' and exists(select 1 from public.organization_workspace_pages where public_grant_id=grant_id))
  or (domain='guest' and exists(select 1 from public.organization_workspace_pages where guest_grant_id=grant_id))
  or (domain='image' and exists(select 1 from public.workspace_page_image_grants where id=grant_id))
  or (domain='document' and exists(select 1 from public.workspace_page_document_grants where id=grant_id)) then
  raise exception 'Restored page access suppression does not match history' using errcode='40001'; end if;
end $$;
revoke all on function public.apply_workspace_page_access_suppression(jsonb),public.assert_workspace_page_access_suppressed(jsonb) from public,anon,authenticated,service_role;

-- Keep the capacity wrapper intact. Add exact hook/lineage checks outside it.
alter function public.read_organization_suppression_events() rename to read_organization_suppression_events_before_page_access;
create function public.read_organization_suppression_events() returns jsonb
 language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare result jsonb; entry jsonb;
begin
 if exists(select 1 from (values
  ('organization_workspace_pages','workspace_publication_generation_guard','public.guard_workspace_publication_generation()'::regprocedure,23),
  ('organization_workspace_pages','workspace_publication_suppression_capture','public.capture_workspace_publication_suppression()'::regprocedure,25),
  ('workspace_page_image_grants','workspace_image_generation_guard','public.guard_workspace_asset_generation()'::regprocedure,23),
  ('workspace_page_document_grants','workspace_document_generation_guard','public.guard_workspace_asset_generation()'::regprocedure,23),
  ('workspace_page_image_grants','workspace_image_suppression_capture','public.capture_workspace_asset_suppression()'::regprocedure,9),
  ('workspace_page_document_grants','workspace_document_suppression_capture','public.capture_workspace_asset_suppression()'::regprocedure,9)
 ) required(relation,name,procedure,mask) where not exists(select 1 from pg_trigger t
  where t.tgrelid=to_regclass('public.'||required.relation) and t.tgname=required.name and t.tgfoid=required.procedure
  and t.tgtype::integer=required.mask and t.tgenabled in ('O','A') and not t.tgisinternal and t.tgqual is null and t.tgnargs=0 and cardinality(t.tgattr::smallint[])=0)) then
  raise exception 'Page access suppression hooks unavailable' using errcode='42501'; end if;
 result:=public.read_organization_suppression_events_before_page_access();
 for entry in select value from jsonb_array_elements(result->'events') where value->>'kind'='workspace_page_access_revoked' loop
  perform public.validate_workspace_page_access_event(entry);
 end loop;
 return result;
end $$;
revoke all on function public.read_organization_suppression_events(),public.read_organization_suppression_events_before_page_access() from public,anon,authenticated,service_role;

-- Extend the established strict replay, refusing an unexpected predecessor.
-- Existing old-domain validation, application, outcomes and capacity stay intact.
do $migration$ declare definition text; before_text text; after_text text; begin
 definition:=pg_get_functiondef('public.replay_organization_suppression_history(text,text)'::regprocedure);
 before_text:=$before0$'workspace_page_invitation_revoked','workspace_page_note_scope_revoked') then$before0$;after_text:=$after0$'workspace_page_invitation_revoked','workspace_page_note_scope_revoked','workspace_page_access_revoked') then$after0$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
  raise exception 'Unexpected suppression replay predecessor anchor 0'; end if;
 definition:=replace(definition,before_text,after_text);
 before_text:=$before1$  else
   if payload-'response'<>'{}'::jsonb$before1$;after_text:=$after1$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.validate_workspace_page_access_event(entry);
  else
   if payload-'response'<>'{}'::jsonb$after1$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
  raise exception 'Unexpected suppression replay predecessor anchor 1'; end if;
 definition:=replace(definition,before_text,after_text);
 before_text:=$before2$  else
   if exists(select 1 from public.organization_closures where org_id=org and state='closing') then$before2$;after_text:=$after2$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.apply_workspace_page_access_suppression(entry);
  else
   if exists(select 1 from public.organization_closures where org_id=org and state='closing') then$after2$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
  raise exception 'Unexpected suppression replay predecessor anchor 2'; end if;
 definition:=replace(definition,before_text,after_text);
 before_text:=$before3$  else
   event_version:=(entry#>>'{response,versionId}')::uuid;$before3$;after_text:=$after3$  elsif entry->>'kind'='workspace_page_access_revoked' then
   perform public.assert_workspace_page_access_suppressed(entry);
  else
   event_version:=(entry#>>'{response,versionId}')::uuid;$after3$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
  raise exception 'Unexpected suppression replay predecessor anchor 3'; end if;
 definition:=replace(definition,before_text,after_text);
 before_text:=$before4$public.organization_workspace_pages,public.workspace_page_invitations,public.workspace_page_note_scopes,$before4$;after_text:=$after4$public.organization_workspace_pages,public.workspace_page_invitations,public.workspace_page_note_scopes,
  public.workspace_page_image_grants,public.workspace_page_document_grants,$after4$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
  raise exception 'Unexpected suppression replay predecessor anchor 4'; end if;
 definition:=replace(definition,before_text,after_text);
 before_text:=$before5$'sha256',p_expected_sha256,'captureComplete',false,'releaseQualified',false);$before5$;after_text:=$after5$'sha256',p_expected_sha256,'captureComplete',false,'releaseQualified',false,
  'reconciliation',jsonb_build_object('status','requires_current_authority_reconciliation','domains',jsonb_build_array(
   'legacy_publication','calendar_authority','organization_access','staff_support_fiscal_authority','connector_consent','runtime_environment_admission')));$after5$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
  raise exception 'Unexpected suppression replay predecessor anchor 5'; end if;
 definition:=replace(definition,before_text,after_text);
 execute definition;
end $migration$;
commit;
