alter table public.organization_finance_opportunities
  add column if not exists report jsonb not null default '{"version":1,"blocks":[]}'::jsonb;

alter table public.organization_finance_opportunities
  add constraint organization_finance_opportunities_report_check
  check (
    jsonb_typeof(report) = 'object'
    and report ? 'blocks'
    and report @> '{"version":1}'::jsonb
    and jsonb_typeof(report->'blocks') = 'array'
    and jsonb_array_length(report->'blocks') <= 12
    and octet_length(report::text) <= 200000
  );
