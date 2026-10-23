import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { mapOrganizationFinanceEngagementEvent } from "@/features/workspace-finance/server/engagement-events"
import { mapOrganizationFinanceOpportunity } from "@/features/workspace-finance/server/opportunities"
import { mapOrganizationFinanceRecord } from "@/features/workspace-finance/server/records"

const ROOT = process.cwd()
const migration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260807171000_add_organization_finance_records.sql"
  ),
  "utf8"
)
const opportunitiesMigration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260807172000_add_organization_finance_opportunities.sql"
  ),
  "utf8"
)
const opportunityStagesMigration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260808201500_make_finance_opportunity_stages_factual.sql"
  ),
  "utf8"
)
const stripeConnectionMigration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260808203000_add_finance_stripe_app_connection.sql"
  ),
  "utf8"
)
const engagementMigration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260807173000_add_organization_finance_engagement_events.sql"
  ),
  "utf8"
)
const programLinkMigration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260808145500_link_finance_records_to_programs.sql"
  ),
  "utf8"
)
const reconciliationMigration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260808163500_add_finance_record_reconciliation.sql"
  ),
  "utf8"
)
const correctionMigration = readFileSync(
  join(
    ROOT,
    "supabase/migrations/20260808175223_add_finance_record_corrections.sql"
  ),
  "utf8"
)
const tableIndex = readFileSync(
  join(ROOT, "src/lib/supabase/schema/tables/index.ts"),
  "utf8"
)
const functions = readFileSync(
  join(ROOT, "src/lib/supabase/schema/functions.ts"),
  "utf8"
)
const recordLoader = readFileSync(
  join(ROOT, "src/features/workspace-finance/server/records.ts"),
  "utf8"
)
const opportunityLoader = readFileSync(
  join(ROOT, "src/features/workspace-finance/server/opportunities.ts"),
  "utf8"
)
const engagementLoader = readFileSync(
  join(ROOT, "src/features/workspace-finance/server/engagement-events.ts"),
  "utf8"
)
const reconciliationRoute = readFileSync(
  join(ROOT, "src/app/api/account/finance-record-evidence/[recordId]/route.ts"),
  "utf8"
)

