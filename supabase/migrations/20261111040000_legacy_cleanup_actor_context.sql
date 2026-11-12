-- Storage forwards the server's verified actor header only on the actor-bound
-- service client. Preserve the exact support context admitted by reservation;
-- a paid organization does not imply that its support actor is an org member.
begin;
alter table public.legacy_document_cleanup add column claimed_actor_id uuid,
  add column claimed_support boolean not null default false;

do $$
declare body text; previous text; replacement text;
begin
  body:=pg_get_functiondef('public.reserve_legacy_document_cleanup(uuid,text,uuid,boolean)'::regprocedure);
  previous:='set claimed_at=clock_timestamp() where storage_path=item.storage_path';
  replacement:='set claimed_at=clock_timestamp(),claimed_actor_id=p_actor,claimed_support=p_support where storage_path=item.storage_path';
  if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected legacy cleanup reservation';end if;
  execute replace(body,previous,replacement);

  body:=pg_get_functiondef('public.guard_legacy_cleanup_storage()'::regprocedure);
  previous:=$old$      if auth.role()='service_role' then
        perform public.assert_document_cleanup_authority(item.org_id,public.organization_activity_actor_id(),
          not public.has_workspace_paid_features(item.org_id));
      end if;$old$;
  replacement:=$new$      if auth.role() is distinct from 'service_role' or item.claimed_actor_id is null
        or item.claimed_actor_id is distinct from public.organization_activity_actor_id() then
        raise exception 'Verified reserved cleanup actor required.' using errcode='42501';end if;
      perform public.assert_document_cleanup_authority(item.org_id,item.claimed_actor_id,item.claimed_support);$new$;
  if (length(body)-length(replace(body,previous,'')))/length(previous)<>1 then raise exception 'Expected legacy Storage admission';end if;
  execute replace(body,previous,replacement);
end $$;
comment on function public.guard_legacy_cleanup_storage() is
  'Only actor-bound service Storage cleanup with a durable exact-path reservation. Rechecks current parent, support/paid and folder authority. The original migration transport comment is superseded; caller-session Storage omits the required service actor header.';
commit;
-- No backfill guesses an actor. Existing pending receipts acquire context on
-- their next authorized reserve call; completed receipts stay complete.
