-- Creation attribution and source protection. Existing response identities do not move.
begin;
alter table public.organization_forms add column creator_id uuid references auth.users(id);
comment on column public.organization_forms.creator_id is 'Verified actor at first canonical form creation after this migration. NULL means historical creator unknown; never infer from publisher or assignee.';

-- Content identity is separate from placement. Equal appearances on different
-- canvases share one form; layout, status, assignment and timestamps are not answers
-- or form-definition edits. Conflicting definitions under one identity fail closed.
create function public.workspace_form_sources(p_state jsonb)
 returns table(id uuid, content jsonb) language sql immutable set search_path='' as $$
 select distinct (p->>'id')::uuid, jsonb_build_object(
   'title',p->'title','description',coalesce(p->>'description',''),'widget',p#>'{data,widget}')
 from (
   select p_state as state union all
   select e->'state' from jsonb_array_elements(case when jsonb_typeof(p_state#>'{workspaceCatalog,entries}')='array'
     then p_state#>'{workspaceCatalog,entries}' else '[]'::jsonb end) e
 ) canvases cross join lateral jsonb_array_elements(case when jsonb_typeof(state#>'{particleGraph,particles}')='array'
   then state#>'{particleGraph,particles}' else '[]'::jsonb end) p
 where p->>'type'='activity' and p#>>'{data,widget,kind}'='form'
   and (p#>'{data,source}' is null or p#>'{data,source}'='null'::jsonb);
$$;
revoke all on function public.workspace_form_sources(jsonb) from public,anon,authenticated,service_role;

-- Historical creators cannot be reconstructed. Preserve published intake managers;
-- give otherwise unowned legacy drafts organization-owner custody, not authorship.
insert into public.organization_forms(org_id,id,intake_manager)
 select distinct b.org_id,f.id,b.org_id from public.organization_workspace_boards b
 cross join lateral public.workspace_form_sources(b.state) f
 on conflict do nothing;

create function public.guard_workspace_form_sources() returns trigger
 language plpgsql security definer set search_path='' as $$
declare
 previous jsonb:='[]'; following jsonb:='[]'; changed uuid; old_content jsonb; new_content jsonb;
 target_org uuid; actor uuid; manager uuid; member_role text;
 invoker text:=coalesce(nullif(current_setting('role',true),'none'),session_user);
begin
 if tg_op='UPDATE' and old.org_id<>new.org_id then
   raise exception 'Workspace organization cannot change' using errcode='42501'; end if;
 if tg_op='DELETE' then target_org:=old.org_id; else target_org:=new.org_id; end if;
 -- An actual organization deletion owns its cascade; deleting a board alone does not delete forms/responses.
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=target_org) then return old; end if;
 if tg_op<>'INSERT' then
   select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'content',f.content) order by f.id,f.content::text),'[]')
     into previous from public.workspace_form_sources(old.state) f;
 end if;
 if tg_op<>'DELETE' then
   select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'content',f.content) order by f.id,f.content::text),'[]')
     into following from public.workspace_form_sources(new.state) f;
 end if;
 if previous=following then
   if tg_op='DELETE' then return old; else return new; end if;
 end if;
 -- JWT subject is authoritative for session writes; updated_by is client-controlled.
 -- Trusted service writes must supply an actor and still satisfy source permissions.
 if invoker='authenticated' then actor:=auth.uid();
 elsif invoker='service_role' or exists(select 1 from pg_catalog.pg_roles where rolname=invoker and rolsuper) then
   if tg_op='DELETE' then actor:=auth.uid(); else actor:=nullif(to_jsonb(new)->>'updated_by','')::uuid; end if;
 end if;
 if actor is null then raise exception 'Verified form actor required' using errcode='42501'; end if;
 if actor<>target_org then
   select role into member_role from public.organization_memberships where org_id=target_org and member_id=actor;
   if member_role is null or member_role not in ('owner','admin','staff') then
     raise exception 'Form source access required' using errcode='42501'; end if;
 end if;
 -- Board writers already serialize on this row; take canonical form locks in ID order.
 -- Do not acquire an organization lock after the board lock (publication uses org -> board -> form).
 for changed in select distinct (x->>'id')::uuid from jsonb_array_elements(previous||following) x order by 1 loop
   select coalesce(jsonb_agg(x->'content' order by (x->'content')::text),'[]') into old_content
     from jsonb_array_elements(previous) x where x->>'id'=changed::text;
   select coalesce(jsonb_agg(x->'content' order by (x->'content')::text),'[]') into new_content
     from jsonb_array_elements(following) x where x->>'id'=changed::text;
   if old_content=new_content then continue; end if;
   if jsonb_array_length(new_content)>1 then raise exception 'Conflicting form identity' using errcode='22023'; end if;
   if old_content='[]'::jsonb and new_content<>'[]'::jsonb then
     insert into public.organization_forms(org_id,id,intake_manager,creator_id) values(target_org,changed,actor,actor)
       on conflict do nothing;
   end if;
   select intake_manager into manager from public.organization_forms where org_id=target_org and id=changed for update;
   if not found or manager is distinct from actor then
     raise exception 'Form source manager required' using errcode='42501'; end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.guard_workspace_form_sources() from public,anon,authenticated,service_role;
