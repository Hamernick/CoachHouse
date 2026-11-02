-- Discover published versions of one explicitly authorized canonical form.
begin;
create index organization_form_versions_canonical_order
 on public.organization_form_versions(org_id,form_id,created_at desc,id desc);

create function public.list_organization_form_response_versions(p_actor_id uuid,p_version_id uuid,p_before uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v public.organization_form_versions%rowtype; cursor_row public.organization_form_versions%rowtype;
 actor_role text; rows jsonb; row_count integer;
begin
 if p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 select * into v from public.organization_form_versions where id=p_version_id;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 -- Same authority and lock order as response reads. Revocation and recovery
 -- serialize against this form lock; an unrelated page grants no discovery.
 perform 1 from public.organizations where user_id=v.org_id for share;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 if p_actor_id<>v.org_id then
   select role into actor_role from public.organization_memberships
     where org_id=v.org_id and member_id=p_actor_id for share;
 end if;
 perform 1 from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 if not found or not (
   ((p_actor_id=v.org_id or coalesce(actor_role,'') in ('owner','admin','staff'))
     and public.can_review_organization_form(v.org_id,v.form_id,p_actor_id))
   or public.can_view_invited_form_responses(v.org_id,v.form_id,p_actor_id)
 ) then raise exception 'Form access required' using errcode='42501'; end if;
 if p_before is not null then
   select * into cursor_row from public.organization_form_versions
     where id=p_before and org_id=v.org_id and form_id=v.form_id;
   if not found then raise exception 'Invalid version cursor' using errcode='22023'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.version->>'title',
   'revision',t.version->'revision','createdAt',t.created_at) order by t.created_at desc,t.id desc),'[]'),count(*) into rows,row_count
 from (select * from public.organization_form_versions where org_id=v.org_id and form_id=v.form_id
   and (p_before is null or (created_at,id)<(cursor_row.created_at,cursor_row.id))
   order by created_at desc,id desc limit 51) t;
 return jsonb_build_object('versions',case when row_count>50 then rows-50 else rows end,
   'next',case when row_count>50 then rows->49->>'id' else null end);
end; $$;
revoke all on function public.list_organization_form_response_versions(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_organization_form_response_versions(uuid,uuid,uuid) to service_role;
commit;
