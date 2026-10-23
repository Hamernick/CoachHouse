import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  buildWorkspaceFinanceProgramInputs,
  normalizeWorkspaceFinanceInput,
} from "@/features/workspace-finance"
import { buildWorkspaceFinanceActivityItems } from "@/features/workspace-finance/lib/activity"
import {
  createDefaultWorkspaceFinanceCsvColumns,
  mapWorkspaceFinanceCsvRecords,
  normalizeWorkspaceFinanceCsvImportBatch,
} from "@/features/workspace-finance/lib/csv-import"
import { normalizeWorkspaceFinanceManualRecord } from "@/features/workspace-finance/lib/manual-record"
import {
  normalizeWorkspaceFinanceOpportunityIngestionBatch,
  WORKSPACE_FINANCE_OPPORTUNITY_BATCH_LIMIT,
} from "@/features/workspace-finance/lib/opportunity-ingestion"
import {
  buildGrantsGovSearchRequest,
  GRANTS_GOV_ATTRIBUTION_NOTICE,
  GRANTS_GOV_SEARCH_ENDPOINT,
  mapGrantsGovSearchResponse,
} from "@/features/workspace-finance/lib/grants-gov"
import { parseWorkspaceFinanceCsvPreview } from "@/features/workspace-finance/lib/csv-preview"
import { formatWorkspaceFinanceSyncFreshness } from "@/features/workspace-finance/lib/sync-freshness"
import { WORKSPACE_FINANCE_SAMPLE_INPUT } from "@/features/workspace-finance/lib/sample-data"
import { loadWorkspaceFinanceReadModel } from "@/features/workspace-finance/server/read-model"

const ROOT = process.cwd()
const COMPONENTS = join(ROOT, "src/features/workspace-finance/components")
const WORKSPACE_INPUT_SOURCE = join(
  ROOT,
  "src/features/workspace-finance/server/workspace-input.ts"
)
const WORKSPACE_PAGE_SOURCE = join(
  ROOT,
  "src/app/(dashboard)/my-organization/_lib/my-organization-page-content.tsx"
)
const FINANCE_ACTIONS_SOURCE = join(ROOT, "src/actions/workspace-finance.ts")
const FINANCE_ACCESS_SOURCE = join(
  ROOT,
  "src/lib/workspace/workspace-finance-access.ts"
)
const OPPORTUNITY_INGESTION_SOURCE = join(
  ROOT,
  "src/features/workspace-finance/server/ingest-opportunities.ts"
)
const GRANTS_GOV_SOURCE = join(
  ROOT,
  "src/features/workspace-finance/server/grants-gov.ts"
)
const OPPORTUNITY_REGISTRY_MIGRATION = join(
  ROOT,
  "supabase/migrations/20260808142000_add_finance_opportunity_source_registry.sql"
)

function readComponent(name: string) {
  return readFileSync(join(COMPONENTS, name), "utf8")
}

const EMPTY_NORMALIZED_STATE = {
  raisingPrograms: [],
  targetCents: null,
  sources: [],
  sourceTotalCents: null,
  raisedCents: 0,
  opportunities: [],
  opportunitiesState: "idle",
  records: [],
  recordsState: "idle",
}

