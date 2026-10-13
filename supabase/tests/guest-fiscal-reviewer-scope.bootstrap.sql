-- Minimal dependent tables for the policy matrix. The application table above
-- comes from its real migration. Simulate permissive host-organization access
-- deliberately: the restrictive guest policies must still prevent disclosure.
create table public.fiscal_sponsorship_reviews(project_id uuid);
create table public.fiscal_sponsorship_documents(project_id uuid);
create table public.fiscal_sponsorship_signature_packets(project_id uuid);
do $$ declare relation text; begin
  foreach relation in array array['organization_projects','fiscal_sponsorship_applications',
    'fiscal_sponsorship_reviews','fiscal_sponsorship_documents',
    'fiscal_sponsorship_signature_packets','fiscal_sponsorship_events'] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('grant select on public.%I to authenticated', relation);
    execute format('create policy test_host_org_access on public.%I for select to authenticated using (true)', relation);
  end loop;
end $$;
