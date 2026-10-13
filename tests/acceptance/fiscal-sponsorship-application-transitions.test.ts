import "./test-utils"

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  createSupabaseAdminClientMock,
  notifyApplicationReviewedMock,
  notifyApplicationSubmittedMock,
  resolveAuthenticatedAppContextMock,
} = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
  notifyApplicationReviewedMock: vi.fn(),
  notifyApplicationSubmittedMock: vi.fn(),
  resolveAuthenticatedAppContextMock: vi.fn(),
}))

vi.mock("@/lib/auth/request-context", () => ({
  resolveAuthenticatedAppContext: resolveAuthenticatedAppContextMock,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))

vi.mock("@/features/fiscal-sponsorship/server/workflow-notifications", () => ({
  notifyFiscalApplicationReviewed: notifyApplicationReviewedMock,
  notifyFiscalApplicationSubmitted: notifyApplicationSubmittedMock,
  notifyFiscalDocumentConnected: vi.fn(),
  notifyFiscalDocumentReviewed: vi.fn(),
}))

import {
  reviewFiscalSponsorshipApplication,
  submitFiscalSponsorshipApplication,
} from "@/features/fiscal-sponsorship/server/workflow-actions"
import { validateApplicationForSubmission } from "@/features/fiscal-sponsorship/server/workflow-validation"
import type { FiscalApplicationRow } from "@/features/fiscal-sponsorship/server/workflow-support"
import { revalidatePathMock, resetTestMocks } from "./test-utils"

const UPDATED_AT = "2026-08-05T22:00:00.000Z"

function createApplication(status = "draft") {
  return {
    id: "application-1",
    org_id: "org-1",
    project_id: "project-1",
    status,
    updated_at: UPDATED_AT,
    applicant_full_name: "Ana Torres",
    applicant_first_name: "Ana",
    applicant_last_name: "Torres",
    primary_email: "ana@example.com",
    mailing_street_address: "123 Main Street",
    mailing_city: "Chicago",
    mailing_state: "IL",
    mailing_postal_code: "60601",
    legal_entity_type: "individual",
    formation_status: null,
    project_name: "Community kitchen",
    project_description: "Free neighborhood meals.",
    public_benefit: "Neighbors receive meals.",
    project_duration_type: "ongoing_multi_year",
    estimated_budget_cents: 500_000,
    prospective_funding_sources: "Local grants",
    operates_outside_united_states: false,
    receives_investor_return_funds: null,
    engages_in_lobbying: false,
    has_legal_compliance_financial_concerns: false,
    concerns_explanation: null as string | null,
  }
}

function queryResult<T>(data: T) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function setContext({
  application = createApplication(),
  assignedCoach = true,
  role = "owner",
}: {
  application?: ReturnType<typeof createApplication>
  assignedCoach?: boolean
  role?: "member" | "owner"
} = {}) {
  const projectQuery = queryResult({ id: "project-1", org_id: "org-1" })
  const applicationQuery = queryResult(application)
  const assignmentQuery = queryResult(
    assignedCoach ? { coach_user_id: "user-1" } : null
  )
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn((table: string) => {
      if (table === "organization_projects") return projectQuery
      if (table === "fiscal_sponsorship_applications") {
        return applicationQuery
      }
      if (table === "organization_coach_assignments") return assignmentQuery
      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  resolveAuthenticatedAppContextMock.mockResolvedValue({
    activeOrg: { orgId: "org-1", role },
    profileAudience: {
      isAdmin: false,
      isPlatformStaff: role === "member",
      platformAccessLevel: role === "member" ? "coach" : null,
    },
    supabase,
    user: { id: "user-1" },
  })

  return { supabase }
}

describe("fiscal sponsorship application transitions", () => {
  beforeEach(() => {
    resetTestMocks()
    createSupabaseAdminClientMock.mockReset()
    notifyApplicationReviewedMock.mockReset()
    notifyApplicationSubmittedMock.mockReset()
    resolveAuthenticatedAppContextMock.mockReset()
  })

  it("submits through the atomic service-only transition", async () => {
    setContext()
    const rpc = vi.fn().mockResolvedValue({
      data: {
        applicationId: "application-1",
        ok: true,
        status: "submitted",
        transitioned: true,
      },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })

    await expect(
      submitFiscalSponsorshipApplication("project-1")
    ).resolves.toEqual({ applicationId: "application-1", ok: true })

    expect(rpc).toHaveBeenCalledWith(
      "submit_fiscal_sponsorship_application_transition",
      {
        p_actor_id: "user-1",
        p_application_id: "application-1",
        p_expected_updated_at: UPDATED_AT,
      }
    )
    expect(notifyApplicationSubmittedMock).toHaveBeenCalledOnce()
    expect(revalidatePathMock).toHaveBeenCalledWith("/my-organization")
  })

  it("does not repeat notifications for an idempotent submit", async () => {
    setContext({ application: createApplication("submitted") })
    createSupabaseAdminClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          applicationId: "application-1",
          ok: true,
          status: "submitted",
          transitioned: false,
        },
        error: null,
      }),
    })

    await expect(
      submitFiscalSponsorshipApplication("project-1")
    ).resolves.toEqual({ applicationId: "application-1", ok: true })
    expect(notifyApplicationSubmittedMock).not.toHaveBeenCalled()
  })

  it("returns a retryable error instead of overwriting a newer state", async () => {
    setContext()
    createSupabaseAdminClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { code: "stale", ok: false },
        error: null,
      }),
    })

    await expect(
      submitFiscalSponsorshipApplication("project-1")
    ).resolves.toEqual({
      error: "This application changed. Refresh before trying again.",
    })
    expect(notifyApplicationSubmittedMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("lets only the assigned coach review through the atomic transition", async () => {
    const { supabase } = setContext({
      application: createApplication("submitted"),
      role: "member",
    })
    const rpc = vi.fn().mockResolvedValue({
      data: {
        applicationId: "application-1",
        ok: true,
        status: "needs_info",
        transitioned: true,
      },
      error: null,
    })
    createSupabaseAdminClientMock
      .mockReturnValueOnce(supabase)
      .mockReturnValueOnce({ rpc })

    await expect(
      reviewFiscalSponsorshipApplication({
        decision: "needs_info",
        notes: "  Add the latest budget.  ",
        projectId: "project-1",
      })
    ).resolves.toEqual({ applicationId: "application-1", ok: true })

    expect(rpc).toHaveBeenCalledWith(
      "review_fiscal_sponsorship_application_transition",
      {
        p_actor_id: "user-1",
        p_application_id: "application-1",
        p_decision: "needs_info",
        p_expected_updated_at: UPDATED_AT,
        p_notes: "Add the latest budget.",
      }
    )
    expect(notifyApplicationReviewedMock).toHaveBeenCalledOnce()
  })

  it("denies an unassigned coach before creating an admin client", async () => {
    const { supabase } = setContext({
      application: createApplication("submitted"),
      assignedCoach: false,
      role: "member",
    })
    createSupabaseAdminClientMock.mockReturnValue(supabase)

    await expect(
      reviewFiscalSponsorshipApplication({
        decision: "approved",
        projectId: "project-1",
      })
    ).resolves.toEqual({
      error:
        "Only the assigned Coach House reviewer can review this application.",
    })
    expect(createSupabaseAdminClientMock).toHaveBeenCalledOnce()
  })

  it("keeps application, review, and audit writes in locked transactions", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260805230500_atomic_fiscal_application_transitions.sql"
      ),
      "utf8"
    )

    expect(sql).toContain("for update;")
    expect(sql).toContain("v_application.updated_at is distinct from")
    expect(sql).toContain("insert into public.fiscal_sponsorship_reviews")
    expect(
      sql.match(/insert into public\.fiscal_sponsorship_events/g)
    ).toHaveLength(2)
    expect(sql).toContain("from public, anon, authenticated")
    expect(sql.match(/to service_role;/g)).toHaveLength(2)
  })
})


