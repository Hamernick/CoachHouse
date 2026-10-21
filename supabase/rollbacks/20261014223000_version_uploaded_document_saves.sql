-- Disable the writable file-editor rollout before using this rollback.
-- Refuse to destroy any history/reservation. Populated installations retain the
-- schema and roll the application back; recovery data must never be dropped.
begin;
do $$ begin
  if exists(select 1 from public.document_file_versions) or exists(select 1 from public.document_version_operations)
    then raise exception 'Retain populated document history; use application rollback.'; end if;
end $$;
drop policy document_versions_reserved_insert on storage.objects;
drop policy document_versions_immutable_update on storage.objects;
drop policy document_versions_immutable_delete on storage.objects;
drop function public.commit_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid,text);
drop function public.reserve_uploaded_document_version(uuid,uuid,uuid,uuid,text,timestamptz,bigint,text,text,bigint,uuid);
drop function public.abandon_uploaded_document_version(uuid,uuid,uuid);
drop function public.finish_abandoned_document_version(uuid,uuid,uuid);
drop function public.document_version_actor_can_edit(uuid,uuid);
drop function public.is_document_version_object(text,text);
create or replace function public.enforce_organization_document_storage_quota()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  current_bytes bigint;
begin
  if tg_op = 'UPDATE' and new.org_id = old.org_id
    and new.size_bytes = old.size_bytes then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 0));
  select coalesce(sum(file.size_bytes), 0) into current_bytes
  from public.organization_document_files file
  where file.org_id = new.org_id
    and (tg_op = 'INSERT' or file.id <> old.id)
    and (tg_op <> 'INSERT' or new.document_kind is null
      or file.document_kind is distinct from new.document_kind);
  if current_bytes + new.size_bytes > 5368709120 then
    raise exception 'Organization document storage quota exceeded.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop table public.document_file_versions;
drop table public.document_version_operations;
commit;
