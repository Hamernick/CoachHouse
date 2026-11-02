\set ON_ERROR_STOP on
\ir organization-closure-people-fixture.sql
-- Minimal omitted program dependency; actual finance tables, constraints,
-- functions, RLS and retention triggers use the production migration chain.
create table public.programs(id uuid primary key,user_id uuid references public.organizations(user_id));
\ir ../migrations/20260807171000_add_organization_finance_records.sql
\ir ../migrations/20260808145500_link_finance_records_to_programs.sql
\ir ../migrations/20260808163500_add_finance_record_reconciliation.sql
\ir ../migrations/20260808175223_add_finance_record_corrections.sql
\ir ../migrations/20260808203000_add_finance_stripe_app_connection.sql
\ir ../migrations/20260813153500_require_board_membership_for_finance_access.sql
set check_function_bodies=on;
\ir ../migrations/20261102080000_organization_closure_finance_records.sql
grant select,insert,update,delete on public.organization_finance_access,public.organization_finance_records,
 public.organization_finance_record_evidence,public.organization_finance_record_events,
 public.organization_finance_record_corrections to service_role;
create function public.fixture_closure_finance() returns void language plpgsql as $$
begin
 truncate public.organization_finance_records,public.organization_finance_access,public.organization_finance_stripe_connections cascade;
 perform public.fixture_closure_people();
 insert into public.organization_finance_records(id,org_id,effective_at,record_type,direction,source_kind,source_label,amount_cents,created_by)
 values(public.fixture_form_id(910),public.fixture_form_id(1),now(),'donation','in','donations','Recorded',100,public.fixture_form_id(12)),
       (public.fixture_form_id(911),public.fixture_form_id(2),now(),'donation','in','donations','Other',200,public.fixture_form_id(12)),
       (public.fixture_form_id(912),public.fixture_form_id(1),now(),'donation','in','donations','Reconciled',300,public.fixture_form_id(1));
 update public.organization_finance_records set status='reconciled',reconciled_at=now() where id=public.fixture_form_id(912);
 insert into public.organization_finance_access(org_id,member_id,granted_by)
 values(public.fixture_form_id(1),public.fixture_form_id(5),public.fixture_form_id(1)),
       (public.fixture_form_id(1),public.fixture_form_id(12),public.fixture_form_id(1));
 insert into public.organization_finance_stripe_connections(org_id,stripe_account_id,stripe_user_id,livemode,default_record_type,connected_by)
 values(public.fixture_form_id(1),'acct_fixture','fixture',false,'donation',public.fixture_form_id(1));
end; $$;
create function public.fixture_finance_reconcile() returns jsonb language sql as $$
 select public.reconcile_organization_finance_record(public.fixture_form_id(1),public.fixture_form_id(1),public.fixture_form_id(910),
 'receipt','fixture/receipt.pdf','receipt.pdf','application/pdf',10,repeat('a',64));
$$;
create function public.fixture_finance_correct() returns jsonb language sql as $$
 select public.correct_organization_finance_record(public.fixture_form_id(1),public.fixture_form_id(1),public.fixture_form_id(912),public.fixture_form_id(913),
 null,now(),'donation','in','donations','Corrected',350,'USD','Correction','receipt','fixture/correction.pdf','correction.pdf','application/pdf',10,repeat('b',64));
$$;
create function public.fixture_finance_import() returns jsonb language sql as $$
 select public.import_organization_finance_stripe_records(public.fixture_form_id(1),public.fixture_form_id(1),'acct_fixture',
 jsonb_build_array(jsonb_build_object('effectiveAt',now(),'recordType','donation','direction','in','sourceKind','donations',
 'sourceLabel','Imported','amountCents',400,'currencyCode','USD','externalRecordId','txn_fixture','payloadSha256',repeat('c',64))));
$$;
