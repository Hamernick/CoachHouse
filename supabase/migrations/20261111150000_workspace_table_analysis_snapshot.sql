-- Read-only bounded snapshots for deterministic calculations over saved native views.
-- Reuse the canonical reader's authorization/filter contract; no writer or store.
begin;
create function public.read_workspace_table_analysis(p_org uuid,p_view uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare page jsonb; v public.organization_data_views%rowtype; cols jsonb; selected jsonb; result jsonb;
begin
 -- Existing reader stabilizes actor/membership/organization and closure authority.
 page:=public.workspace_data_view_command(jsonb_build_object('action','read','organizationId',p_org,'viewId',p_view,'page',0));
 if page#>>'{view,source}' is distinct from 'table' then raise exception 'Native table unavailable' using errcode='42501'; end if;
 select * into v from public.organization_data_views where id=p_view and org_id=p_org and source='table' for share nowait;
 if not found or v.revision::text is distinct from page#>>'{view,revision}' or v.table_id::text is distinct from page#>>'{view,tableId}' then raise exception 'Source changed' using errcode='40001'; end if;
 select columns into cols from public.organization_data_tables where id=v.table_id and org_id=p_org for share nowait;
 if not found or cols is distinct from page->'columns' then raise exception 'Source changed' using errcode='40001'; end if;
 -- One SQL statement observes a coherent row set, including revisions. No pages,
 -- semantic samples, dynamic SQL, provider data, mutation or copied authority.
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision::text,'values',values) order by id),'[]'::jsonb)
 into selected from (
   select id,revision,values from public.organization_data_rows where org_id=p_org and table_id=v.table_id
    and (v.config->'filter'='null'::jsonb or position(lower(v.config#>>'{filter,value}') in lower(coalesce(values->>(v.config#>>'{filter,column}'),'')))>0)
   order by id limit 501
 ) rows;
 if jsonb_array_length(selected)>500 then raise exception 'Complete selection exceeds analysis limit' using errcode='22023'; end if;
 result:=jsonb_build_object('view',page->'view','columns',cols,'rows',selected,'total',jsonb_array_length(selected),'complete',true);
 if octet_length(result::text)>1000000 then raise exception 'Complete selection exceeds analysis byte limit' using errcode='22023'; end if;
 return result;
end $$;
revoke all on function public.read_workspace_table_analysis(uuid,uuid) from public,anon,service_role;
grant execute on function public.read_workspace_table_analysis(uuid,uuid) to authenticated;
commit;
