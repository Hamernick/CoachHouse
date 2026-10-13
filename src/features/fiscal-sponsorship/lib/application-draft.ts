import { parseFundraisingAmount, readFundraisingGoal, type FundraisingPeriod } from "./fundraising-goal"
import type {
  FiscalSponsorshipApplicationInput,
  FiscalSponsorshipApplicationRecord,
  FiscalSponsorshipApplicationStatus,
  FiscalSponsorshipLegalEntityType,
  FiscalSponsorshipProjectDurationType,
  FiscalSponsorshipProjectWorkbenchData,
} from "../types"
import type { BudgetTableRow } from "@/lib/modules"
import {
  getBudgetTotal,
  normalizeFiscalSponsorshipBudgetRows,
  parseBudgetRows,
  readBudgetRowsFromMetadata,
  readBudgetSourceActivityIdFromMetadata,
  summarizeBudgetRows,
} from "./budget-plan"

export type FiscalSponsorshipBooleanChoice = "unknown" | "yes" | "no"

export type FiscalSponsorshipApplicationDraft = {
  projectId: string
  status: FiscalSponsorshipApplicationStatus
  applicantFullName: string
  applicantFirstName: string
  applicantLastName: string
  mailingStreetAddress: string
  mailingStreetAddress2: string
  mailingCity: string
  mailingState: string
  mailingPostalCode: string
  phoneNumber: string
  primaryEmail: string
  legalEntityType: FiscalSponsorshipLegalEntityType | ""
  legalEntityHas501c3: FiscalSponsorshipBooleanChoice
  formationStatus: string
  projectName: string
  projectDurationType: FiscalSponsorshipProjectDurationType | ""
  temporaryStartDate: string
  temporaryEndDate: string
  focusArea: string
  projectDescription: string
  projectLocation: string
  budgetRows: BudgetTableRow[]
  fundraisingGoalDollars: string
  fundraisingGoalPeriod: FundraisingPeriod
  estimatedBudgetDollars: string
  expenseSummary: string
  prospectiveFundingSources: string
  publicBenefit: string
  leadershipBackground: string
  initiativeHistory: string
  shortPublicDescription: string
  operatesOutsideUnitedStates: FiscalSponsorshipBooleanChoice
  receivesInvestorReturnFunds: FiscalSponsorshipBooleanChoice
  engagesInLobbying: FiscalSponsorshipBooleanChoice
  hasLegalComplianceFinancialConcerns: FiscalSponsorshipBooleanChoice
  concernsExplanation: string
}

export const FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "needs_info", label: "Needs info" },
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "agreement_ready", label: "Agreement ready" },
  { value: "signed", label: "Signed" },
  { value: "countersigned", label: "Countersigned" },
  { value: "declined", label: "Declined" },
] satisfies Array<{
  value: FiscalSponsorshipApplicationStatus
  label: string
}>

export const FISCAL_SPONSORSHIP_LEGAL_ENTITY_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "informal_group_with_ein", label: "Informal group with EIN" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "other", label: "Other" },
] satisfies Array<{ value: FiscalSponsorshipLegalEntityType; label: string }>

export const FISCAL_SPONSORSHIP_PROJECT_DURATION_OPTIONS = [
  { value: "temporary", label: "Temporary or one-time" },
  { value: "ongoing_multi_year", label: "Ongoing / multi-year" },
] satisfies Array<{
  value: FiscalSponsorshipProjectDurationType
  label: string
}>

export const FISCAL_SPONSORSHIP_BOOLEAN_OPTIONS = [
  { value: "unknown", label: "Not set" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] satisfies Array<{ value: FiscalSponsorshipBooleanChoice; label: string }>

function text(value: string | null | undefined) {
  return value?.trim() ?? ""
}

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = text(value)
    if (trimmed) return trimmed
  }

  return ""
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

function booleanChoice(value: boolean | null | undefined) {
  if (value === true) return "yes"
  if (value === false) return "no"
  return "unknown"
}

function booleanValue(value: FiscalSponsorshipBooleanChoice) {
  if (value === "yes") return true
  if (value === "no") return false
  return null
}

function applicantNameFromWorkbench(
  data: Pick<FiscalSponsorshipProjectWorkbenchData, "applicantName">
) {
  return data.applicantName === "Applicant needed" ? "" : data.applicantName
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  }
}

function formatBudgetCentsForDraft(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return ""
  }

  return String(value / 100)
}

