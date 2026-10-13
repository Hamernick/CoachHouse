-- Keep initial reviewer notifications in the submission transaction.
-- Rollback: drop trigger fiscal_guest_submission_notifications on public.fiscal_sponsorship_events;
-- then drop function public.notify_guest_fiscal_submission(); Existing notifications remain.
create function public.notify_guest_fiscal_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type = 'application_submitted' and exists (
    select 1 from public.fiscal_guest_submissions s where s.project_id = new.project_id
  ) then
    insert into public.notifications(user_id, org_id, actor_id, title, description, href, tone, type, metadata)
    select r.user_id, new.org_id, null, 'New fiscal sponsorship application',
      'A guest application is ready for review.', '/projects/' || new.project_id::text,
      'info', 'fiscal_application_submitted', jsonb_build_object('projectId',new.project_id,'eventId',new.id)
    from public.fiscal_project_reviewers r where r.project_id = new.project_id;
  end if;
  return new;
end $$;
revoke all on function public.notify_guest_fiscal_submission() from public, anon, authenticated;
create trigger fiscal_guest_submission_notifications after insert on public.fiscal_sponsorship_events
for each row execute function public.notify_guest_fiscal_submission();