describe("updated fiscal eligibility policy", () => {
  it.each(["operates_outside_united_states", "engages_in_lobbying"] as const)("reviews explained %s answers instead of rejecting them", (field) => {
    const application = { ...createApplication(), [field]: true } as FiscalApplicationRow
    expect(validateApplicationForSubmission(application)).toContain("Explain each")
    application.concerns_explanation = "Details of the planned activities for individual review."
    expect(validateApplicationForSubmission(application)).toBeNull()
    application.concerns_explanation = "   "
    expect(validateApplicationForSubmission(application)).toContain("Explain each")
  })
  it("does not require the removed investor-return answer", () => {
    const application = createApplication() as FiscalApplicationRow
    expect(validateApplicationForSubmission(application)).toBeNull()
    application.receives_investor_return_funds = true
    expect(validateApplicationForSubmission(application)).toBeNull()
  })
  it("requires a valid fundraising goal even if an old expense budget exists", () => {
    const application = { ...createApplication(), metadata: { fundraisingGoal: { amountCents: null, period: "total" } } } as FiscalApplicationRow
    expect(validateApplicationForSubmission(application)).toContain("fundraising amount")
    application.metadata = { fundraisingGoal: { amountCents: 500000, period: "monthly" } }
    application.estimated_budget_cents = null
    expect(validateApplicationForSubmission(application)).toBeNull()
  })
})
