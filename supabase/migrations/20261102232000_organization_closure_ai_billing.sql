-- Stop new credit purchases/refills; preserve independently verified payment evidence.
begin;
do $$ begin
 if exists(select 1 from public.organization_closures where state='closing') then
  raise exception 'Reconcile active closures before installing AI billing shutdown'; end if;
end $$;

create function public.guard_ai_billing_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if tg_table_name='ai_credit_refill_attempts' then
  select org_id into org from public.ai_credit_purchase_orders where id=new.id;
  if tg_op='UPDATE' then
   if new.id is distinct from old.id or new.setup_id is distinct from old.setup_id or new.run_id is distinct from old.run_id then
    raise exception 'Refill attempt identity cannot change' using errcode='42501'; end if;
   -- Reconciliation may record late success/failure; only dispatch is admission.
   if new.state not in ('queued','charging') or new.state=old.state then return new; end if;
  end if;
 elsif tg_table_name='ai_credit_refill_setups' then
  org:=new.org_id;
  if tg_op='UPDATE' then
   if old.status='disabled' and new.status<>'disabled' then
    raise exception 'Disabled refill consent cannot restart' using errcode='42501'; end if;
   if new.status='disabled' and (to_jsonb(old)-array['status','disabled_at'])=(to_jsonb(new)-array['status','disabled_at']) then return new; end if;
  end if;
 else org:=new.org_id;
 end if;
 perform public.guard_uploaded_document_organization(org);
 return new;
end $$;
revoke all on function public.guard_ai_billing_closure() from public,anon,authenticated,service_role;
create trigger ai_billing_closure before insert on public.ai_credit_purchase_orders
 for each row execute function public.guard_ai_billing_closure();
create trigger ai_billing_closure before insert or update on public.ai_credit_refill_setups
 for each row execute function public.guard_ai_billing_closure();
create trigger ai_billing_closure before insert or update on public.ai_credit_refill_attempts
 for each row execute function public.guard_ai_billing_closure();

alter function public.prepare_ai_credit_purchase(uuid,uuid,uuid,text,text,text) rename to prepare_ai_credit_purchase_before_closure;
revoke all on function public.prepare_ai_credit_purchase_before_closure(uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
create function public.prepare_ai_credit_purchase(p_id uuid,p_org_id uuid,p_actor_id uuid,p_pack text,p_mode text,p_return_url text)
 returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.guard_uploaded_document_organization(p_org_id);
 return public.prepare_ai_credit_purchase_before_closure(p_id,p_org_id,p_actor_id,p_pack,p_mode,p_return_url);
end $$;
revoke all on function public.prepare_ai_credit_purchase(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.prepare_ai_credit_purchase(uuid,uuid,uuid,text,text,text) to service_role;

alter function public.prepare_ai_credit_refill_setup(jsonb) rename to prepare_ai_credit_refill_setup_before_closure;
revoke all on function public.prepare_ai_credit_refill_setup_before_closure(jsonb) from public,anon,authenticated,service_role;
create function public.prepare_ai_credit_refill_setup(p_input jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
begin
 perform public.guard_uploaded_document_organization((p_input->>'organizationId')::uuid);
 return public.prepare_ai_credit_refill_setup_before_closure(p_input);
end $$;
revoke all on function public.prepare_ai_credit_refill_setup(jsonb) from public,anon,authenticated;
grant execute on function public.prepare_ai_credit_refill_setup(jsonb) to service_role;

alter function public.start_ai_credit_refill_charge(uuid,uuid) rename to start_ai_credit_refill_charge_before_closure;
revoke all on function public.start_ai_credit_refill_charge_before_closure(uuid,uuid) from public,anon,authenticated,service_role;
create function public.start_ai_credit_refill_charge(p_id uuid,p_actor_id uuid default null) returns boolean
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select org_id into org from public.ai_credit_purchase_orders where id=p_id;
 if org is null then return false; end if;
 perform public.guard_uploaded_document_organization(org);
 return public.start_ai_credit_refill_charge_before_closure(p_id,p_actor_id);
exception when insufficient_privilege or serialization_failure then return false;
end $$;
revoke all on function public.start_ai_credit_refill_charge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_ai_credit_refill_charge(uuid,uuid) to service_role;

create function public.disable_ai_billing_on_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' or (tg_op='UPDATE' and old.state='closing') then return new; end if;
 -- Workers lock policy then child rows. Closure owns its organization first;
 -- NOWAIT avoids inversion and leaves every shutdown hook atomic on retry.
 begin
  perform 1 from public.ai_credit_policy where id for update nowait;
  perform 1 from public.ai_credit_refill_setups where org_id=new.org_id order by id for update nowait;
  perform 1 from public.ai_credit_refill_attempts a join public.ai_credit_purchase_orders o on o.id=a.id
   where o.org_id=new.org_id and a.state='queued' order by a.id for update of a nowait;
 exception when lock_not_available then raise exception 'AI billing is changing; retry closure' using errcode='40001'; end;
 update public.ai_credit_refill_setups set status='disabled',disabled_at=clock_timestamp()
  where org_id=new.org_id and status<>'disabled';
 update public.ai_credit_refill_attempts a set state='canceled',updated_at=clock_timestamp()
  from public.ai_credit_purchase_orders o where o.id=a.id and o.org_id=new.org_id and a.state='queued';
 return new;
end $$;
revoke all on function public.disable_ai_billing_on_closure() from public,anon,authenticated,service_role;
create trigger organization_closure_disable_ai_billing after insert or update of state on public.organization_closures
 for each row execute function public.disable_ai_billing_on_closure();
comment on function public.disable_ai_billing_on_closure() is
 'Disables refill consent and queued charges without erasing purchases, payments, refunds or in-flight reconciliation. Cancel does not restore consent. External checkout/subscription/refund handling remains separate; no provider call or closure grant.';
commit;
