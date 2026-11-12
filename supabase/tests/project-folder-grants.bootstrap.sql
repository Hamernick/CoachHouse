-- Other recurrence harness migrations do not install the fiscal intake lane.
-- Only its project exclusion lookup is needed; production uses its real table.
create table public.fiscal_guest_submissions(project_id uuid primary key);
alter table public.organization_memberships add column created_at timestamptz not null default clock_timestamp();
