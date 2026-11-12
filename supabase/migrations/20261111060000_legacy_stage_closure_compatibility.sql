-- Preserve the previously qualified exact closure receipt route. This does not
-- broaden closure admission, activate closure, or infer ownership of new paths.
begin;
do $$
declare body text; previous text;
begin
 body:=pg_get_functiondef('public.guard_legacy_document_upload_storage()'::regprocedure);
 previous:=$old$ if tg_op='DELETE' and item.state='committed' then$old$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then
  raise exception 'Expected legacy stage Storage predecessor';end if;
 execute replace(body,previous,$new$ if tg_op='DELETE' and public.closure_asset_storage_delete_admitted(old.id,old.bucket_id,old.name) then
  return old;
 end if;
$new$||previous);
 -- The provider probes INSERT permission in a rolled-back transaction using
 -- version='1' and contentLength, before uploading physical bytes. Only this
 -- exact preflight may omit measured size; canonical commit still requires it.
 body:=pg_get_functiondef('public.guard_legacy_document_upload_storage()'::regprocedure);
 previous:=$old$ actual_size:=new.metadata->>'size';$old$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then
  raise exception 'Expected legacy upload size boundary';end if;
 execute replace(body,previous,previous||$new$
 if actual_size is null and new.version='1' then
  if new.metadata->>'contentLength' is not null and
   ((new.metadata->>'contentLength')!~'^[0-9]+$' or (new.metadata->>'contentLength')::numeric>item.size_bytes) then
   raise exception 'Upload preflight exceeds reservation.' using errcode='23514';end if;
  return new;
 end if;$new$);

 -- BEFORE INSERT runs for an ON CONFLICT upsert even when nothing changes.
 -- Its generated UUID is not the retained canonical identity.
 body:=pg_get_functiondef('public.guard_legacy_document_upload_commit()'::regprocedure);
 previous:=$old$ if item.state='committed' and item.file_id=new.id then return new;end if;$old$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then
  raise exception 'Expected legacy committed identity boundary';end if;
 execute replace(body,previous,$new$ if item.state='committed' and exists(select 1 from public.organization_document_files f
  where f.id=item.file_id and f.org_id=new.org_id and f.document_kind=new.document_kind and f.storage_path=new.storage_path)
  then return new;end if;$new$);
end $$;
commit;
