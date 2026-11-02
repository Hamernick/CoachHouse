-- Keep every committed capture exportable by the bounded retained-history format.
-- Capacity failure rejects the whole canonical operation; it is not a successful
-- revocation. This does not qualify collector freshness or independent durability.
begin;
lock table public.organization_suppression_capture_state,
 public.organization_suppression_events in access exclusive mode;

create function public.assert_organization_suppression_capacity() returns void
 language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare capture public.organization_suppression_capture_state%rowtype;
 total bigint; last_sequence bigint; envelope jsonb;
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
 if total>1000 then
  raise exception 'Suppression capacity exhausted; operation not committed' using errcode='54000';
 end if;
 -- Match the existing UTC exporter including its envelope and JSONB whitespace.
 -- Do not call that operator-only exporter from an application-owned transaction.
 select jsonb_build_object('format','coach-house-suppression-capture-v1',
  'sourceId',capture.source_id,'capturedSince',capture.captured_since,
  'historyRequiresReconciliation',true,'highWater',capture.high_water,
  'events',coalesce(jsonb_agg(public.organization_suppression_event_json(e)
   order by e.sequence),'[]'::jsonb)) into envelope
  from public.organization_suppression_events e;
 if octet_length(envelope::text)>1048576 then
  raise exception 'Suppression byte capacity exhausted; operation not committed' using errcode='54000';
 end if;
end $$;
revoke all on function public.assert_organization_suppression_capacity()
 from public,anon,authenticated,service_role;

create function public.guard_organization_suppression_capacity() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_organization_suppression_capacity();
 return null;
end $$;
revoke all on function public.guard_organization_suppression_capacity()
 from public,anon,authenticated,service_role;
create trigger organization_suppression_capacity after insert
 on public.organization_suppression_events for each statement
 execute function public.guard_organization_suppression_capacity();

alter function public.read_organization_suppression_events()
 rename to read_organization_suppression_events_before_capacity;
revoke all on function public.read_organization_suppression_events_before_capacity()
 from public,anon,authenticated,service_role;
create function public.read_organization_suppression_events() returns jsonb
 language plpgsql security invoker set search_path='' set timezone='UTC' as $$
begin
 if not exists(select 1 from pg_catalog.pg_trigger t
  where t.tgrelid='public.organization_suppression_events'::regclass
   and t.tgname='organization_suppression_capacity'
   and t.tgfoid='public.guard_organization_suppression_capacity()'::regprocedure
   and t.tgenabled in ('O','A') and t.tgtype::integer=4 and not t.tgisinternal
   and t.tgqual is null and t.tgnargs=0 and cardinality(t.tgattr::smallint[])=0) then
  raise exception 'Suppression capacity boundary unavailable' using errcode='42501';
 end if;
 return public.read_organization_suppression_events_before_capacity();
end $$;
revoke all on function public.read_organization_suppression_events()
 from public,anon,authenticated,service_role;

-- Existing oversized/inconsistent histories require explicit reconciliation;
-- installation must not silently truncate, reset or mark them qualified.
select public.assert_organization_suppression_capacity();
commit;