describe("workspace finance storage contract", () => {
  it("creates constrained organization-scoped access and record tables", () => {
    expect(migration).toContain(
      "create table if not exists public.organization_finance_access"
    )
    expect(migration).toContain(
      "create table if not exists public.organization_finance_records"
    )
    expect(migration).toContain(
      "org_id uuid not null references public.organizations(user_id)"
    )
    expect(migration).toContain("effective_at timestamptz not null")
    expect(migration).toContain("amount_cents bigint not null")
    expect(migration).toContain("check (amount_cents >= 0)")
    expect(migration).toContain("currency_code ~ '^[A-Z]{3}$'")
    expect(migration).toContain(
      "source_kind in ('donations', 'grants', 'earned_revenue', 'other')"
    )
    expect(migration).toContain("status in ('draft', 'recorded', 'reconciled')")
  })

  it("indexes tenant history, source aggregation, and provider idempotency", () => {
    expect(migration).toContain("organization_finance_access_member_id_idx")
    expect(migration).toContain(
      "organization_finance_records_org_effective_idx"
    )
    expect(migration).toContain(
      "organization_finance_records_org_source_effective_idx"
    )
    expect(migration).toContain("organization_finance_records_external_id_idx")
    expect(migration).toContain(
      "where external_provider is not null and external_record_id is not null"
    )
  })

  it("stores signed Stripe installs and immutable provider evidence without credentials", () => {
    expect(stripeConnectionMigration).toContain(
      "create table if not exists public.organization_finance_stripe_connections"
    )
    expect(stripeConnectionMigration).toContain(
      "create table if not exists public.organization_finance_stripe_install_intents"
    )
    expect(stripeConnectionMigration).toContain(
      "create table if not exists public.organization_finance_record_provider_evidence"
    )
    expect(stripeConnectionMigration).toContain(
      "alter table public.organization_finance_stripe_connections force row level security"
    )
    expect(stripeConnectionMigration).toContain(
      "grant select on table public.organization_finance_stripe_connections to authenticated"
    )
    expect(stripeConnectionMigration).not.toContain("access_token")
    expect(stripeConnectionMigration).not.toContain("refresh_token")
    expect(tableIndex).toContain(
      "organization_finance_stripe_connections: OrganizationFinanceStripeConnectionsTable"
    )
  })

  it("links records only to programs owned by the same organization", () => {
    expect(programLinkMigration).toContain(
      "add column if not exists program_id"
    )
    expect(programLinkMigration).toContain("foreign key (program_id)")
    expect(programLinkMigration).toContain("references public.programs (id)")
    expect(programLinkMigration).toContain("on delete set null")
    expect(programLinkMigration).toContain(
      "validate_finance_record_program_org"
    )
    expect(programLinkMigration).toContain("program.user_id = new.org_id")
    expect(programLinkMigration).toContain(
      "organization_finance_records_program_org_effective_idx"
    )
  })

  it("requires explicit Finance access and grants authenticated users read only", () => {
    expect(migration).toContain(
      "alter table public.organization_finance_access force row level security"
    )
    expect(migration).toContain(
      "alter table public.organization_finance_records force row level security"
    )
    expect(migration).toContain(
      "create or replace function public.can_view_organization_finance"
    )
    expect(migration).toContain("security definer")
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain("access.member_id = (select auth.uid())")
    expect(migration).toContain(
      "grant select on table public.organization_finance_records to authenticated"
    )
    expect(migration).not.toContain(
      "grant select, insert, update, delete\n  on table public.organization_finance_records"
    )
    expect(migration).not.toContain("public.is_admin()")
  })

  it("registers generated-schema table and function contracts", () => {
    expect(tableIndex).toContain(
      "organization_finance_access: OrganizationFinanceAccessTable"
    )
    expect(tableIndex).toContain(
      "organization_finance_records: OrganizationFinanceRecordsTable"
    )
    expect(functions).toContain("can_view_organization_finance:")
    expect(functions).toContain("target_org_id: string")
    expect(tableIndex).toContain(
      "organization_finance_record_evidence: OrganizationFinanceRecordEvidenceTable"
    )
    expect(tableIndex).toContain(
      "organization_finance_record_events: OrganizationFinanceRecordEventsTable"
    )
    expect(tableIndex).toContain(
      "organization_finance_record_corrections: OrganizationFinanceRecordCorrectionsTable"
    )
    expect(functions).toContain("reconcile_organization_finance_record:")
    expect(functions).toContain("correct_organization_finance_record:")
  })

  it("preserves verified originals and creates linked verified replacements", () => {
    expect(correctionMigration).toContain(
      "create table if not exists public.organization_finance_record_corrections"
    )
    expect(correctionMigration).toContain("unique (original_record_id)")
    expect(correctionMigration).toContain("unique (replacement_record_id)")
    expect(correctionMigration).toContain(
      "foreign key (original_record_id, org_id)"
    )
    expect(correctionMigration).toContain(
      "foreign key (replacement_record_id, org_id)"
    )
    expect(correctionMigration).toContain(
      "create or replace function public.correct_organization_finance_record"
    )
    expect(correctionMigration).toContain("v_original.status <> 'reconciled'")
    expect(correctionMigration).toContain("'reconciled',")
    expect(correctionMigration).toContain("'corrected',")
    expect(correctionMigration).toContain("p_replacement_record_id")
    expect(correctionMigration).toContain("for update;")
    expect(correctionMigration).toContain("to service_role;")
    expect(correctionMigration).toContain("new.program_id is distinct")
    expect(correctionMigration).toContain(
      "Finance record corrections are immutable"
    )
  })

  it("stores private immutable reconciliation evidence and audit events", () => {
    expect(reconciliationMigration).toContain("'finance-evidence'")
    expect(reconciliationMigration).toContain("false,")
    expect(reconciliationMigration).toContain("10485760")
    expect(reconciliationMigration).toContain(
      "create table if not exists public.organization_finance_record_evidence"
    )
    expect(reconciliationMigration).toContain(
      "constraint organization_finance_record_evidence_record_key unique (record_id)"
    )
    expect(reconciliationMigration).toContain("foreign key (record_id, org_id)")
    expect(reconciliationMigration).toContain(
      "references public.organization_finance_records(id, org_id)"
    )
    expect(reconciliationMigration).toContain("file_sha256 ~ '^[a-f0-9]{64}$'")
    expect(reconciliationMigration).toContain(
      "create table if not exists public.organization_finance_record_events"
    )
    expect(reconciliationMigration).toContain("before update or delete")
    expect(reconciliationMigration).toContain(
      "Reconciled Finance record fields are immutable"
    )
    expect(reconciliationMigration).toContain("force row level security")
    expect(reconciliationMigration).toContain(
      "public.can_view_organization_finance(org_id)"
    )
    expect(reconciliationMigration).toContain(
      "grant select on table public.organization_finance_record_evidence to authenticated"
    )
    expect(reconciliationMigration).not.toContain(
      "grant insert on table public.organization_finance_record_evidence to authenticated"
    )
  })

  it("reconciles evidence, status, and audit event in one database transition", () => {
    expect(reconciliationMigration).toContain(
      "create or replace function public.reconcile_organization_finance_record"
    )
    expect(reconciliationMigration).toContain("for update;")
    expect(reconciliationMigration).toContain("v_record.status <> 'recorded'")
    expect(reconciliationMigration).toContain(
      "insert into public.organization_finance_record_evidence"
    )
    expect(reconciliationMigration).toContain("status = 'reconciled'")
    expect(reconciliationMigration).toContain(
      "insert into public.organization_finance_record_events"
    )
    expect(reconciliationMigration).toContain("to service_role;")
    expect(reconciliationMigration).toContain(
      "from public, anon, authenticated;"
    )
  })

  it("validates, hashes, and privately serves reconciliation evidence", () => {
    expect(reconciliationRoute).toContain("sameOrigin(request)")
    expect(reconciliationRoute).toContain("MAX_BYTES = 10 * 1024 * 1024")
    expect(reconciliationRoute).toContain("matchesFileSignature(bytes, mime)")
    expect(reconciliationRoute).toContain('createHash("sha256")')
    expect(reconciliationRoute).toContain("from(BUCKET)")
    expect(reconciliationRoute).toContain("upsert: false")
    expect(reconciliationRoute).toContain(
      '"reconcile_organization_finance_record"'
    )
    expect(reconciliationRoute).toContain(
      '"correct_organization_finance_record"'
    )
    expect(reconciliationRoute).toContain("export async function PATCH")
    expect(reconciliationRoute).toContain("remove([storagePath])")
    expect(reconciliationRoute).toContain("canViewWorkspaceFinance")
    expect(reconciliationRoute).toContain("context.activeOrg.orgId")
    expect(reconciliationRoute).toContain(
      '"Cache-Control": "private, no-store, max-age=0"'
    )
    expect(reconciliationRoute).not.toContain("createSignedUrl")
  })

  it("maps private storage rows into the limited drawer read model", () => {
    expect(recordLoader).toContain('.eq("org_id", orgId)')
    expect(recordLoader).toContain('.order("effective_at"')
    expect(recordLoader).toContain(".limit(500)")
    expect(recordLoader).not.toContain("external_record_id:")

    expect(
      mapOrganizationFinanceRecord({
        id: "record",
        org_id: "organization",
        program_id: "program",
        effective_at: "2026-08-07T17:00:00.000Z",
        record_type: "donation",
        direction: "in",
        source_kind: "donations",
        source_label: "Stripe",
        amount_cents: 5_000,
        currency_code: "USD",
        status: "reconciled",
        external_provider: "stripe",
        external_record_id: "pi_private",
        created_source: "stripe",
        created_by: null,
        reconciled_at: "2026-08-07T17:01:00.000Z",
        created_at: "2026-08-07T17:01:00.000Z",
        updated_at: "2026-08-07T17:01:00.000Z",
      })
    ).toEqual({
      id: "record",
      programId: "program",
      effectiveAt: "2026-08-07T17:00:00.000Z",
      sourceLabel: "Stripe",
      recordType: "donation",
      typeLabel: "Donation",
      amountCents: 5_000,
      currencyCode: "USD",
      direction: "in",
      status: "reconciled",
      sourceKind: "donations",
    })
  })

  it("stores a broad, minimal organization opportunity queue", () => {
    expect(opportunitiesMigration).toContain(
      "create table if not exists public.organization_finance_opportunities"
    )
    expect(opportunitiesMigration).toContain(
      "org_id uuid not null references public.organizations(user_id)"
    )
    expect(opportunitiesMigration).toContain("due_at timestamptz")
    expect(opportunitiesMigration).toContain(
      "opportunity_type in (\n        'grant',\n        'contract',\n        'sponsorship',\n        'award',\n        'partnership',\n        'other'"
    )
    expect(opportunitiesMigration).toContain(
      "status in ('new', 'reviewing', 'saved', 'dismissed')"
    )
    expect(opportunityStagesMigration).toContain("set status = 'saved'")
    expect(opportunityStagesMigration).toContain("'applied'")
    expect(opportunityStagesMigration).toContain("'awarded'")
    expect(opportunityStagesMigration).toContain("'not_awarded'")
    expect(opportunitiesMigration).not.toContain("match_score")
    expect(opportunitiesMigration).not.toContain("ai_reasoning")
  })

  it("indexes the active queue and provider idempotency", () => {
    expect(opportunitiesMigration).toContain(
      "organization_finance_opportunities_active_queue_idx"
    )
    expect(opportunitiesMigration).toContain("where status <> 'dismissed'")
    expect(opportunitiesMigration).toContain(
      "organization_finance_opportunities_external_id_idx"
    )
    expect(opportunitiesMigration).toContain(
      "org_id,\n    external_provider,\n    external_opportunity_id"
    )
  })

  it("protects opportunities with the same read-only Finance boundary", () => {
    expect(opportunitiesMigration).toContain(
      "alter table public.organization_finance_opportunities force row level security"
    )
    expect(opportunitiesMigration).toContain(
      "using ((select public.can_view_organization_finance(org_id)))"
    )
    expect(opportunitiesMigration).toContain(
      "grant select on table public.organization_finance_opportunities"
    )
    expect(opportunitiesMigration).not.toContain(
      "grant select, insert, update, delete"
    )
    expect(opportunitiesMigration).not.toContain("public.is_admin()")
    expect(tableIndex).toContain(
      "organization_finance_opportunities: OrganizationFinanceOpportunitiesTable"
    )
  })

  it("maps only active opportunity display fields into the drawer", () => {
    expect(opportunityLoader).toContain('.eq("org_id", orgId)')
    expect(opportunityLoader).toContain('.neq("status", "dismissed")')
    expect(opportunityLoader).toContain('.order("due_at"')
    expect(opportunityLoader).toContain(".limit(100)")
    expect(opportunityLoader).not.toContain("external_opportunity_id:")

    expect(
      mapOrganizationFinanceOpportunity({
        id: "opportunity",
        org_id: "organization",
        title: "Community facilities contract",
        source_label: "City procurement portal",
        opportunity_type: "contract",
        due_at: "2026-09-01T16:00:00.000Z",
        status: "applied",
        external_provider: "city-portal",
        external_opportunity_id: "private-reference",
        source_id: null,
        discovered_at: "2026-08-07T17:20:00.000Z",
        created_at: "2026-08-07T17:20:00.000Z",
        updated_at: "2026-08-07T17:20:00.000Z",
      })
    ).toEqual({
      id: "opportunity",
      title: "Community facilities contract",
      source: "City procurement portal",
      origin: "suggested",
      report: { version: 1, blocks: [] },
      sources: [],
      updatedAt: "2026-08-07T17:20:00.000Z",
      dueAt: "2026-09-01T16:00:00.000Z",
      discoveredAt: "2026-08-07T17:20:00.000Z",
      status: "applied",
    })

    expect(
      mapOrganizationFinanceOpportunity({
        id: "dismissed",
        org_id: "organization",
        title: "Dismissed opportunity",
        source_label: null,
        opportunity_type: "other",
        due_at: null,
        status: "dismissed",
        external_provider: "provider",
        external_opportunity_id: "dismissed-reference",
        source_id: null,
        discovered_at: "2026-08-07T17:20:00.000Z",
        created_at: "2026-08-07T17:20:00.000Z",
        updated_at: "2026-08-07T17:20:00.000Z",
      })
    ).toBeNull()
  })

  it("stores only the Finance engagement stages needed by History", () => {
    expect(engagementMigration).toContain(
      "create table if not exists public.organization_finance_engagement_events"
    )
    expect(engagementMigration).toContain(
      "event_type in ('view', 'click', 'conversion')"
    )
    expect(engagementMigration).toContain(
      "finance_record_id uuid references public.organization_finance_records(id)"
    )
    expect(engagementMigration).not.toContain("\n  user_id uuid")
    expect(engagementMigration).not.toContain("\n  visitor_id")
    expect(engagementMigration).not.toContain("\n  metadata")
  })

  it("indexes Finance engagement history, funnels, and event idempotency", () => {
    expect(engagementMigration).toContain(
      "organization_finance_engagement_events_org_occurred_idx"
    )
    expect(engagementMigration).toContain(
      "organization_finance_engagement_events_org_type_occurred_idx"
    )
    expect(engagementMigration).toContain(
      "organization_finance_engagement_events_external_id_idx"
    )
    expect(engagementMigration).toContain(
      "org_id,\n    external_provider,\n    external_event_id"
    )
  })

  it("keeps Finance engagement data tenant-scoped and read only", () => {
    expect(engagementMigration).toContain(
      "alter table public.organization_finance_engagement_events\n  force row level security"
    )
    expect(engagementMigration).toContain(
      "using ((select public.can_view_organization_finance(org_id)))"
    )
    expect(engagementMigration).toContain(
      "grant select on table public.organization_finance_engagement_events"
    )
    expect(engagementMigration).not.toContain(
      "grant select, insert, update, delete"
    )
    expect(engagementMigration).not.toContain("public.is_admin()")
    expect(tableIndex).toContain(
      "organization_finance_engagement_events: OrganizationFinanceEngagementEventsTable"
    )
  })

  it("maps engagement events into nonfinancial History rows", () => {
    expect(engagementLoader).toContain('.eq("org_id", orgId)')
    expect(engagementLoader).toContain('.order("occurred_at"')
    expect(engagementLoader).toContain(".limit(500)")
    expect(engagementLoader).not.toContain("external_event_id:")

    expect(
      mapOrganizationFinanceEngagementEvent({
        id: "event",
        org_id: "organization",
        occurred_at: "2026-08-07T17:30:00.000Z",
        event_type: "click",
        source_label: "Organization map profile",
        surface: "public_map",
        finance_record_id: null,
        external_provider: "coach_house",
        external_event_id: "private-event-reference",
        created_at: "2026-08-07T17:30:00.000Z",
      })
    ).toEqual({
      id: "engagement:event",
      effectiveAt: "2026-08-07T17:30:00.000Z",
      sourceLabel: "Organization map profile",
      typeLabel: "Click",
      amountCents: null,
      direction: null,
      status: null,
      sourceKind: null,
    })
  })
})
