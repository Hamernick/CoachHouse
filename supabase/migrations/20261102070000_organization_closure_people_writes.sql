-- Canonical people taxonomy writes join closure. No lifecycle/UI activation.
begin;
create function public.guard_organization_people_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; org uuid; actor_key text:=tg_argv[1]; parent_key text:=tg_argv[0];
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op='UPDATE' then
   old_data:=to_jsonb(old);
   if row_data->parent_key is distinct from old_data->parent_key
     or (parent_key='org_id' and row_data->'id' is distinct from old_data->'id')
     or (parent_key<>'org_id' and row_data->'person_id' is distinct from old_data->'person_id') then
     raise exception 'People taxonomy identity cannot change' using errcode='42501'; end if;
   -- Preserve actual ON DELETE SET NULL attribution cleanup when an unrelated
   -- personal login/profile is deleted. No role, setting or caller flag can
   -- invoke this exception while its referenced profile still exists.
   if pg_trigger_depth()>1 and old_data->>actor_key is not null and row_data->>actor_key is null
     and (old_data-array[actor_key,'updated_at'])=(row_data-array[actor_key,'updated_at'])
     and not exists(select 1 from public.profiles where id=(old_data->>actor_key)::uuid) then
     return new;
   end if;
 end if;
 if parent_key='org_id' then org:=(row_data->>'org_id')::uuid;
 elsif parent_key='tag_id' then
   select org_id into org from public.organization_people_tags where id=(row_data->>'tag_id')::uuid;
 else
   select org_id into org from public.organization_people_segments where id=(row_data->>'segment_id')::uuid;
 end if;
 -- The parent's admitted delete owns its FK cascade. Its guard already holds
 -- the organization lock. A missing parent cannot authorize INSERT or UPDATE.
 if org is null then
   if tg_op='DELETE' then return old; end if;
   raise exception 'People taxonomy unavailable' using errcode='42501';
 end if;
 begin
   -- UPDATE/DELETE already own child tuples; existing org-first paths can wait
   -- for them. Never wait in reverse order. Busy lifecycle/organization writers
   -- reject this statement atomically with a retryable conflict, not a deadlock.
   perform 1 from public.organizations where user_id=org for share nowait;
   if not found then
     if tg_op='DELETE' then return old; end if;
     raise exception 'Organization unavailable' using errcode='42501';
   end if;
 exception when lock_not_available then
   raise exception 'Organization is changing; retry people edit' using errcode='40001';
 end;
 perform public.guard_organization_closure(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_organization_people_closure() from public,anon,authenticated,service_role;
create trigger people_taxonomy_closure before insert or update or delete on public.organization_people_tags
 for each row execute function public.guard_organization_people_closure('org_id','created_by');
create trigger people_taxonomy_closure before insert or update or delete on public.organization_people_segments
 for each row execute function public.guard_organization_people_closure('org_id','created_by');
create trigger people_taxonomy_closure before insert or update or delete on public.organization_people_tag_members
 for each row execute function public.guard_organization_people_closure('tag_id','added_by');
create trigger people_taxonomy_closure before insert or update or delete on public.organization_people_segment_members
 for each row execute function public.guard_organization_people_closure('segment_id','added_by');
comment on function public.guard_organization_people_closure() is
 'Closure fences canonical tag/segment and membership mutations with existing RLS intact. Preserves parent deletion cascades and exact FK attribution nullification for separate account deletion. No new read/export or purge authority.';
commit;
