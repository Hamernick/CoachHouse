-- Stop new AI work and permanently cancel admitted runs, retaining cost evidence.
begin;
do $$ begin
 if exists(select 1 from public.organization_closures where state='closing') then
   raise exception 'Reconcile active closures before installing AI shutdown'; end if;
end $$;
create function public.guard_workspace_ai_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   perform public.guard_uploaded_document_organization(new.org_id);
 else
   if new.id is distinct from old.id or new.org_id is distinct from old.org_id or new.actor_id is distinct from old.actor_id then
     raise exception 'AI run identity cannot change' using errcode='42501'; end if;
   if old.cancel_requested_at is not null and new.cancel_requested_at is distinct from old.cancel_requested_at then
     raise exception 'AI cancellation cannot be reversed' using errcode='42501'; end if;
   if new.cancel_requested_at is not null and (new.status='succeeded'
     or (new.status='running' and old.status<>'running')) then
     raise exception 'Canceled AI work cannot restart or succeed' using errcode='42501'; end if;
   -- Late correlation, measured settlement and conservative recovery remain
   -- available. New dispatch, changed input or a newly successful proposal do not.
   if (new.status='running' and old.status is distinct from 'running')
     or (new.status='succeeded' and (old.status is distinct from 'succeeded' or new.proposal is distinct from old.proposal))
     or (to_jsonb(new)-array['status','provider_response_id','provider_cost_state','provider_microdollars',
       'charged_credits','proposal','usage','cancel_requested_at','settled_at'])
       is distinct from (to_jsonb(old)-array['status','provider_response_id','provider_cost_state','provider_microdollars',
       'charged_credits','proposal','usage','cancel_requested_at','settled_at']) then
     perform public.guard_uploaded_document_organization(new.org_id);
   end if;
 end if;
 return new;
end; $$;
revoke all on function public.guard_workspace_ai_closure() from public,anon,authenticated,service_role;
create trigger workspace_ai_closure before insert or update on public.workspace_ai_runs
 for each row execute function public.guard_workspace_ai_closure();

alter function public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) rename to reserve_workspace_ai_run_before_closure;
revoke all on function public.reserve_workspace_ai_run_before_closure(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated,service_role;
create function public.reserve_workspace_ai_run(p_id uuid,p_org_id uuid,p_actor_id uuid,p_hash text,p_target jsonb,p_prompt text,p_tariff jsonb,p_max_credits integer,p_max_cost integer)
 returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.guard_uploaded_document_organization(p_org_id);
 return public.reserve_workspace_ai_run_before_closure(p_id,p_org_id,p_actor_id,p_hash,p_target,p_prompt,p_tariff,p_max_credits,p_max_cost);
end; $$;
revoke all on function public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_workspace_ai_run(uuid,uuid,uuid,text,jsonb,text,jsonb,integer,integer) to service_role;

create function public.cancel_workspace_ai_on_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'closing' then return new; end if;
 if tg_op='UPDATE' and old.state='closing' then return new; end if;
 -- Closure already owns the organization lock. Settlement owns its policy/run
 -- locks independently; reject busy rows retryably instead of inverting locks.
 begin
   perform 1 from public.workspace_ai_runs where org_id=new.org_id and settled_at is null for update nowait;
 exception when lock_not_available then raise exception 'AI run is changing; retry closure' using errcode='40001'; end;
 update public.workspace_ai_runs set cancel_requested_at=coalesce(cancel_requested_at,clock_timestamp())
 where org_id=new.org_id and settled_at is null;
 return new;
end; $$;
revoke all on function public.cancel_workspace_ai_on_closure() from public,anon,authenticated,service_role;
create trigger organization_closure_cancel_ai after insert or update of state on public.organization_closures
 for each row execute function public.cancel_workspace_ai_on_closure();
comment on function public.cancel_workspace_ai_on_closure() is
 'Durable cancellation suppresses future claims, research rounds and successful settlement. Existing receipt/settlement retains measured or uncertain provider cost with zero canceled customer charge. Canceling organization closure never restarts a run.';
commit;
