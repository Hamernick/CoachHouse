-- Serialize all joint-coach reservations, including holds during checkout.
-- Existing confirmation/reschedule functions use the same lock. No data rewrite.
create or replace function public.guard_coaching_booking_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('coaching-joint-calendar', 0));

  if new.status not in ('confirmed', 'held', 'pending_payment') then
    return new;
  end if;
  if new.status <> 'confirmed' and new.hold_expires_at <= now() then
    return new;
  end if;

  if exists (
    select 1 from public.coaching_bookings b
    where b.id <> new.id
      and (b.status = 'confirmed' or (
        b.status in ('held', 'pending_payment')
        and (b.hold_expires_at is null or b.hold_expires_at > now())
      ))
      and b.starts_at < new.ends_at
      and b.ends_at > new.starts_at
  ) then
    raise exception using
      errcode = '23P01',
      message = 'That slot was just taken. Pick another time.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_coaching_booking_conflicts() from public, anon, authenticated;
drop trigger if exists guard_coaching_booking_conflicts on public.coaching_bookings;
create trigger guard_coaching_booking_conflicts
before insert or update of starts_at, ends_at, status, hold_expires_at
on public.coaching_bookings
for each row execute function public.guard_coaching_booking_conflicts();
