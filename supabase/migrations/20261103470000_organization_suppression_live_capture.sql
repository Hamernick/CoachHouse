-- Historical recovery/export qualification is deferred for MVP. Ordinary live
-- revocation/deletion must not depend on the archived export envelope's capacity.
-- Keep every source-local event and its integrity checks; do not prune/reset or
-- claim independently retained history. The operator exporter still rejects
-- histories exceeding 1000 events or 1MiB until recovery is explicitly revisited.
begin;
lock table public.organization_suppression_capture_state,
 public.organization_suppression_events in access exclusive mode;

create or replace function public.assert_organization_suppression_capacity() returns void
 language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare capture public.organization_suppression_capture_state%rowtype;
 total bigint; last_sequence bigint;
begin
 begin
  select * into strict capture from public.organization_suppression_capture_state
   where singleton for update nowait;
 exception when lock_not_available then
  raise exception 'Suppression capture busy; retry transaction' using errcode='40001';
 end;
 select count(*),coalesce(max(sequence),0) into total,last_sequence
  from public.organization_suppression_events;
 if total<>capture.high_water or last_sequence<>capture.high_water then
  raise exception 'Suppression history requires reconciliation' using errcode='40001';
 end if;
end $$;
revoke all on function public.assert_organization_suppression_capacity()
 from public,anon,authenticated,service_role;
comment on function public.assert_organization_suppression_capacity() is
 'MVP live-capture integrity only. Keeps singleton serialization and contiguous high-water history; no export-size admission limit. Historical recovery/export qualification deferred; the unchanged private exporter retains its bounded refusal. Source-local event growth is retained, not pruned or independently durable.';

-- Preserve the existing statement trigger identity required by capture consumers.
-- Existing corrupt history remains a blocker; oversized coherent history does not.
select public.assert_organization_suppression_capacity();
commit;
