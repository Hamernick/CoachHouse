import { parseFundraisingAmount, readFundraisingGoal } from "@/features/fiscal-sponsorship/lib/fundraising-goal"
import { describe, expect, it } from "vitest"

import {
  buildFiscalSponsorshipApplicationDraft,
  buildFiscalSponsorshipApplicationInput,
  normalizeFiscalSponsorshipInput,
} from "@/features/fiscal-sponsorship"
import type { FiscalSponsorshipProjectWorkbenchData } from "@/features/fiscal-sponsorship"

describe("fiscal sponsorship application drafts", () => {
  it("normalizes drafts without forcing incomplete intake fields", () => {
    expect(
      normalizeFiscalSponsorshipInput({
        projectId: "  ",
      })
    ).toEqual({
      ok: false,
      error: "Choose a project before saving this application.",
    })

    expect(
      normalizeFiscalSponsorshipInput({
        projectId: " project-1 ",
        applicantFirstName: " Ana ",
        applicantLastName: " Torres ",
        estimatedBudgetCents: 12345.67,
        legalEntityType: "informal_group_with_ein",
        projectDurationType: "not-valid",
        status: "unknown",
      })
    ).toEqual({
      ok: true,
      value: expect.objectContaining({
        projectId: "project-1",
        status: "draft",
        applicantFullName: "Ana Torres",
        applicantFirstName: "Ana",
        applicantLastName: "Torres",
        legalEntityType: "informal_group_with_ein",
        projectDurationType: null,
        estimatedBudgetCents: 12346,
      }),
    })
  })

  it("maps editable drawer drafts into application input payloads", () => {
    const workbenchData = createWorkbenchData({
      applicantName: "Ana Torres",
      projectName: "Community kitchen",
      applicationPrefill: {
        sourceActivityId: "activity-2",
        sourceActivityTitle: "Neighborhood food nights",
        sourceActivityKind: "Service",
      },
    })
    const draft = buildFiscalSponsorshipApplicationDraft({
      data: workbenchData,
    })
    const input = buildFiscalSponsorshipApplicationInput({
      data: workbenchData,
      draft: {
        ...draft,
        estimatedBudgetDollars: "$12,345.67",
        legalEntityType: "informal_group_with_ein",
        legalEntityHas501c3: "no",
        operatesOutsideUnitedStates: "no",
        receivesInvestorReturnFunds: "yes",
        engagesInLobbying: "unknown",
        shortPublicDescription: "A community food access program.",
      },
    })
    const renamedInput = buildFiscalSponsorshipApplicationInput({
      data: workbenchData,
      draft: {
        ...draft,
        applicantFullName: "Stale Prefill Name",
        applicantFirstName: "Maya",
        applicantLastName: "Johnson",
      },
    })

    expect(draft).toEqual(
      expect.objectContaining({
        applicantFullName: "Ana Torres",
        applicantFirstName: "Ana",
        applicantLastName: "Torres",
        projectName: "Community kitchen",
        status: "draft",
      })
    )
    expect(input).toEqual(
      expect.objectContaining({
        projectId: "project-1",
        estimatedBudgetCents: 1234567,
        legalEntityType: "informal_group_with_ein",
        legalEntityHas501c3: false,
        operatesOutsideUnitedStates: false,
        receivesInvestorReturnFunds: true,
        engagesInLobbying: null,
        sourceSnapshot: expect.objectContaining({
          source: "member-workspace-project-fiscal-workbench",
          activity: {
            id: "activity-2",
            title: "Neighborhood food nights",
            kind: "Service",
          },
          workbench: expect.objectContaining({
            readinessPercent: 42,
          }),
        }),
        documentTemplatePayload: expect.objectContaining({
          agreement: expect.objectContaining({
            projectName: "Community kitchen",
            publicDescription: "A community food access program.",
          }),
        }),
        metadata: expect.objectContaining({
          selectedActivityId: "activity-2",
        }),
      })
    )
    expect(renamedInput).toEqual(
      expect.objectContaining({
        applicantFullName: "Maya Johnson",
        applicantFirstName: "Maya",
        applicantLastName: "Johnson",
      })
    )
  })

  it("prefills application drafts from existing organization and program data", () => {
    const applicationPrefill = {
      applicantFullName: "Ana Torres",
      applicantFirstName: "Ana",
      applicantLastName: "Torres",
      mailingStreetAddress: "123 Main St",
      mailingCity: "Chicago",
      mailingState: "IL",
      mailingPostalCode: "60601",
      phoneNumber: "312-555-0100",
      primaryEmail: "ana@example.com",
      legalEntityHas501c3: false,
      formationStatus: "501(c)(3) in progress",
      projectName: "Community kitchen",
      projectDurationType: "temporary",
      temporaryStartDate: "2026-07-01",
      temporaryEndDate: "2026-12-31",
      focusArea: "Food security",
      projectDescription: "Free meals and community food access.",
      projectLocation: "Chicago, IL",
      estimatedBudgetCents: 2500000,
      expenseSummary: "Food - ingredients - $12000.00",
      prospectiveFundingSources:
        "Community donors; Public fundraising goal: $25,000",
      publicBenefit: "Neighbors receive free meals.",
      initiativeHistory: "Started as a neighborhood project.",
      shortPublicDescription: "Community kitchen pilot.",
    } satisfies FiscalSponsorshipProjectWorkbenchData["applicationPrefill"]
    const workbenchData = createWorkbenchData({
      applicantName: "Fallback Applicant",
      applicationPrefill,
      projectName: "Fallback project",
    })

    const draft = buildFiscalSponsorshipApplicationDraft({
      data: workbenchData,
    })
    const savedDraft = buildFiscalSponsorshipApplicationDraft({
      application: {
        applicantFullName: "Saved Applicant",
        applicantFirstName: "Saved",
        applicantLastName: "Applicant",
        concernsExplanation: null,
        createdAt: "2026-06-15T00:00:00.000Z",
        documentTemplatePayload: {},
        engagesInLobbying: null,
        estimatedBudgetCents: 100000,
        expenseSummary: null,
        focusArea: null,
        formationStatus: null,
        hasLegalComplianceFinancialConcerns: null,
        id: "application-1",
        initiativeHistory: null,
        leadershipBackground: null,
        legalEntityHas501c3: null,
        legalEntityType: null,
        mailingCity: null,
        mailingPostalCode: null,
        mailingState: null,
        mailingStreetAddress: null,
        mailingStreetAddress2: null,
        metadata: {},
        operatesOutsideUnitedStates: null,
        orgId: "org-1",
        phoneNumber: null,
        primaryEmail: "saved@example.com",
        projectDescription: null,
        projectDurationType: null,
        projectId: "project-1",
        projectLocation: null,
        projectName: "Saved project",
        prospectiveFundingSources: null,
        publicBenefit: null,
        receivesInvestorReturnFunds: null,
        shortPublicDescription: null,
        sourceSnapshot: {},
        status: "draft",
        temporaryEndDate: null,
        temporaryStartDate: null,
        updatedAt: "2026-06-15T00:00:00.000Z",
      },
      data: workbenchData,
    })
    const input = buildFiscalSponsorshipApplicationInput({
      data: workbenchData,
      draft,
    })

    expect(draft).toEqual(
      expect.objectContaining({
        applicantFullName: "Ana Torres",
        applicantFirstName: "Ana",
        applicantLastName: "Torres",
        mailingStreetAddress: "123 Main St",
        mailingCity: "Chicago",
        mailingState: "IL",
        mailingPostalCode: "60601",
        phoneNumber: "312-555-0100",
        primaryEmail: "ana@example.com",
        legalEntityHas501c3: "no",
        formationStatus: "501(c)(3) in progress",
        projectName: "Community kitchen",
        projectDurationType: "temporary",
        temporaryStartDate: "2026-07-01",
        temporaryEndDate: "2026-12-31",
        focusArea: "Food security",
        projectLocation: "Chicago, IL",
        budgetRows: [
          expect.objectContaining({
            category: "Food",
            description: "ingredients",
            totalCost: "12000.00",
          }),
        ],
        estimatedBudgetDollars: "12000",
        prospectiveFundingSources:
          "Community donors; Public fundraising goal: $25,000",
        publicBenefit: "Neighbors receive free meals.",
        initiativeHistory: "Started as a neighborhood project.",
        shortPublicDescription: "Community kitchen pilot.",
      })
    )
    expect(savedDraft).toEqual(
      expect.objectContaining({
        applicantFullName: "Saved Applicant",
        applicantFirstName: "Saved",
        applicantLastName: "Applicant",
        primaryEmail: "saved@example.com",
        projectName: "Saved project",
        estimatedBudgetDollars: "1000",
      })
    )
    expect(input.sourceSnapshot).toEqual(
      expect.objectContaining({
        prefill: workbenchData.applicationPrefill,
      })
    )
    expect(input.estimatedBudgetCents).toBe(1200000)
    expect(input.expenseSummary).toBe("Food - ingredients - $12000.00")
  })
})

