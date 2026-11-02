-- A locator scopes discovery to one organization; it never grants form access.
begin;
create function public.list_accessible_organization_forms(p_actor_id uuid,p_version_id uuid,p_after uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare
 anchor public.organization_form_versions%rowtype; actor_role text;
 candidates uuid[]; locked_id uuid; item record; rows jsonb:='[]'; next_id uuid;
begin
 if p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 select * into anchor from public.organization_form_versions where id=p_version_id;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=anchor.org_id for share;
 if not found then raise exception 'Form access required' using errcode='42501'; end if;
 if p_actor_id<>anchor.org_id then
   select role into actor_role from public.organization_memberships
     where org_id=anchor.org_id and member_id=p_actor_id for share;
 end if;
 -- Select only authorized candidates. Unpublished forms have no response entry.
 -- UUID keysets remain stable when titles or publication timestamps change.
 select array_agg(t.id order by t.id) into candidates from (
   select f.id from public.organization_forms f where f.org_id=anchor.org_id
     and (p_after is null or f.id>p_after)
     and exists(select 1 from public.organization_form_versions v where v.org_id=f.org_id and v.form_id=f.id)
     and (((p_actor_id=anchor.org_id or coalesce(actor_role,'') in ('owner','admin','staff'))
       and public.can_review_organization_form(f.org_id,f.id,p_actor_id))
       or public.can_view_invited_form_responses(f.org_id,f.id,p_actor_id))
     order by f.id limit 51
 ) t;
 -- Match multi-form revocation's ordered form locks. Recheck AFTER waiting:
 -- pre-lock candidates are never evidence of current authority.
 for locked_id in select distinct x from unnest(coalesce(candidates,'{}'::uuid[])||array[anchor.form_id]) x order by x loop
   perform 1 from public.organization_forms where org_id=anchor.org_id and id=locked_id for update;
 end loop;
 if not (((p_actor_id=anchor.org_id or coalesce(actor_role,'') in ('owner','admin','staff'))
   and public.can_review_organization_form(anchor.org_id,anchor.form_id,p_actor_id))
   or public.can_view_invited_form_responses(anchor.org_id,anchor.form_id,p_actor_id)) then
   raise exception 'Form access required' using errcode='42501';
 end if;
 if cardinality(candidates)>50 then next_id:=candidates[50]; end if;
 for item in
   select f.id,v.id as version_id,v.version from public.organization_forms f
   cross join lateral (select id,version from public.organization_form_versions
     where org_id=f.org_id and form_id=f.id order by created_at desc,id desc limit 1) v
   where f.org_id=anchor.org_id and f.id=any(candidates[1:50])
     and (((p_actor_id=anchor.org_id or coalesce(actor_role,'') in ('owner','admin','staff'))
       and public.can_review_organization_form(f.org_id,f.id,p_actor_id))
       or public.can_view_invited_form_responses(f.org_id,f.id,p_actor_id))
   order by f.id
 loop
   rows:=rows||jsonb_build_array(jsonb_build_object('formId',item.id,'versionId',item.version_id,'title',item.version->>'title'));
 end loop;
 return jsonb_build_object('forms',rows,'next',next_id);
end; $$;
revoke all on function public.list_accessible_organization_forms(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_accessible_organization_forms(uuid,uuid,uuid) to service_role;
commit;
