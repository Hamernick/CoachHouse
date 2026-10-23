-- Account discovery reads only that owner's recent explicitly claimed records.
create index fiscal_guest_linked_applicant_recent_idx
  on public.fiscal_guest_submissions(claimed_user_id,created_at desc,id)
  where claimed_user_id is not null;
-- Rollback: drop index public.fiscal_guest_linked_applicant_recent_idx;