-- AFTER sees the final state after existing catalog-preservation triggers. Exceptions
-- roll back the board and attribution together, including failed later constraints.
create trigger workspace_form_source_guard after insert or update or delete on public.organization_workspace_boards
 for each row execute function public.guard_workspace_form_sources();

create or replace function public.commit_workspace_page(
 p_actor_id uuid,p_org_id uuid,p_page_id uuid,p_operation_id uuid,p_operation_hash text,
 p_expected_revision integer,p_intent text,p_draft jsonb,p_snapshot jsonb,p_expected_graph jsonb,
 p_expected_org_updated_at timestamptz,p_expected_drive_sources jsonb default '[]',
 p_expected_profile jsonb default null,p_canvas_id uuid default null,p_image_assets jsonb default '[]',
 p_document_assets jsonb default '[]',p_form_versions jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; v jsonb; item jsonb; expected_definition jsonb; manager uuid; form_count integer;
begin
 result:=public.commit_workspace_page_with_assets(p_actor_id,p_org_id,p_page_id,p_operation_id,p_operation_hash,
   p_expected_revision,p_intent,p_draft,p_snapshot,p_expected_graph,p_expected_org_updated_at,
   p_expected_drive_sources,p_expected_profile,p_canvas_id,p_image_assets,p_document_assets);
 if (result->>'replayed')::boolean then return result; end if;
 if jsonb_typeof(p_form_versions) is distinct from 'array' or jsonb_array_length(p_form_versions)>50 then
   raise exception 'Invalid form versions' using errcode='22023'; end if;
 if p_intent not in ('publish','share_with_guests') then
   if p_form_versions<>'[]'::jsonb then raise exception 'Unexpected form versions' using errcode='22023'; end if;
   return result;
 end if;
 select count(*) into form_count from jsonb_array_elements(p_snapshot->'items') i where i#>>'{content,kind}'='form';
 if form_count<>jsonb_array_length(p_form_versions) or form_count<>(select count(distinct f->>'id') from jsonb_array_elements(p_form_versions) f) then
   raise exception 'Form selection mismatch' using errcode='22023'; end if;
 for v in select value from jsonb_array_elements(p_form_versions) order by value->>'formId' loop
   select i into item from jsonb_array_elements(p_snapshot->'items') i
     where i->>'id'=v->>'formId' and i#>>'{content,kind}'='form' and i#>>'{content,intakeVersionId}'=v->>'id';
   if not found or v->>'schemaVersion' is distinct from '1' or v->>'revision' is distinct from (p_expected_revision+1)::text
     or v->>'title' is distinct from item->>'title' or v->>'description' is distinct from coalesce(item->>'description','')
     or jsonb_typeof(item#>'{content,definition,questions}') is distinct from 'array'
     or jsonb_array_length(item#>'{content,definition,questions}') not between 1 and 50 then
     raise exception 'Invalid form version' using errcode='22023'; end if;
   -- Compare to the locked canonical graph, never a client-authored definition.
   if not exists(select 1 from jsonb_array_elements(p_expected_graph->'particles') p
     where p->>'id'=v->>'formId' and p->>'type'='activity' and p#>>'{data,widget,kind}'='form'
       and (p#>'{data,source}' is null or p#>'{data,source}'='null'::jsonb)
       and p#>'{data,widget,definition}'=item#>'{content,definition}') then
     raise exception 'Form source changed' using errcode='40001'; end if;
   select jsonb_build_object('questions',jsonb_agg(case when q ? 'options' then
     jsonb_set(q,'{options}',(select jsonb_agg(jsonb_build_object('id','option-'||n,'label',label) order by n)
       from jsonb_array_elements_text(q->'options') with ordinality o(label,n))) else q end order by ordinal))
     into expected_definition from jsonb_array_elements(item#>'{content,definition,questions}') with ordinality qs(q,ordinal);
   if v->'definition' is distinct from expected_definition then raise exception 'Form definition mismatch' using errcode='22023'; end if;
   -- Ownership is established by the authenticated canonical board write, never publication.
   select intake_manager into manager from public.organization_forms where org_id=p_org_id and id=(v->>'formId')::uuid for update;
   if not found or manager is distinct from p_actor_id then
     raise exception 'Form manager required' using errcode='42501'; end if;
   insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
     values((v->>'id')::uuid,p_org_id,(v->>'formId')::uuid,p_page_id,v);
 end loop;
 return result;
end; $$;
revoke all on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_workspace_page(uuid,uuid,uuid,uuid,text,integer,text,jsonb,jsonb,jsonb,timestamptz,jsonb,jsonb,uuid,jsonb,jsonb,jsonb) to service_role;

commit;
