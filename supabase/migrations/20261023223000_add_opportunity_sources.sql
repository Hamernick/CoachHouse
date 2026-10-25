alter table public.organization_finance_opportunities
  add column if not exists sources jsonb not null default '[]'::jsonb
  check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) <= 20);
comment on column public.organization_finance_opportunities.sources is
  'Typed source references. Internal titles and previews are resolved with the viewer RLS client, never persisted as private snapshots.';
notify pgrst, 'reload schema';
