-- Legacy canonical objectives/plans remain independent of board JSON.
begin;
-- Match the existing project/task author-cleanup contract: deleting a login
-- removes attribution, never a different organization's canonical work.
do $$ declare relation text; field text; begin
 foreach relation in array array['organization_workspace_objective_groups','organization_workspace_objectives',
  'organization_workspace_objective_assignees','organization_workspace_objective_links','organization_workspace_objective_activity'] loop
  field:=case when relation='organization_workspace_objective_activity' then 'actor_id' else 'created_by' end;
  execute format('alter table public.%I drop constraint %I, alter column %I drop not null, add constraint %I foreign key(%I) references public.profiles(id) on delete set null',
   relation,relation||'_'||field||'_fkey',field,relation||'_'||field||'_fkey',field);
 end loop;
end $$;
create function public.guard_legacy_objective_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare item jsonb; previous jsonb; org uuid; field text; parent_org uuid;
begin
 item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=(item->>'org_id')::uuid;
 if tg_op='UPDATE' then
  previous:=to_jsonb(old);
  foreach field in array array['id','org_id','objective_id','plan_id','step_id','user_id'] loop
   if previous->field is distinct from item->field then raise exception 'Objective scope cannot change' using errcode='42501'; end if;
  end loop;
  foreach field in array array['created_by','updated_by','actor_id'] loop
   if pg_trigger_depth()>1 and previous->>field is not null and item->>field is null
    and (previous-array[field,'updated_at'])=(item-array[field,'updated_at'])
    and not exists(select 1 from public.profiles where id=(previous->>field)::uuid) then return new; end if;
  end loop;
  if tg_table_name='organization_workspace_objectives' and pg_trigger_depth()>1
   and previous->>'group_id' is not null and item->>'group_id' is null
   and (previous-array['group_id','updated_at'])=(item-array['group_id','updated_at'])
   and not exists(select 1 from public.organization_workspace_objective_groups where id=(previous->>'group_id')::uuid) then return new; end if;
 elsif tg_op='DELETE' and tg_table_name='organization_workspace_objective_assignees' then
  if pg_trigger_depth()>1 and not exists(select 1 from public.profiles where id=old.user_id) then return old; end if;
 end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_op<>'DELETE' then
  -- Older objective tables used single-column FKs. New/rebound references must
  -- stay with their canonical owner; legacy exact FK cleanup is handled above.
  if item->>'objective_id' is not null then
   select org_id into parent_org from public.organization_workspace_objectives where id=(item->>'objective_id')::uuid;
   if parent_org is distinct from org then raise exception 'Objective owner mismatch' using errcode='42501'; end if;
  end if;
  if tg_table_name='organization_workspace_objectives' and item->>'group_id' is not null then
   select org_id into parent_org from public.organization_workspace_objective_groups where id=(item->>'group_id')::uuid;
   if parent_org is distinct from org then raise exception 'Objective group owner mismatch' using errcode='42501'; end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.guard_legacy_objective_closure() from public,anon,authenticated,service_role;
do $$ declare relation text; begin
 foreach relation in array array['organization_workspace_objective_groups','organization_workspace_objectives',
  'organization_workspace_objective_steps','organization_workspace_objective_assignees','organization_workspace_objective_links',
  'organization_workspace_objective_activity','workspace_objective_plans','workspace_objective_plan_steps','workspace_objective_plan_edges'] loop
  execute format('create trigger objective_closure before insert or update or delete on public.%I for each row execute function public.guard_legacy_objective_closure()',relation);
 end loop;
end $$;
comment on function public.guard_legacy_objective_closure() is
 'Fences nine canonical objective/plan stores and existing manual/AI plan RPC effects. Exact account attribution cleanup preserves work; assignee departure grants no content deletion. Existing revisions, roles, composite plan scope and private receipts remain authoritative.';
commit;
