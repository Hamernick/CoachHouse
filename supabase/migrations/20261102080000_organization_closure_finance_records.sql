-- Fence canonical accounting effects without activating organization closure.
begin;
create function public.guard_organization_finance_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare row_data jsonb; old_data jsonb; org uuid;
begin
 -- Revocation only removes authority. Preserve owner revocation, membership
 -- cleanup and auth-account cascades even while a lifecycle transaction holds
 -- the organization. Existing RLS/privileges still authorize each caller.
 if tg_table_name='organization_finance_access' and tg_op='DELETE' then return old; end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org:=(row_data->>'org_id')::uuid;
 if tg_op='UPDATE' then
   old_data:=to_jsonb(old);
   if row_data->'org_id' is distinct from old_data->'org_id'
     or row_data->'id' is distinct from old_data->'id'
     or (tg_table_name='organization_finance_access' and row_data->'member_id' is distinct from old_data->'member_id') then
     raise exception 'Finance identity cannot change' using errcode='42501'; end if;
   -- Only actual FK-driven attribution nullification. Other accounting
   -- immutability/retention triggers still run, including reconciled records.
   if tg_table_name='organization_finance_records' and pg_trigger_depth()>1
     and old_data->>'created_by' is not null and row_data->>'created_by' is null
     and (old_data-array['created_by','updated_at'])=(row_data-array['created_by','updated_at'])
     and not exists(select 1 from public.profiles where id=(old_data->>'created_by')::uuid) then
     return new;
   end if;
 end if;
 begin
   -- Reconciliation/correction callers and row UPDATE/DELETE already hold
   -- accounting tuples. Fail retryably instead of inverting org-first locks.
   perform 1 from public.organizations where user_id=org for share nowait;
   if not found then
     if tg_op='DELETE' then return old; end if;
     raise exception 'Organization unavailable' using errcode='42501';
   end if;
 exception when lock_not_available then
   raise exception 'Organization is changing; retry finance edit' using errcode='40001';
 end;
 perform public.guard_organization_closure(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_organization_finance_closure() from public,anon,authenticated,service_role;
create trigger finance_closure before insert or update or delete on public.organization_finance_access
 for each row execute function public.guard_organization_finance_closure();
create trigger finance_closure before insert or update or delete on public.organization_finance_records
 for each row execute function public.guard_organization_finance_closure();
create trigger finance_closure before insert or update or delete on public.organization_finance_record_evidence
 for each row execute function public.guard_organization_finance_closure();
create trigger finance_closure before insert or update or delete on public.organization_finance_record_events
 for each row execute function public.guard_organization_finance_closure();
create trigger finance_closure before insert or update or delete on public.organization_finance_record_corrections
 for each row execute function public.guard_organization_finance_closure();
create trigger finance_closure before insert or update or delete on public.organization_finance_record_provider_evidence
 for each row execute function public.guard_organization_finance_closure();
comment on function public.guard_organization_finance_closure() is
 'Serializes accounting writes with closure, including service-role reconciliation/correction/import effects. Revocation remains available; existing RLS and immutable accounting evidence remain enforced. No read, Storage, provider, purge or lifecycle authority is granted.';
commit;