function createWorkbenchData({
  applicantName,
  applicationPrefill = null,
  projectName,
}: Pick<
  FiscalSponsorshipProjectWorkbenchData,
  "applicantName" | "applicationPrefill" | "projectName"
>): FiscalSponsorshipProjectWorkbenchData {
  return {
    applicantName,
    applicationPrefill,
    canApproveApplication: false,
    canGenerateAgreement: false,
    canSendAgreement: false,
    documentActions: [],
    latestAgreementDocumentId: null,
    metrics: [],
    missingItems: [],
    nextStep: "Save application data",
    organizationName: "Coach House",
    phases: [],
    projectId: "project-1",
    projectName,
    readinessPercent: 42,
    requiredItems: [],
    reusableItems: [],
    reviewItems: [],
    signingActions: [],
    statusLabel: "Draft intake",
    timelineEvents: [],
  }
}


describe("anticipated fundraising", () => {
  it.each(["monthly", "annually", "total"] as const)("round-trips %s separately from the legacy expense budget", (period) => {
    const data = { projectId: "project-1", projectName: "Project", applicantName: "Applicant" }
    const original = buildFiscalSponsorshipApplicationDraft({ data })
    const draft = buildFiscalSponsorshipApplicationDraft({ data, application: {
      metadata: { fundraisingGoal: { amountCents: 1234567, period } },
      estimatedBudgetCents: 500000,
    } as never })
    expect(original.fundraisingGoalDollars).toBe("")
    expect(draft.fundraisingGoalDollars).toBe("12345.67")
    expect(draft.fundraisingGoalPeriod).toBe(period)
    expect(draft.estimatedBudgetDollars).toBe("5000")
    expect(readFundraisingGoal({ fundraisingGoal: { amountCents: parseFundraisingAmount(draft.fundraisingGoalDollars), period } })).toEqual({ amountCents: 1234567, period })
  })
  it("rejects malformed, negative, over-precision and unsafe amounts", () => {
    for (const value of ["abc10", "-10", "0", "1.234", "1,2", "999999999999999999"]) expect(parseFundraisingAmount(value)).toBeNull()
    expect(parseFundraisingAmount("$12,345.67")).toBe(1234567)
    expect(readFundraisingGoal({ fundraisingGoal: { amountCents: 100, period: "weekly" } })).toBeNull()
  })
})
