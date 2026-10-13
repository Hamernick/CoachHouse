import "./test-utils"

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildFiscalSponsorshipAgreementDocument,
  resolveDocuSealSubmitterSigningHref,
} from "@/features/fiscal-sponsorship"
import {
  mapDocuSealWebhookToFiscalStatus,
  resolveDocuSealWebhookAuditLogUrl,
  resolveDocuSealWebhookCombinedDocumentUrl,
  resolveDocuSealWebhookSubmissionId,
} from "@/features/fiscal-sponsorship/lib/docuseal-webhook-payload"
import {
  generateFiscalSponsorshipAgreement,
  reviewFiscalSponsorshipApplication,
  sendFiscalSponsorshipAgreementForSignature,
  submitFiscalSponsorshipApplication,
} from "@/features/fiscal-sponsorship/actions"
import {
  loadFiscalSponsorshipApplicationDraft,
  saveFiscalSponsorshipApplicationDraft,
} from "@/features/fiscal-sponsorship/server/actions"
import { revalidatePathMock, resetTestMocks } from "./test-utils"

const { createSupabaseAdminClientMock, resolveAuthenticatedAppContextMock } =
  vi.hoisted(() => ({
    createSupabaseAdminClientMock: vi.fn(),
    resolveAuthenticatedAppContextMock: vi.fn(),
  }))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))

const SAVED_AT = "2026-08-05T23:30:00.000Z"

vi.mock("@/lib/auth/request-context", () => ({
  resolveAuthenticatedAppContext: resolveAuthenticatedAppContextMock,
}))

function createProjectQuery(project: { id: string; org_id: string }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: project,
      error: null,
    }),
  }
}

