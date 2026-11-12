-- Saved documents follow existing workspace reader authority, not AI-spending
-- eligibility. The caller must still authorize the current document source.
begin;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.read_workspace_ai_document_copy_sources(uuid,uuid,text[])'::regprocedure);
 if strpos(definition,'public.can_read_workspace_ai(p_org_id,p_actor_id)')=0 then
  raise exception 'Unexpected saved document reader authority';end if;
 execute replace(definition,'public.can_read_workspace_ai(p_org_id,p_actor_id)',
   'public.can_read_workspace_particle_origins(p_org_id,p_actor_id)');
end $$;
-- Keep actor/header binding, service-only dispatch, closure and lineage checks.
revoke all on function public.read_workspace_ai_document_copy_sources(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_workspace_ai_document_copy_sources(uuid,uuid,text[]) to service_role;
commit;
