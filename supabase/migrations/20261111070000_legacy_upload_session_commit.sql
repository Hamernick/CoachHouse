-- Canonical profile CAS retains authenticated RLS. Upload/cleanup/Storage RPCs
-- remain service-only; this private trigger helper admits the actual session
-- actor using exactly the existing current parent/paid/support/edit checks.
begin;
do $$
declare body text; previous text;
begin
 body:=pg_get_functiondef('public.assert_document_cleanup_authority(uuid,uuid,boolean)'::regprocedure);
 body:=replace(body,'public.assert_document_cleanup_authority(','public.assert_legacy_upload_commit_authority(');
 previous:=$old$ if auth.role()<>'service_role' or p_actor is null or public.organization_activity_actor_id() is distinct from p_actor then$old$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then
  raise exception 'Expected document actor authority predecessor';end if;
 execute replace(body,previous,$new$ if p_actor is null or public.organization_activity_actor_id() is distinct from p_actor
  or auth.role() is null or auth.role() not in('service_role','authenticated')
  or (auth.role()='authenticated' and auth.uid() is distinct from p_actor) then$new$);
 body:=pg_get_functiondef('public.guard_legacy_document_upload_commit()'::regprocedure);
 previous:=$old$ perform public.assert_legacy_document_upload(item.org_id,item.document_kind,item.actor_id,item.support);$old$;
 if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then
  raise exception 'Expected legacy canonical commit admission';end if;
 execute replace(body,previous,$new$ perform public.assert_legacy_upload_commit_authority(item.org_id,item.actor_id,item.support);
 perform public.assert_document_file_folder_edit(coalesce((select f.id from public.organization_document_files f
  where f.org_id=item.org_id and f.document_kind=item.document_kind),new.id),item.actor_id);$new$);
end $$;
revoke all on function public.assert_legacy_upload_commit_authority(uuid,uuid,boolean) from public,anon,authenticated,service_role;
comment on function public.assert_legacy_upload_commit_authority(uuid,uuid,boolean) is 'Private canonical commit trigger only. Actual authenticated actor or verified service actor; unchanged current parent, paid/support, organization edit and closure checks. Does not authorize Storage or cleanup RPC calls.';
commit;
