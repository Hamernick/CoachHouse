-- Complete the canonical opportunity/engagement write boundary, not provider shutdown.
begin;
create function public.guard_organization_opportunity_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; org uuid; reference_key text; reference_missing boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=(row_data->>'org_id')::uuid;
 if tg_op='UPDATE' then
   old_data:=to_jsonb(old);
   if row_data->'org_id' is distinct from old_data->'org_id'
     or row_data->'id' is distinct from old_data->'id' then
     raise exception 'Opportunity identity cannot change' using errcode='42501'; end if;
   -- Existing FKs allow cross-organization references. Deleting an admitted
   -- active parent must not be blocked by a closing referencing organization.
   -- Permit only actual FK nullification after that referenced row is absent.
   reference_key:=case tg_table_name
     when 'organization_finance_engagement_events' then 'finance_record_id'
     when 'organization_resource_opportunity_matches' then 'opportunity_id' end;
   if pg_trigger_depth()>1 and reference_key is not null
     and old_data->>reference_key is not null and row_data->>reference_key is null
     and (old_data-array[reference_key,'updated_at'])=(row_data-array[reference_key,'updated_at']) then
     if reference_key='finance_record_id' then
       reference_missing:=not exists(select 1 from public.organization_finance_records where id=(old_data->>reference_key)::uuid);
     else
       reference_missing:=not exists(select 1 from public.organization_finance_opportunities where id=(old_data->>reference_key)::uuid);
     end if;
     if reference_missing then return new; end if;
   end if;
 end if;
 begin
   -- Match/reorder RPCs may already own board/row locks. Do not invert the
   -- lifecycle's org-first order by waiting here while holding those tuples.
   perform 1 from public.organizations where user_id=org for share nowait;
   if not found then
     if tg_op='DELETE' then return old; end if;
     raise exception 'Organization unavailable' using errcode='42501';
   end if;
 exception when lock_not_available then
   raise exception 'Organization is changing; retry opportunity edit' using errcode='40001';
 end;
 perform public.guard_organization_closure(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_organization_opportunity_closure() from public,anon,authenticated,service_role;
create trigger opportunity_closure before insert or update or delete on public.organization_finance_opportunities
 for each row execute function public.guard_organization_opportunity_closure();
create trigger opportunity_closure before insert or update or delete on public.organization_finance_engagement_events
 for each row execute function public.guard_organization_opportunity_closure();
create trigger opportunity_closure before insert or update or delete on public.finance_opportunity_scan_runs
 for each row execute function public.guard_organization_opportunity_closure();
create trigger opportunity_closure before insert or update or delete on public.organization_resource_opportunity_matches
 for each row execute function public.guard_organization_opportunity_closure();
comment on function public.guard_organization_opportunity_closure() is
 'Fences organization opportunity, engagement, scan-run and resource-match writes, including service-role RPC effects. Shared sources, existing RLS and exact FK cleanup remain. No read, provider, purge or closure-transition authority is granted.';
commit;