describe("workspace-finance feature contract", () => {
  it("keeps the embedded Finance surface at the established reading width", () => {
    expect(readComponent("workspace-finance-panel.tsx")).toContain(
      'className="mx-auto h-full min-h-0 w-full max-w-3xl overflow-hidden"'
    )
  })

  it("adapts existing organization programs through one read-only seam", () => {
    expect(
      buildWorkspaceFinanceProgramInputs([
        {
          id: "program",
          title: "Program",
          goal_cents: 250_000,
          raised_cents: 50_000,
          wizard_snapshot: { budgetUsd: "1800.50" },
        },
      ])
    ).toEqual([
      {
        id: "program",
        title: "Program",
        goalCents: 250_000,
        raisedCents: 50_000,
        budgetCents: 180_050,
      },
    ])
  })

  it("loads records and opportunities independently", async () => {
    await expect(
      loadWorkspaceFinanceReadModel({
        programs: [{ id: "program", goalCents: 100_000 }],
        loadRecords: async () => {
          throw new Error("records unavailable")
        },
        loadOpportunities: async () => [
          {
            id: "opportunity",
            title: "Community award",
            status: "new",
          },
        ],
      })
    ).resolves.toEqual({
      programs: [{ id: "program", goalCents: 100_000 }],
      records: undefined,
      recordsState: "error",
      opportunities: [
        {
          id: "opportunity",
          title: "Community award",
          status: "new",
        },
      ],
      opportunitiesState: "ready",
    })
  })

  it("loads the authenticated organization Finance model on the server", () => {
    const loaderSource = readFileSync(WORKSPACE_INPUT_SOURCE, "utf8")
    const pageSource = readFileSync(WORKSPACE_PAGE_SOURCE, "utf8")
    const viewSource = readFileSync(
      join(
        ROOT,
        "src/app/(dashboard)/my-organization/_components/workspace-board/my-organization-workspace-view.tsx"
      ),
      "utf8"
    )

    expect(loaderSource).toContain(
      "buildWorkspaceFinanceProgramInputs(programs)"
    )
    expect(loaderSource).toContain(
      "loadOrganizationFinanceRecords({ orgId, supabase })"
    )
    expect(loaderSource).toContain(
      "loadOrganizationFinanceEngagementEvents({ orgId, supabase })"
    )
    expect(loaderSource).toContain(
      "loadOrganizationFinanceOpportunities({ orgId, supabase })"
    )
    expect(loaderSource).not.toContain("service_role")
    expect(pageSource).toContain("resolveOptionalAuthenticatedAppContext()")
    expect(pageSource).toContain("const { orgId, role } = activeOrg")
    expect(pageSource).toContain("loadOrganizationWorkspaceFinanceInput({")
    expect(pageSource).toMatch(
      /<MyOrganizationWorkspaceView\b[^>]*financeInput=\{financeInput!?\}/
    )
    expect(viewSource).toMatch(
      /<WorkspaceBoardCanvas\b[^>]*financeInput=\{financeInput\}/
    )
  })

  it("defaults to Activity and preserves an explicit History view", () => {
    expect(normalizeWorkspaceFinanceInput({})).toEqual({
      initialView: "activity",
      ...EMPTY_NORMALIZED_STATE,
    })
    expect(normalizeWorkspaceFinanceInput({ initialView: "history" })).toEqual({
      initialView: "history",
      ...EMPTY_NORMALIZED_STATE,
    })
  })

  it("offers browser-only sample data behind an explicit development switch", () => {
    const viewTabs = readComponent("workspace-finance-view-tabs.tsx")
    const toggle = readComponent("workspace-finance-sample-data-toggle.tsx")
    const sample = normalizeWorkspaceFinanceInput(
      WORKSPACE_FINANCE_SAMPLE_INPUT
    )

    expect(sample.raisedCents).toBe(3_800_000)
    expect(sample.targetCents).toBe(7_500_000)
    expect(sample.sources).toHaveLength(4)
    expect(sample.opportunities).toHaveLength(3)
    expect(sample.records).toHaveLength(6)
    expect(
      sample.records.find(({ id }) => id === "sample-donation-original")
        ?.correction?.state
    ).toBe("corrected")
    expect(
      sample.records.find(({ id }) => id === "sample-donation-replacement")
        ?.correction?.state
    ).toBe("replacement")
    expect(
      sample.records.find(({ id }) => id === "sample-recorded-donation")?.status
    ).toBe("recorded")
    expect(viewTabs).toContain('process.env.NODE_ENV === "development"')
    expect(viewTabs).toContain("NEXT_PUBLIC_ENABLE_FINANCE_SAMPLE_DATA")
    expect(viewTabs).toContain("useState(false)")
    expect(viewTabs).not.toContain("next/navigation")
    expect(viewTabs).not.toContain("financeSample")
    expect(viewTabs).toContain("disabled={sampleDataEnabled}")
    expect(toggle).toContain("<Switch")
    expect(toggle).toContain("Show sample Finance data")
  })

  it("uses goals or budgets as targets without treating estimates as raised", () => {
    expect(
      normalizeWorkspaceFinanceInput({
        programs: [
          {
            id: "complete",
            title: "Completed program",
            goalCents: 100_000,
            raisedCents: 125_000,
            budgetCents: 90_000,
          },
          {
            id: "raising",
            title: "Active program",
            goalCents: 200_000,
            raisedCents: 50_000,
            budgetCents: 180_000,
          },
          {
            id: "budget-only",
            title: "Budget only",
            budgetCents: 75_000,
          },
          {
            id: "raised-only",
            title: "Raised without target",
            raisedCents: 25_000,
          },
          { id: "unfunded", title: "No finance values" },
        ],
      })
    ).toEqual({
      initialView: "activity",
      raisingPrograms: [
        expect.objectContaining({
          id: "raising",
          targetCents: 200_000,
          targetSource: "goal",
          status: "raising",
          remainingCents: 200_000,
          progressPercent: 0,
        }),
        expect.objectContaining({
          id: "budget-only",
          status: "raising",
          budgetCents: 75_000,
          targetCents: 75_000,
          targetSource: "budget",
          remainingCents: 75_000,
        }),
        expect.objectContaining({
          id: "complete",
          targetCents: 100_000,
          targetSource: "goal",
          status: "raising",
          remainingCents: 100_000,
          progressPercent: 0,
        }),
      ],
      targetCents: 375_000,
      sources: [],
      sourceTotalCents: null,
      raisedCents: 0,
      opportunities: [],
      opportunitiesState: "idle",
      records: [],
      recordsState: "idle",
    })
  })

  it("combines real source totals and calculates their proportions", () => {
    expect(
      normalizeWorkspaceFinanceInput({
        records: [
          {
            id: "donation",
            effectiveAt: "2026-02-01",
            sourceLabel: "Stripe",
            typeLabel: "Donation",
            amountCents: 60_000,
            direction: "in",
            status: "reconciled",
            sourceKind: "donations",
          },
          {
            id: "grant-one",
            effectiveAt: "2026-02-02",
            sourceLabel: "Foundation one",
            typeLabel: "Grant",
            amountCents: 20_000,
            direction: "in",
            status: "reconciled",
            sourceKind: "grants",
          },
          {
            id: "grant-two",
            effectiveAt: "2026-02-03",
            sourceLabel: "Foundation two",
            typeLabel: "Grant",
            amountCents: 20_000,
            direction: "in",
            status: "reconciled",
            sourceKind: "grants",
          },
          {
            id: "expense",
            effectiveAt: "2026-02-04",
            sourceLabel: "Bank",
            typeLabel: "Expense",
            amountCents: 90_000,
            direction: "out",
            status: "recorded",
            sourceKind: "other",
          },
          {
            id: "draft",
            effectiveAt: "2026-02-05",
            sourceLabel: "Draft import",
            typeLabel: "Donation",
            amountCents: 50_000,
            direction: "in",
            status: "draft",
            sourceKind: "donations",
          },
          {
            id: "recorded-not-verified",
            effectiveAt: "2026-02-05",
            sourceLabel: "Manual record",
            typeLabel: "Donation",
            amountCents: 500_000,
            direction: "in",
            status: "recorded",
            sourceKind: "donations",
          },
          {
            id: "euro",
            effectiveAt: "2026-02-06",
            sourceLabel: "European foundation",
            typeLabel: "Grant",
            amountCents: 75_000,
            currencyCode: "EUR",
            direction: "in",
            status: "recorded",
            sourceKind: "grants",
          },
        ],
      })
    ).toMatchObject({
      sources: [
        {
          kind: "donations",
          label: "Donations",
          amountCents: 60_000,
          percentage: 60,
        },
        {
          kind: "grants",
          label: "Grants",
          amountCents: 40_000,
          percentage: 40,
        },
      ],
      sourceTotalCents: 100_000,
      raisedCents: 100_000,
      recordsState: "ready",
    })
  })

  it("attributes reconciled funding to program targets without changing organization Raised", () => {
    const normalized = normalizeWorkspaceFinanceInput({
      programs: [
        { id: "program-one", title: "Program one", goalCents: 100_000 },
        { id: "program-two", title: "Program two", budgetCents: 50_000 },
      ],
      records: [
        {
          id: "assigned",
          programId: "program-one",
          effectiveAt: "2026-02-01",
          sourceLabel: "Community donor",
          typeLabel: "Donation",
          amountCents: 75_000,
          direction: "in",
          status: "reconciled",
          sourceKind: "donations",
        },
        {
          id: "organization-wide",
          effectiveAt: "2026-02-02",
          sourceLabel: "General fund",
          typeLabel: "Grant",
          amountCents: 50_000,
          direction: "in",
          status: "reconciled",
          sourceKind: "grants",
        },
      ],
    })

    expect(normalized.raisedCents).toBe(125_000)
    expect(normalized.records).toEqual([
      expect.objectContaining({
        id: "organization-wide",
        programTitle: null,
      }),
      expect.objectContaining({
        id: "assigned",
        programTitle: "Program one",
      }),
    ])
    expect(normalized.raisingPrograms).toEqual([
      expect.objectContaining({
        id: "program-one",
        raisedCents: 75_000,
        remainingCents: 25_000,
        progressPercent: 75,
      }),
      expect.objectContaining({
        id: "program-two",
        raisedCents: 0,
        remainingCents: 50_000,
        progressPercent: 0,
      }),
    ])
  })

  it("keeps corrected originals in History while counting only replacements", () => {
    const normalized = normalizeWorkspaceFinanceInput({
      records: [
        {
          id: "original",
          effectiveAt: "2026-08-01T12:00:00.000Z",
          sourceLabel: "Original source",
          typeLabel: "Donation",
          amountCents: 100_000,
          currencyCode: "USD",
          direction: "in",
          status: "reconciled",
          sourceKind: "donations",
          correction: {
            correctionId: "correction",
            correctedAt: "2026-08-02T12:00:00.000Z",
            reason: "Amount corrected",
            relatedRecordId: "replacement",
            state: "corrected",
          },
        },
        {
          id: "replacement",
          effectiveAt: "2026-08-02T12:00:00.000Z",
          sourceLabel: "Corrected source",
          typeLabel: "Donation",
          amountCents: 125_000,
          currencyCode: "USD",
          direction: "in",
          status: "reconciled",
          sourceKind: "donations",
          correction: {
            correctionId: "correction",
            correctedAt: "2026-08-02T12:00:00.000Z",
            reason: "Amount corrected",
            relatedRecordId: "original",
            state: "replacement",
          },
        },
      ],
    })

    expect(normalized.records).toHaveLength(2)
    expect(normalized.raisedCents).toBe(125_000)
    expect(normalized.sources).toEqual([
      expect.objectContaining({ kind: "donations", amountCents: 125_000 }),
    ])
  })

  it("orders opportunities by state and History by newest date", () => {
    const normalized = normalizeWorkspaceFinanceInput({
      opportunities: [
        { id: "saved", title: " Saved match ", status: "saved" },
        { id: "new", title: "New match", status: "new" },
      ],
      records: [
        {
          id: "older",
          effectiveAt: "2026-01-01",
          sourceLabel: " Bank ",
          typeLabel: "Grant",
          amountCents: 100,
          direction: "in",
          status: "recorded",
        },
        {
          id: "view",
          effectiveAt: "2026-01-15",
          sourceLabel: "Organization profile",
          typeLabel: "View",
        },
        {
          id: "newer",
          effectiveAt: "2026-02-01",
          sourceLabel: "Stripe",
          typeLabel: "Donation",
          amountCents: 200,
          direction: "in",
          status: "reconciled",
        },
      ],
    })

    expect(normalized.opportunitiesState).toBe("ready")
    expect(normalized.opportunities.map(({ id }) => id)).toEqual([
      "new",
      "saved",
    ])
    expect(normalized.opportunities[1]?.title).toBe("Saved match")
    expect(normalized.recordsState).toBe("ready")
    expect(normalized.records.map(({ id }) => id)).toEqual([
      "newer",
      "view",
      "older",
    ])
    expect(normalized.records[1]).toMatchObject({
      sourceLabel: "Organization profile",
      typeLabel: "View",
      amountCents: null,
    })
  })

  it("builds one chronological Activity feed without counting opportunities as money", () => {
    const items = buildWorkspaceFinanceActivityItems({
      opportunities: [
        {
          id: "grant-search",
          title: "Community grant",
          discoveredAt: "2026-02-02T12:00:00.000Z",
          status: "new",
        },
      ],
      records: [
        {
          id: "donation",
          effectiveAt: "2026-02-03T12:00:00.000Z",
          sourceLabel: "Stripe",
          typeLabel: "Donation",
          amountCents: 10_000,
          direction: "in",
          status: "recorded",
          sourceKind: "donations",
        },
      ],
    })

    expect(items.map(({ id }) => id)).toEqual([
      "record:donation",
      "opportunity:grant-search",
    ])
    expect(items[1]).toMatchObject({ kind: "opportunity" })
  })

  it("uses one left-aligned segmented view control", () => {
    const source = readComponent("workspace-finance-view-tabs.tsx")

    expect(source).toContain('aria-label="Finance views"')
    expect(source).toContain('value="activity"')
    expect(source).toContain('value="history"')
    expect(source).toContain("Activity")
    expect(source).toContain("History")
    expect(source).toContain(
      "mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between"
    )
    expect(source).toContain("sm:px-6")
    expect(source).toContain("h-9 w-fit grid-cols-2 rounded-full")
    expect(source).toContain("group-data-[orientation=horizontal]/tabs:!h-9")
    expect(source).toContain("h-8 rounded-full px-3 text-xs")
    expect(source).toContain("<WorkspaceFinanceConnections")
  })

  it("keeps CSV built in and Stripe optional in one connections popover", () => {
    const actions = readFileSync(FINANCE_ACTIONS_SOURCE, "utf8")
    const source = readComponent("workspace-finance-connections.tsx")
    const stripe = readComponent("workspace-finance-stripe-connection.tsx")
    const manual = readComponent("workspace-finance-manual-record-dialog.tsx")
    const manualAction = actions.slice(
      actions.indexOf("createWorkspaceFinanceManualRecord")
    )

    expect(source).toContain("<Popover open={popoverOpen}")
    expect(source).toContain("Connections")
    expect(source).toContain("CSV import")
    expect(source).toContain('accept=".csv,text/csv"')
    expect(source).toContain("Bank or accounting export")
    expect(source).toContain("<WorkspaceFinanceStripeConnection")
    expect(stripe).toContain("Stripe")
    expect(stripe).toContain("Read-only transaction sync")
    expect(stripe).toContain("Read-only source")
    expect(stripe).toContain("formatWorkspaceFinanceSyncFreshness")
    expect(stripe).toContain('aria-live="polite"')
    expect(stripe).toContain("Continue to Stripe")
    expect(stripe).not.toContain("OAuth")
    expect(source).toContain("Manual record")
    expect(source).toContain("<WorkspaceFinanceManualRecordDialog")
    expect(manual).toContain(
      "Record money that already moved outside Coach House"
    )
    expect(manual).toContain("Amount (USD)")
    expect(manual).toContain("Organization-wide")
    expect(manual).toContain("createWorkspaceFinanceManualRecord")
    expect(manual).not.toContain("next/navigation")
    expect(actions).toContain("createWorkspaceFinanceManualRecord")
    expect(actions).toContain('status: "recorded"')
    expect(actions).toContain('created_source: "manual"')
    expect(manualAction.indexOf("canManageFinance")).toBeLessThan(
      manualAction.indexOf("createSupabaseAdminClient()")
    )
    expect(manualAction).toContain('.eq("user_id", activeOrg.orgId)')
  })

  it("labels Stripe source freshness without implying money movement", () => {
    expect(
      formatWorkspaceFinanceSyncFreshness({
        lastSyncedAt: "2026-08-12T18:30:00.000Z",
        status: "succeeded",
        locale: "en-US",
      })
    ).toMatch(/^Last synced Aug 12, 2026, /)
    expect(
      formatWorkspaceFinanceSyncFreshness({
        lastSyncedAt: "2026-08-12T18:30:00.000Z",
        status: "failed",
        locale: "en-US",
      })
    ).toMatch(/^Sync failed · Last synced Aug 12, 2026, /)
    expect(formatWorkspaceFinanceSyncFreshness({ status: "running" })).toBe(
      "Sync in progress · Not synced yet"
    )
    expect(formatWorkspaceFinanceSyncFreshness({})).toBe("Not synced yet")
  })

  it("normalizes manual records without guessing reconciliation or corrections", () => {
    expect(
      normalizeWorkspaceFinanceManualRecord({
        amount: "$1,250.50",
        effectiveDate: "2026-08-08",
        programId: "40000000-0000-4000-8000-000000000001",
        recordType: "donation",
        sourceLabel: " Community donor ",
      })
    ).toEqual({
      amountCents: 125_050,
      currencyCode: "USD",
      direction: "in",
      effectiveAt: "2026-08-08T12:00:00.000Z",
      programId: "40000000-0000-4000-8000-000000000001",
      recordType: "donation",
      sourceKind: "donations",
      sourceLabel: "Community donor",
    })
    expect(
      normalizeWorkspaceFinanceManualRecord({
        amount: "25.00",
        effectiveDate: "2026-08-08",
        recordType: "fee",
        sourceLabel: "Bank fee",
      })
    ).toMatchObject({ direction: "out", sourceKind: null })
    expect(
      normalizeWorkspaceFinanceManualRecord({
        amount: "25.00",
        effectiveDate: "2026-08-08",
        recordType: "correction" as "donation",
        sourceLabel: "Unsupported correction",
      })
    ).toBeNull()
  })

  it("previews quoted CSV records without assuming a provider", () => {
    expect(
      parseWorkspaceFinanceCsvPreview(
        '\uFEFFDate,Source,Amount\r\n2026-08-01,"Community, Inc.","$1,250.00"\r\n'
      )
    ).toEqual({
      headers: ["Date", "Source", "Amount"],
      rowCount: 1,
    })

    expect(() => parseWorkspaceFinanceCsvPreview("Date,Date\n1,2")).toThrow(
      "CSV column headings must be unique."
    )
    expect(() => parseWorkspaceFinanceCsvPreview("Date,Source\n")).toThrow(
      "This CSV file has headings but no records."
    )
  })

  it("auto-detects common CSV columns and explicitly maps each record", () => {
    expect(
      createDefaultWorkspaceFinanceCsvColumns([
        "Transaction Date",
        "Description",
        "Net Amount",
        "Category",
        "Currency",
      ])
    ).toEqual({
      dateColumn: "Transaction Date",
      amountColumn: "Net Amount",
      sourceColumn: "Description",
      typeColumn: "Category",
      currencyColumn: "Currency",
    })

    expect(
      mapWorkspaceFinanceCsvRecords({
        source:
          "Date,Source,Amount,Type,Currency\n2026-08-01,Community donor,125.50,Donation,USD\n2026-08-02,Card processor,(2.25),Fee,USD\n",
        mapping: {
          dateColumn: "Date",
          sourceColumn: "Source",
          amountColumn: "Amount",
          recordType: { mode: "column", column: "Type" },
          currency: { mode: "column", column: "Currency" },
        },
      })
    ).toEqual([
      {
        rowNumber: 2,
        effectiveAt: "2026-08-01T12:00:00.000Z",
        recordType: "donation",
        direction: "in",
        sourceKind: "donations",
        sourceLabel: "Community donor",
        amountCents: 12_550,
        currencyCode: "USD",
      },
      {
        rowNumber: 3,
        effectiveAt: "2026-08-02T12:00:00.000Z",
        recordType: "fee",
        direction: "out",
        sourceKind: null,
        sourceLabel: "Card processor",
        amountCents: 225,
        currencyCode: "USD",
      },
    ])
  })

  it("rejects unsafe CSV classifications before persistence", () => {
    expect(() =>
      mapWorkspaceFinanceCsvRecords({
        source: "Date,Source,Amount\n2026-08-01,Refund,-10.00\n",
        mapping: {
          dateColumn: "Date",
          sourceColumn: "Source",
          amountColumn: "Amount",
          recordType: { mode: "fixed", value: "donation" },
          currency: { mode: "fixed", value: "USD" },
        },
      })
    ).toThrow("Row 2: negative amounts cannot be imported as Donations.")

    expect(
      normalizeWorkspaceFinanceCsvImportBatch({
        fileFingerprint: "a".repeat(64),
        finalBatch: true,
        records: [
          {
            rowNumber: 2,
            effectiveAt: "2026-08-01T12:00:00.000Z",
            recordType: "donation",
            direction: "in",
            sourceKind: "other",
            sourceLabel: "Misclassified",
            amountCents: 1_000,
            currencyCode: "USD",
          },
        ],
      })
    ).toBeNull()
  })

  it("maps CSV in one dialog and persists only through an authorized server action", () => {
    const connections = readComponent("workspace-finance-connections.tsx")
    const dialog = readComponent("workspace-finance-csv-import-dialog.tsx")
    const fields = readComponent("workspace-finance-csv-mapping-fields.tsx")
    const actions = readFileSync(FINANCE_ACTIONS_SOURCE, "utf8")
    const access = readFileSync(FINANCE_ACCESS_SOURCE, "utf8")

    expect(connections).toContain("<WorkspaceFinanceCsvImportDialog")
    expect(dialog).toContain("adding them to History.")
    expect(dialog).toContain("importWorkspaceFinanceCsvBatch")
    expect(fields).toContain("Date")
    expect(fields).toContain("Amount")
    expect(fields).toContain("Source")
    expect(fields).toContain("Record type")
    expect(fields).toContain("Currency")
    expect(fields).toContain("Program")
    expect(fields).toContain("Organization-wide")
    expect(dialog).toContain("programId:")
    expect(dialog).toContain("applies to every row in this file")
    expect(actions).toContain("resolveAuthenticatedAppContext")
    expect(access).toContain('activeOrg.role === "owner"')
    expect(access).toContain('access_level", "manager"')
    expect(actions).toContain("createSupabaseAdminClient")
    expect(actions.indexOf("canManageFinance")).toBeLessThan(
      actions.indexOf("createSupabaseAdminClient()")
    )
    expect(actions).toContain('external_provider: "csv"')
    expect(actions).toContain('created_source: "import"')
  })

  it("updates opportunity workflow status through one authorized compact menu", () => {
    const actions = readFileSync(FINANCE_ACTIONS_SOURCE, "utf8")
    const menu = readComponent("workspace-finance-opportunity-status-menu.tsx")
    const activity = readComponent("workspace-finance-activity-feed.tsx")
    const loader = readFileSync(
      join(ROOT, "src/features/workspace-finance/server/opportunities.ts"),
      "utf8"
    )
    const workflowAction = actions.slice(
      actions.indexOf("updateWorkspaceFinanceOpportunityStatus")
    )

    expect(workflowAction).toContain("WORKSPACE_FINANCE_OPPORTUNITY_STATUSES")
    expect(workflowAction).toContain("resolveAuthenticatedAppContext")
    expect(workflowAction.indexOf("canManageFinance")).toBeLessThan(
      workflowAction.indexOf("createSupabaseAdminClient()")
    )
    expect(workflowAction).toContain(
      '.from("organization_finance_opportunities")'
    )
    expect(workflowAction).toContain('.eq("org_id", activeOrg.orgId)')
    expect(workflowAction).toContain("revalidateFinanceRoutes()")
    expect(menu).toContain("<DropdownMenuRadioGroup")
    expect(menu).toContain('value="applied"')
    expect(menu).toContain('value="awarded"')
    expect(menu).toContain('value="not_awarded"')
    expect(menu).not.toContain("router.refresh")
    expect(menu).toContain('updateStatus("dismissed")')
    expect(menu).toContain('label: "Undo"')
    expect(menu).toContain('opportunityId.startsWith("sample-")')
    expect(activity).toContain("<WorkspaceFinanceOpportunityStatusMenu")
    expect(loader).toContain('.neq("status", "dismissed")')
  })

  it("normalizes only bounded candidates from an enabled registered source", () => {
    expect(
      normalizeWorkspaceFinanceOpportunityIngestionBatch({
        source: {
          id: "10000000-0000-4000-8000-000000000001",
          key: "public_awards",
          name: " Public Awards ",
          enabled: true,
        },
        observedAt: "2026-08-08T12:00:00-04:00",
        items: [
          {
            externalId: " award-1 ",
            title: " Community arts award ",
            sourceLabel: " Public Arts Office ",
            opportunityType: "award",
            dueAt: "2026-09-01T23:59:59-04:00",
          },
          {
            externalId: "award-1",
            title: "Duplicate",
            opportunityType: "award",
          },
          {
            externalId: "bad-date",
            title: "Invalid deadline",
            dueAt: "not-a-date",
          },
          {
            externalId: "other-1",
            title: "Partnership listing",
          },
        ],
      })
    ).toEqual({
      source: {
        id: "10000000-0000-4000-8000-000000000001",
        key: "public_awards",
        name: "Public Awards",
        enabled: true,
      },
      observedAt: "2026-08-08T16:00:00.000Z",
      itemsSeen: 4,
      itemsRejected: 2,
      items: [
        {
          externalId: "award-1",
          title: "Community arts award",
          sourceLabel: "Public Arts Office",
          opportunityType: "award",
          dueAt: "2026-09-02T03:59:59.000Z",
          status: "new",
        },
        {
          externalId: "other-1",
          title: "Partnership listing",
          sourceLabel: "Public Awards",
          opportunityType: "other",
          dueAt: null,
          status: "new",
        },
      ],
    })

    expect(
      normalizeWorkspaceFinanceOpportunityIngestionBatch({
        source: {
          id: "10000000-0000-4000-8000-000000000001",
          key: "public_awards",
          name: "Public Awards",
          enabled: false,
        },
        observedAt: "2026-08-08T16:00:00.000Z",
        items: [],
      })
    ).toBeNull()
    expect(WORKSPACE_FINANCE_OPPORTUNITY_BATCH_LIMIT).toBe(500)
  })

  it("keeps opportunity source registration and scan execution server-only", () => {
    const migration = readFileSync(OPPORTUNITY_REGISTRY_MIGRATION, "utf8")
    const ingestion = readFileSync(OPPORTUNITY_INGESTION_SOURCE, "utf8")

    expect(migration).toContain(
      "create table if not exists public.finance_opportunity_sources"
    )
    expect(migration).toContain(
      "create table if not exists public.finance_opportunity_scan_runs"
    )
    expect(migration).toContain(
      "alter table public.finance_opportunity_sources force row level security"
    )
    expect(migration).toContain(
      "revoke all on table public.finance_opportunity_sources from anon, authenticated"
    )
    expect(migration).toContain("add column if not exists source_id uuid")
    expect(ingestion).toContain('.from("finance_opportunity_sources")')
    expect(ingestion).toContain('.eq("enabled", true)')
    expect(ingestion).toContain(
      "normalizeWorkspaceFinanceOpportunityIngestionBatch"
    )
    expect(ingestion).toContain('status: "running"')
    expect(ingestion).toContain('status: "succeeded"')
    expect(ingestion).toContain('status: "failed"')
    expect(ingestion).toContain("defaultToNull: false")
    expect(ingestion).not.toContain("fetch(")
  })

  it("maps bounded Grants.gov search results without a live request", () => {
    expect(
      buildGrantsGovSearchRequest({ keyword: " youth arts ", rows: 25 })
    ).toEqual({
      rows: 25,
      keyword: "youth arts",
      oppStatuses: "forecasted|posted",
      startRecordNum: 0,
    })
    expect(buildGrantsGovSearchRequest({ keyword: "x" })).toBeNull()
    expect(
      buildGrantsGovSearchRequest({ keyword: "arts", rows: 51 })
    ).toBeNull()

    expect(
      mapGrantsGovSearchResponse({
        errorcode: 0,
        data: {
          oppHits: [
            {
              id: "12345",
              title: "Arts education initiative",
              agencyName: "National Arts Agency",
              closeDate: "9/30/2026",
              oppStatus: "posted",
            },
            {
              id: 67890,
              title: "Forecasted youth program",
              agencyName: "Youth Services",
              closeDate: "",
              oppStatus: "forecasted",
            },
            {
              id: "closed",
              title: "Closed program",
              oppStatus: "closed",
            },
          ],
        },
      })
    ).toEqual([
      {
        externalId: "12345",
        title: "Arts education initiative",
        sourceLabel: "National Arts Agency",
        opportunityType: "grant",
        dueAt: "2026-09-30T23:59:59.000Z",
      },
      {
        externalId: "67890",
        title: "Forecasted youth program",
        sourceLabel: "Youth Services",
        opportunityType: "grant",
        dueAt: null,
      },
    ])
  })

  it("uses only the official Grants.gov endpoint and required attribution", () => {
    const grantsGov = readFileSync(GRANTS_GOV_SOURCE, "utf8")
    const activity = readComponent("workspace-finance-activity-feed.tsx")
    const migration = readFileSync(OPPORTUNITY_REGISTRY_MIGRATION, "utf8")

    expect(GRANTS_GOV_SEARCH_ENDPOINT).toBe(
      "https://api.grants.gov/v1/api/search2"
    )
    expect(grantsGov).toContain("GRANTS_GOV_SEARCH_ENDPOINT")
    expect(grantsGov).toContain('redirect: "error"')
    expect(grantsGov).toContain("AbortSignal.timeout")
    expect(grantsGov).toContain("GRANTS_GOV_RESPONSE_LIMIT_BYTES")
    expect(grantsGov).toContain("loadCandidates: async () =>")
    expect(grantsGov).not.toContain("baseUrl")
    expect(activity).toContain("GRANTS_GOV_ATTRIBUTION_NOTICE")
    expect(activity).toContain('attribution === "grants_gov"')
    expect(GRANTS_GOV_ATTRIBUTION_NOTICE).toContain("not endorsed or certified")
    expect(migration).toContain("'https://api.grants.gov'")
    expect(migration).toContain("array['api.grants.gov']")
    expect(migration).toContain("'grants_gov'")
    expect(migration).toContain("false,")
    expect(migration).toContain("https://www.grants.gov/api/terms-conditions")
  })

  it("uses one equal-padding dashboard instead of a stack of cards", () => {
    const dashboard = readComponent("workspace-finance-activity-dashboard.tsx")
    const raised = readComponent("workspace-finance-raised-summary.tsx")
    const activity = readComponent("workspace-finance-activity-feed.tsx")

    expect(dashboard).toContain("mx-auto w-full max-w-5xl p-4 sm:p-6")
    expect(dashboard).toContain("<WorkspaceFinanceRaisedSummary")
    expect(dashboard).toContain("<WorkspaceFinanceActivityFeed")
    expect(dashboard).toContain("<Separator")
    expect(raised).toContain("Raised")
    expect(raised).not.toContain(">Raising<")
    expect(raised).not.toContain('"Not set"')
    expect(raised).toContain("formatCurrency(raisedCents)")
    expect(raised).toContain('role="img"')
    expect(raised).toContain("source.amountCents / railTotalCents")
    expect(raised).toContain("<WorkspaceFinanceProgramTargetsPopover")
    expect(raised).not.toContain("@/components/ui/card")
    expect(activity).not.toContain("@/components/ui/card")
  })

  it("renders one accessible source rail under Raised", () => {
    const source = readComponent("workspace-finance-raised-summary.tsx")
    const targets = readComponent(
      "workspace-finance-program-targets-popover.tsx"
    )

    expect(source).toContain("sourceColors")
    expect(source).toContain('className="bg-muted mt-4 flex h-2')
    expect(source).toContain("railDescription")
    expect(source).toContain("source.label")
    expect(source).toContain("source.amountCents")
    expect(source).toContain("Target {formatCurrency(targetCents)}")
    expect(source).toContain("remainingCents")
    expect(source).toContain('state === "loading"')
    expect(source).toContain('state === "error"')
    expect(targets).toContain("<Popover")
    expect(targets).toContain("program.targetSource")
    expect(targets).toContain("program.raisedCents")
    expect(targets).toContain("<Progress")
    expect(targets).toContain("Organization-wide")
    expect(targets).toContain('"Complete" : "Raising"')
  })

  it("uses paginated shadcn Items for Activity and keeps History tabular", () => {
    const activity = readComponent("workspace-finance-activity-feed.tsx")
    const history = readComponent("workspace-finance-history.tsx")

    expect(activity).toContain("<Item")
    expect(activity).toContain("Transactions and funding opportunities")
    expect(activity).toContain("PAGE_SIZE = 6")
    expect(activity).toContain("useState(1)")
    expect(activity).toContain("setRequestedPage(currentPage - 1)")
    expect(activity).toContain("setRequestedPage(currentPage + 1)")
    expect(activity).toContain("<Pagination")
    expect(activity).toContain("<Button")
    expect(activity).not.toContain("next/navigation")
    expect(activity).not.toContain("pageHref")
    expect(activity).not.toContain("AI matches")
    expect(activity).toContain("item.record.programTitle")
    expect(history).toContain("<Table>")
    expect(history).toContain('className="divide-y sm:hidden"')
    expect(history).toContain('className="hidden sm:block"')
    expect(history).toContain("<TableHead>Date</TableHead>")
    expect(history).toContain("<TableHead>Source</TableHead>")
    expect(history).toContain("<TableHead>Type</TableHead>")
    expect(history).toContain("Amount")
    expect(history).toContain("<TableHead>Status</TableHead>")
    expect(history).toContain("record.programTitle")
    expect(history).toContain('"History unavailable" : "No history yet"')
    expect(history).toContain('return "—"')
    expect(history).toContain('status === "recorded"')
    expect(history).toContain(") : status ? (")
    expect(history).toContain('aria-label="Loading history"')
    expect(history).toContain("WorkspaceFinanceHistoryMessage")
    expect(history).toContain("WorkspaceFinanceHistoryStatus")
  })

  it("reassigns financial History rows without adding a column or route reload", () => {
    const actions = readFileSync(FINANCE_ACTIONS_SOURCE, "utf8")
    const history = readComponent("workspace-finance-history.tsx")
    const menu = readComponent("workspace-finance-program-assignment-menu.tsx")
    const viewTabs = readComponent("workspace-finance-view-tabs.tsx")
    const assignmentAction = actions.slice(
      actions.indexOf("updateWorkspaceFinanceRecordProgram")
    )

    expect(history).toContain("isAssignableFinanceRecord(record)")
    expect(history).toContain("<WorkspaceFinanceProgramAssignmentMenu")
    expect(history).toContain("<TableHead>Source</TableHead>")
    expect(history).not.toContain("<TableHead>Program</TableHead>")
    expect(menu).toContain("<DropdownMenuGroup>")
    expect(menu).toContain("<DropdownMenuRadioGroup")
    expect(menu).toContain("Organization-wide")
    expect(menu).toContain("updateWorkspaceFinanceRecordProgram")
    expect(menu).toContain("onProgramChange(recordId, previousAssignment)")
    expect(menu).not.toContain("next/navigation")
    expect(viewTabs).toContain("programAssignments")
    expect(viewTabs).toContain("normalizeWorkspaceFinanceInput")
    expect(viewTabs).toContain("persistAssignments={!sampleDataEnabled}")
    expect(assignmentAction).toContain("resolveAuthenticatedAppContext")
    expect(assignmentAction.indexOf("canManageFinance")).toBeLessThan(
      assignmentAction.indexOf("createSupabaseAdminClient()")
    )
    expect(assignmentAction).toContain('.from("organization_finance_records")')
    expect(assignmentAction).toContain('.eq("org_id", activeOrg.orgId)')
    expect(assignmentAction).toContain('.eq("status", "recorded")')
    expect(assignmentAction).toContain("revalidateFinanceRoutes()")
  })

  it("verifies and corrects History rows without adding dashboard density", () => {
    const history = readComponent("workspace-finance-history.tsx")
    const dialog = readComponent("workspace-finance-reconciliation-dialog.tsx")
    const correction = readComponent("workspace-finance-correction-form.tsx")
    const activity = readComponent("workspace-finance-activity-feed.tsx")
    const viewTabs = readComponent("workspace-finance-view-tabs.tsx")

    expect(history).toContain("<WorkspaceFinanceReconciliationDialog")
    expect(history).toContain("<TableHead>Status</TableHead>")
    expect(history).not.toContain("<TableHead>Evidence</TableHead>")
    expect(dialog).toContain('variant="outline"')
    expect(dialog).toContain("External reference")
    expect(dialog).toContain("PDF, JPG, or PNG up to 10 MB")
    expect(dialog).toContain("It does not move money.")
    expect(dialog).toContain('"Verified"')
    expect(dialog).toContain('"Corrected"')
    expect(dialog).toContain("Correct record")
    expect(dialog).toContain(
      "`/api/account/finance-record-evidence/${record.id}`"
    )
    expect(dialog).not.toContain("next/navigation")
    expect(correction).toContain("The original stays in History")
    expect(correction).toContain('{ method: "PATCH", body: form }')
    expect(correction).toContain("Save correction")
    expect(correction).toContain("Organization-wide")
    expect(activity).toContain('reconciled: "Verified"')
    expect(viewTabs).toContain("reconciliations")
    expect(viewTabs).toContain("corrections")
    expect(viewTabs).toContain("handleRecordReconciled")
    expect(viewTabs).toContain("handleRecordCorrected")
    expect(viewTabs).toContain("persistReconciliation={!sampleDataEnabled}")
  })

  it("removes the superseded standalone Finance cards", () => {
    expect(
      existsSync(join(COMPONENTS, "workspace-finance-raising-metric.tsx"))
    ).toBe(false)
    expect(
      existsSync(join(COMPONENTS, "workspace-finance-activity-chart.tsx"))
    ).toBe(false)
    expect(
      existsSync(join(COMPONENTS, "workspace-finance-raising-summary.tsx"))
    ).toBe(false)
    expect(
      existsSync(join(COMPONENTS, "workspace-finance-source-chart.tsx"))
    ).toBe(false)
    expect(
      existsSync(join(COMPONENTS, "workspace-finance-opportunities.tsx"))
    ).toBe(false)
  })
})