function parseBudgetDollarsToCents(value: string) {
  const amount = Number(value.replace(/[^\d.-]/g, ""))
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

export function buildFiscalSponsorshipApplicationDraft({
  application,
  data,
}: {
  application?: FiscalSponsorshipApplicationRecord | null
  data: Pick<FiscalSponsorshipProjectWorkbenchData, "projectId" | "projectName" | "applicantName" | "applicationPrefill">
}): FiscalSponsorshipApplicationDraft {
  const fundraisingGoal = readFundraisingGoal(application?.metadata)
  const prefill = data.applicationPrefill ?? null
  const prefillApplicantName = firstText(
    prefill?.applicantFullName,
    [prefill?.applicantFirstName, prefill?.applicantLastName]
      .filter(Boolean)
      .join(" ")
  )
  const fallbackApplicantName =
    prefillApplicantName || applicantNameFromWorkbench(data)
  const fallbackNameParts = splitName(fallbackApplicantName)
  const applicationName = text(application?.applicantFullName)
  const fullName = applicationName || fallbackApplicantName
  const fullNameParts = splitName(fullName)
  const savedBudgetRows = readBudgetRowsFromMetadata(application?.metadata)
  const savedBudgetActivityId = readBudgetSourceActivityIdFromMetadata(
    application?.metadata
  )
  const selectedActivityId = prefill?.sourceActivityId?.trim() || null
  const sourceActivityChanged = Boolean(
    selectedActivityId &&
    savedBudgetActivityId &&
    selectedActivityId !== savedBudgetActivityId
  )
  const prefillBudgetRows = normalizeFiscalSponsorshipBudgetRows(
    prefill?.budgetRows
  )
  const savedSummaryBudgetRows = parseBudgetRows(
    text(application?.expenseSummary)
  )
  const prefillSummaryBudgetRows = parseBudgetRows(
    text(prefill?.expenseSummary)
  )
  const nextPrefillBudgetRows =
    prefillBudgetRows.length > 0 ? prefillBudgetRows : prefillSummaryBudgetRows
  const budgetRows = sourceActivityChanged
    ? nextPrefillBudgetRows
    : savedBudgetRows.length > 0
      ? savedBudgetRows
      : application
        ? savedSummaryBudgetRows
        : nextPrefillBudgetRows
  const budgetTotal = getBudgetTotal(budgetRows)
  const storedEstimatedBudgetDollars = formatBudgetCentsForDraft(
    application?.estimatedBudgetCents ?? prefill?.estimatedBudgetCents
  )
  const estimatedBudgetDollars =
    budgetTotal > 0 ? String(budgetTotal) : storedEstimatedBudgetDollars

  return {
    projectId: data.projectId,
    status: application?.status ?? "draft",
    applicantFullName: fullName,
    applicantFirstName: firstText(
      application?.applicantFirstName,
      prefill?.applicantFirstName,
      fallbackNameParts.firstName,
      fullNameParts.firstName
    ),
    applicantLastName: firstText(
      application?.applicantLastName,
      prefill?.applicantLastName,
      fallbackNameParts.lastName,
      fullNameParts.lastName
    ),
    mailingStreetAddress: firstText(
      application?.mailingStreetAddress,
      prefill?.mailingStreetAddress
    ),
    mailingStreetAddress2: firstText(
      application?.mailingStreetAddress2,
      prefill?.mailingStreetAddress2
    ),
    mailingCity: firstText(application?.mailingCity, prefill?.mailingCity),
    mailingState: firstText(application?.mailingState, prefill?.mailingState),
    mailingPostalCode: firstText(
      application?.mailingPostalCode,
      prefill?.mailingPostalCode
    ),
    phoneNumber: firstText(application?.phoneNumber, prefill?.phoneNumber),
    primaryEmail: firstText(application?.primaryEmail, prefill?.primaryEmail),
    legalEntityType: application?.legalEntityType ?? "",
    legalEntityHas501c3: booleanChoice(
      application?.legalEntityHas501c3 ?? prefill?.legalEntityHas501c3
    ),
    formationStatus: firstText(
      application?.formationStatus,
      prefill?.formationStatus
    ),
    projectName: firstText(
      application?.projectName,
      prefill?.projectName,
      data.projectName
    ),
    projectDurationType:
      application?.projectDurationType ?? prefill?.projectDurationType ?? "",
    temporaryStartDate: firstText(
      application?.temporaryStartDate,
      prefill?.temporaryStartDate
    ),
    temporaryEndDate: firstText(
      application?.temporaryEndDate,
      prefill?.temporaryEndDate
    ),
    focusArea: firstText(application?.focusArea, prefill?.focusArea),
    projectDescription: firstText(
      application?.projectDescription,
      prefill?.projectDescription
    ),
    projectLocation: firstText(
      application?.projectLocation,
      prefill?.projectLocation
    ),
    budgetRows,
    fundraisingGoalDollars: formatBudgetCentsForDraft(fundraisingGoal?.amountCents),
    fundraisingGoalPeriod: fundraisingGoal?.period ?? "total",
    estimatedBudgetDollars,
    expenseSummary: firstText(
      application?.expenseSummary,
      prefill?.expenseSummary
    ),
    prospectiveFundingSources: firstText(
      application?.prospectiveFundingSources,
      prefill?.prospectiveFundingSources
    ),
    publicBenefit: firstText(
      application?.publicBenefit,
      prefill?.publicBenefit
    ),
    leadershipBackground: firstText(
      application?.leadershipBackground,
      prefill?.leadershipBackground
    ),
    initiativeHistory: firstText(
      application?.initiativeHistory,
      prefill?.initiativeHistory
    ),
    shortPublicDescription: firstText(
      application?.shortPublicDescription,
      prefill?.shortPublicDescription
    ),
    operatesOutsideUnitedStates: booleanChoice(
      application?.operatesOutsideUnitedStates
    ),
    receivesInvestorReturnFunds: booleanChoice(
      application?.receivesInvestorReturnFunds
    ),
    engagesInLobbying: booleanChoice(application?.engagesInLobbying),
    hasLegalComplianceFinancialConcerns: booleanChoice(
      application?.hasLegalComplianceFinancialConcerns
    ),
    concernsExplanation: text(application?.concernsExplanation),
  }
}

export function buildFiscalSponsorshipApplicationInput({
  data,
  draft,
}: {
  data: FiscalSponsorshipProjectWorkbenchData
  draft: FiscalSponsorshipApplicationDraft
}): FiscalSponsorshipApplicationInput {
  const derivedApplicantFullName = firstText(
    [draft.applicantFirstName, draft.applicantLastName]
      .filter(Boolean)
      .join(" "),
    draft.applicantFullName
  )
  const individualApplicant = draft.legalEntityType === "individual"

  return {
    projectId: draft.projectId,
    status: draft.status,
    applicantFullName: nullableText(derivedApplicantFullName),
    applicantFirstName: nullableText(draft.applicantFirstName),
    applicantLastName: nullableText(draft.applicantLastName),
    mailingStreetAddress: nullableText(draft.mailingStreetAddress),
    mailingStreetAddress2: nullableText(draft.mailingStreetAddress2),
    mailingCity: nullableText(draft.mailingCity),
    mailingState: nullableText(draft.mailingState),
    mailingPostalCode: nullableText(draft.mailingPostalCode),
    phoneNumber: nullableText(draft.phoneNumber),
    primaryEmail: nullableText(draft.primaryEmail),
    legalEntityType: draft.legalEntityType || null,
    legalEntityHas501c3: individualApplicant
      ? null
      : booleanValue(draft.legalEntityHas501c3),
    formationStatus: individualApplicant
      ? null
      : nullableText(draft.formationStatus),
    projectName: nullableText(draft.projectName),
    projectDurationType: draft.projectDurationType || null,
    temporaryStartDate: nullableText(draft.temporaryStartDate),
    temporaryEndDate: nullableText(draft.temporaryEndDate),
    focusArea: nullableText(draft.focusArea),
    projectDescription: nullableText(draft.projectDescription),
    projectLocation: nullableText(draft.projectLocation),
    estimatedBudgetCents: parseBudgetDollarsToCents(
      draft.estimatedBudgetDollars
    ),
    expenseSummary: nullableText(summarizeBudgetRows(draft.budgetRows)),
    prospectiveFundingSources: nullableText(draft.prospectiveFundingSources),
    publicBenefit: nullableText(draft.publicBenefit),
    leadershipBackground: nullableText(draft.leadershipBackground),
    initiativeHistory: nullableText(draft.initiativeHistory),
    shortPublicDescription: nullableText(draft.shortPublicDescription),
    operatesOutsideUnitedStates: booleanValue(
      draft.operatesOutsideUnitedStates
    ),
    receivesInvestorReturnFunds: booleanValue(
      draft.receivesInvestorReturnFunds
    ),
    engagesInLobbying: booleanValue(draft.engagesInLobbying),
    hasLegalComplianceFinancialConcerns: booleanValue(
      draft.hasLegalComplianceFinancialConcerns
    ),
    concernsExplanation: nullableText(draft.concernsExplanation),
    sourceSnapshot: {
      source: "member-workspace-project-fiscal-workbench",
      capturedAt: new Date().toISOString(),
      project: {
        id: data.projectId,
        name: data.projectName,
      },
      organization: {
        name: data.organizationName,
      },
      activity: data.applicationPrefill?.sourceActivityId
        ? {
            id: data.applicationPrefill.sourceActivityId,
            title: data.applicationPrefill.sourceActivityTitle ?? null,
            kind: data.applicationPrefill.sourceActivityKind ?? null,
          }
        : null,
      workbench: {
        statusLabel: data.statusLabel,
        readinessPercent: data.readinessPercent,
        nextStep: data.nextStep,
        reusableItems: data.reusableItems,
        missingItems: data.missingItems,
        reviewItems: data.reviewItems,
      },
      prefill: data.applicationPrefill ?? null,
    },
    documentTemplatePayload: {
      agreement: {
        applicantFullName: nullableText(derivedApplicantFullName),
        organizationName: data.organizationName,
        projectName: nullableText(draft.projectName),
        publicDescription: nullableText(draft.shortPublicDescription),
      },
      disclosure: {
        projectName: nullableText(draft.projectName),
      },
    },
    metadata: {
      budgetMode: "fundraising_goal",
      fundraisingGoal: { amountCents: parseFundraisingAmount(draft.fundraisingGoalDollars), period: draft.fundraisingGoalPeriod },
      budgetRows: draft.budgetRows,
      lastEditedSurface: "project-fiscal-sponsorship-drawer",
      selectedActivityId: data.applicationPrefill?.sourceActivityId ?? null,
    },
  }
}