describe("fiscal sponsorship application persistence", () => {
  beforeEach(() => {
    resetTestMocks()
    createSupabaseAdminClientMock.mockReset()
    resolveAuthenticatedAppContextMock.mockReset()
  })

  it("maps DocuSeal webhook payloads onto fiscal signing status", () => {
    const completedPayload = {
      event_type: "submission.completed",
      submission: { id: "submission-1", completed_at: "2026-06-11T12:00:00Z" },
      submitters: [
        { email: "coach@example.com", status: "completed" },
        { email: "applicant@example.com", status: "completed" },
      ],
    }

    expect(resolveDocuSealWebhookSubmissionId(completedPayload)).toBe(
      "submission-1"
    )
    expect(
      resolveDocuSealWebhookAuditLogUrl({
        data: {
          audit_log_url: "https://docuseal.com/file/hash/audit.pdf",
        },
      })
    ).toBe("https://docuseal.com/file/hash/audit.pdf")
    expect(
      resolveDocuSealWebhookCombinedDocumentUrl({
        data: {
          combined_document_url: "https://docuseal.com/file/hash/signed.pdf",
        },
      })
    ).toBe("https://docuseal.com/file/hash/signed.pdf")
    expect(
      mapDocuSealWebhookToFiscalStatus({
        applicantSignerEmail: "applicant@example.com",
        coachSignerEmail: "coach@example.com",
        currentPacketStatus: "sent",
        payload: completedPayload,
      })
    ).toEqual(
      expect.objectContaining({
        applicationStatus: "countersigned",
        documentStatus: "executed",
        eventType: "submission.completed",
        packetStatus: "completed",
      })
    )

    expect(
      mapDocuSealWebhookToFiscalStatus({
        applicantSignerEmail: "applicant@example.com",
        coachSignerEmail: "coach@example.com",
        currentPacketStatus: "sent",
        payload: {
          data: {
            submission_id: "submission-1",
            submitter: {
              email: "applicant@example.com",
            },
          },
          event_type: "submitter.completed",
        },
      })
    ).toEqual(
      expect.objectContaining({
        applicationStatus: "signed",
        documentStatus: "partially_signed",
        packetStatus: "applicant_signed",
      })
    )
  })

  it("loads the server action facade for the workflow actions", () => {
    expect(typeof submitFiscalSponsorshipApplication).toBe("function")
    expect(typeof reviewFiscalSponsorshipApplication).toBe("function")
    expect(typeof generateFiscalSponsorshipAgreement).toBe("function")
    expect(typeof sendFiscalSponsorshipAgreementForSignature).toBe("function")
  })

  it("resolves DocuSeal submitter signing links from provider payloads", () => {
    expect(
      resolveDocuSealSubmitterSigningHref({
        email: "applicant@example.com",
        payload: {
          submitters: [
            {
              email: "coach@example.com",
              role: "Coach House",
              slug: "coach-slug",
            },
            {
              email: "applicant@example.com",
              role: "Applicant",
              slug: "applicant-slug",
            },
          ],
        },
        role: "Applicant",
      })
    ).toBe("https://docuseal.com/s/applicant-slug")

    expect(
      resolveDocuSealSubmitterSigningHref({
        apiBaseUrl: "https://docuseal.example.com/api",
        payload: {
          data: {
            submission: {
              submitters: [
                {
                  embed_src: "https://docuseal.example.com/s/coach-slug",
                  role: "Coach House",
                },
              ],
            },
          },
        },
        role: "Coach House",
      })
    ).toBe("https://docuseal.example.com/s/coach-slug")
  })

  it("generates escaped agreement HTML from application records", () => {
    const document = buildFiscalSponsorshipAgreementDocument({
      application: {
        applicantFirstName: "Ana",
        applicantFullName: "Ana <Torres>",
        applicantLastName: "Torres",
        concernsExplanation: null,
        createdAt: "2026-06-10T00:00:00.000Z",
        documentTemplatePayload: {},
        engagesInLobbying: false,
        estimatedBudgetCents: 123456,
        expenseSummary: "Meals, storage, and outreach.",
        focusArea: "Food security",
        formationStatus: "in progress",
        hasLegalComplianceFinancialConcerns: false,
        id: "application-1",
        initiativeHistory: "Started as a neighborhood project.",
        leadershipBackground: "Community organizers.",
        legalEntityHas501c3: false,
        legalEntityType: "informal_group_with_ein",
        mailingCity: null,
        mailingPostalCode: null,
        mailingState: null,
        mailingStreetAddress: null,
        mailingStreetAddress2: null,
        metadata: {},
        operatesOutsideUnitedStates: false,
        orgId: "org-1",
        phoneNumber: null,
        primaryEmail: "ana@example.com",
        projectDescription: "Free community meals.",
        projectDurationType: "ongoing_multi_year",
        projectId: "project-1",
        projectLocation: "Chicago",
        projectName: "Kitchen <Pilot>",
        prospectiveFundingSources: "Donors and foundations.",
        publicBenefit: "Neighbors receive free meals.",
        receivesInvestorReturnFunds: false,
        shortPublicDescription: "Community kitchen.",
        sourceSnapshot: {},
        status: "approved",
        temporaryEndDate: null,
        temporaryStartDate: null,
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      generatedAt: "2026-06-10T00:00:00.000Z",
      organizationName: "Coach House",
    })

    expect(document.filename).toBe("kitchen-pilot-model-c-agreement.html")
    expect(document.mime).toBe("text/html")
    expect(document.html).toContain("Model C Fiscal Sponsorship Agreement")
    expect(document.html).toContain("Kitchen &lt;Pilot&gt;")
    expect(document.html).toContain("Ana &lt;Torres&gt;")
    expect(document.html).not.toContain("Ana <Torres>")
    expect(document.sizeBytes).toBeGreaterThan(1000)
  })

  it("persists application drafts against the resolved project organization", async () => {
    const projectQuery = createProjectQuery({
      id: "project-1",
      org_id: "org-1",
    })
    const applicationTable = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({
        data: { id: "application-1" },
        error: null,
      }),
    }
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn((table: string) => {
        if (table === "organization_projects") return projectQuery
        if (table === "fiscal_sponsorship_applications") return applicationTable
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    resolveAuthenticatedAppContextMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      activeOrg: { orgId: "org-1", role: "owner" },
      profileAudience: { isAdmin: false },
    })
    const rpc = vi.fn().mockResolvedValue({
      data: {
        applicationId: "application-1",
        ok: true,
        updatedAt: SAVED_AT,
      },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })

    await expect(
      saveFiscalSponsorshipApplicationDraft({
        projectId: "project-1",
        applicantFirstName: "Ana",
        applicantLastName: "Torres",
        primaryEmail: "ana@example.com",
        legalEntityType: "informal_group_with_ein",
        estimatedBudgetCents: 500000,
        operatesOutsideUnitedStates: false,
        sourceSnapshot: { project: "source" },
        metadata: {
          fundraisingGoal: { amountCents: 250000, period: "monthly" },
          budgetRows: [{ id: "legacy", category: "Supplies", amount: 5000 }],
        },
      })
    ).resolves.toEqual({
      ok: true,
      applicationId: "application-1",
      updatedAt: SAVED_AT,
    })

    expect(rpc).toHaveBeenCalledWith(
      "save_fiscal_sponsorship_application_draft_transition",
      expect.objectContaining({
        p_actor_id: "user-1",
        p_allow_locked: false,
        p_expected_updated_at: null,
        p_has_budget_rows: false,
        p_payload: expect.objectContaining({
          org_id: "org-1",
          project_id: "project-1",
          applicant_full_name: "Ana Torres",
          primary_email: "ana@example.com",
          legal_entity_type: "informal_group_with_ein",
          estimated_budget_cents: 500000,
          metadata: expect.objectContaining({
            fundraisingGoal: { amountCents: 250000, period: "monthly" },
            budgetRows: [{ id: "legacy", category: "Supplies", amount: 5000 }],
          }),
          operates_outside_united_states: false,
          source_snapshot: { project: "source" },
          created_by: "user-1",
          updated_by: "user-1",
        }),
        p_project_id: "project-1",
      })
    )
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations")
    expect(revalidatePathMock).toHaveBeenCalledWith("/organizations/project-1")
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace")
    expect(revalidatePathMock).toHaveBeenCalledWith("/my-organization")
    expect(revalidatePathMock).toHaveBeenCalledWith("/organization/workspace")
  })

  it("blocks non-editor organization members from saving drafts", async () => {
    const projectQuery = createProjectQuery({
      id: "project-1",
      org_id: "org-1",
    })
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn((table: string) => {
        if (table === "organization_projects") return projectQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    resolveAuthenticatedAppContextMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      activeOrg: { orgId: "org-1", role: "member" },
      profileAudience: { isAdmin: false },
    })

    await expect(
      saveFiscalSponsorshipApplicationDraft({
        projectId: "project-1",
      })
    ).resolves.toEqual({
      error: "Only organization editors can save fiscal applications.",
    })

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("lets platform admins save against invited organization projects", async () => {
    const projectQuery = createProjectQuery({
      id: "project-2",
      org_id: "org-2",
    })
    const applicationTable = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({
        data: { id: "application-2" },
        error: null,
      }),
    }
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn((table: string) => {
        if (table === "organization_projects") return projectQuery
        if (table === "fiscal_sponsorship_applications") return applicationTable
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    resolveAuthenticatedAppContextMock.mockResolvedValue({
      supabase,
      user: { id: "platform-admin-1" },
      activeOrg: { orgId: "org-1", role: "member" },
      profileAudience: { isAdmin: true },
    })
    const rpc = vi.fn().mockResolvedValue({
      data: {
        applicationId: "application-2",
        ok: true,
        updatedAt: SAVED_AT,
      },
      error: null,
    })
    createSupabaseAdminClientMock.mockReturnValue({ rpc })

    await expect(
      saveFiscalSponsorshipApplicationDraft({
        projectId: "project-2",
        projectName: "Community kitchen",
      })
    ).resolves.toEqual({
      ok: true,
      applicationId: "application-2",
      updatedAt: SAVED_AT,
    })

    expect(rpc).toHaveBeenCalledWith(
      "save_fiscal_sponsorship_application_draft_transition",
      expect.objectContaining({
        p_allow_locked: true,
        p_payload: expect.objectContaining({
          org_id: "org-2",
          project_id: "project-2",
          project_name: "Community kitchen",
        }),
      })
    )
  })

  it("loads existing drafts for accessible projects", async () => {
    const projectQuery = createProjectQuery({
      id: "project-1",
      org_id: "org-1",
    })
    const applicationTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "application-1",
          org_id: "org-1",
          project_id: "project-1",
          status: "draft",
          applicant_full_name: "Ana Torres",
          applicant_first_name: "Ana",
          applicant_last_name: "Torres",
          mailing_street_address: null,
          mailing_street_address_2: null,
          mailing_city: null,
          mailing_state: null,
          mailing_postal_code: null,
          phone_number: null,
          primary_email: "ana@example.com",
          legal_entity_type: "individual",
          legal_entity_has_501c3: false,
          formation_status: "in progress",
          project_name: "Community kitchen",
          project_duration_type: "ongoing_multi_year",
          temporary_start_date: null,
          temporary_end_date: null,
          focus_area: "Food security",
          project_description: null,
          project_location: null,
          estimated_budget_cents: 250000,
          expense_summary: null,
          prospective_funding_sources: null,
          public_benefit: null,
          leadership_background: null,
          initiative_history: null,
          short_public_description: null,
          operates_outside_united_states: false,
          receives_investor_return_funds: false,
          engages_in_lobbying: false,
          has_legal_compliance_financial_concerns: false,
          concerns_explanation: null,
          source_snapshot: {},
          document_template_payload: {},
          review_notes: null,
          submitted_at: null,
          reviewed_by: null,
          reviewed_at: null,
          created_by: "user-1",
          updated_by: "user-1",
          metadata: {},
          created_at: "2026-06-09T19:00:00.000Z",
          updated_at: "2026-06-09T19:00:00.000Z",
        },
        error: null,
      }),
    }
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn((table: string) => {
        if (table === "organization_projects") return projectQuery
        if (table === "fiscal_sponsorship_applications") return applicationTable
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    resolveAuthenticatedAppContextMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      activeOrg: { orgId: "org-1", role: "member" },
      profileAudience: { isAdmin: false },
    })

    await expect(
      loadFiscalSponsorshipApplicationDraft("project-1")
    ).resolves.toEqual({
      ok: true,
      application: expect.objectContaining({
        id: "application-1",
        orgId: "org-1",
        projectId: "project-1",
        applicantFullName: "Ana Torres",
        primaryEmail: "ana@example.com",
        legalEntityType: "individual",
        projectDurationType: "ongoing_multi_year",
      }),
    })
  })
})
