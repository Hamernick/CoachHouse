-- Complete the existing finite local source pass after450. This is not an
-- organization-erasure attestation or an owner/API activation boundary.
begin;
do $migration$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.organization_closure_cleanup_assessment(uuid)'::regprocedure);
 needle:='''roadmap-media'',''workspace-page-assets'')';
 replacement:='''roadmap-media'',''workspace-page-assets'',''project-assets'')';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected controlled Storage assessment predecessor';end if;
 definition:=replace(definition,needle,replacement);
 needle:='''projectAssetBindingsPending450''';replacement:='''projectAssetBindings''';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected project asset assessment predecessor';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$'fileDocumentActivityPending450',(select count(*) from public.organization_project_activity_events where org_id=p_org and (entity_type='document' or entity_type='file' and metadata->>'source' in('organization_document_files','organization_project_assets')))$old$;
 replacement:=$new$'fileDocumentActivityPayloads',(select count(*) from public.organization_project_activity_events e where org_id=p_org and (entity_type='document' or entity_type='file' and metadata->>'source' in('organization_document_files','organization_project_assets')) and to_jsonb(e) is distinct from public.project_retired_file_activity(to_jsonb(e)))$new$;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected file activity assessment predecessor';end if;
 definition:=replace(definition,needle,replacement);
 needle:='''unqualifiedLocalOwners'',jsonb_build_array(''project_assets_and_document_activity_450'')';
 replacement:='''unqualifiedLocalOwners'',''[]''::jsonb';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected pending source assessment predecessor';end if;
 execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('public.run_organization_closure_sql_cleanup(uuid,uuid,integer,uuid)'::regprocedure);
 needle:='''external_documents'',''profile_metadata''] loop';replacement:='''external_documents'',''profile_metadata'',''project_file_metadata''] loop';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected finite source dispatch predecessor';end if;
 definition:=replace(definition,needle,replacement);
 needle:='when ''profile_metadata'' then result:=public.purge_expired_organization_profile_metadata(p_org,p_request,p_revision,p_attempt);';
 replacement:=needle||chr(10)||'    when ''project_file_metadata'' then result:=public.purge_expired_organization_project_file_metadata(p_org,p_request,p_revision,p_attempt);';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'Unexpected profile source dispatch predecessor';end if;
 execute replace(definition,needle,replacement);
end $migration$;
-- CREATE OR REPLACE preserves the established private ACL. Physical workers
-- still use exact source reservations; no caller can attest whole completion.
comment on table public.organization_closure_cleanup_attempts is
 'Private finite ten-source worker claim/result receipts. Fixed leases never extend lifecycle export deadline. Source-specific receipts remain effect authority; batch_complete is not whole-store completion. Canonical remaining counts include project assets and historical file/document copies. Unresolved ownership and external durability/provider/retention/disposition/refund/host qualification prevent whole-cleanup completion.';
commit;
