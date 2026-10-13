import { hasFundraisingGoal, readFundraisingGoal } from "./fundraising-goal"
import type {
  FiscalSponsorshipApplicationInput,
  FiscalSponsorshipApplicationStatus,
  FiscalSponsorshipLegalEntityType,
  FiscalSponsorshipProjectDurationType,
  NormalizeFiscalSponsorshipApplicationResult,
} from "../types"

export { buildFiscalSponsorshipAgreementDocument } from "./agreement-document"
export type { FiscalSponsorshipAgreementDocument } from "./agreement-document"
export { resolveDocuSealSubmitterSigningHref } from "./docuseal-submission"

const APPLICATION_STATUSES = new Set<FiscalSponsorshipApplicationStatus>([
  "draft",
  "submitted",
  "in_review",
  "needs_info",
  "approved",
  "declined",
  "agreement_ready",
  "signed",
  "countersigned",
])

const LEGAL_ENTITY_TYPES = new Set<FiscalSponsorshipLegalEntityType>([
  "corporation",
  "individual",
  "informal_group_with_ein",
  "llc",
  "partnership",
  "other",
])

const PROJECT_DURATION_TYPES = new Set<FiscalSponsorshipProjectDurationType>([
  "temporary",
  "ongoing_multi_year",
])

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function normalizeDateString(value: string | null | undefined) {
  const trimmed = normalizeOptionalString(value)
  if (!trimmed) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function normalizeBoolean(value: boolean | null | undefined) {
  return typeof value === "boolean" ? value : null
}

function normalizeBudgetCents(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }

  return Math.round(value)
}

function normalizeStatus(
  value: FiscalSponsorshipApplicationInput["status"]
): FiscalSponsorshipApplicationStatus {
  return value &&
    APPLICATION_STATUSES.has(value as FiscalSponsorshipApplicationStatus)
    ? (value as FiscalSponsorshipApplicationStatus)
    : "draft"
}

function normalizeLegalEntityType(
  value: FiscalSponsorshipApplicationInput["legalEntityType"]
) {
  return value &&
    LEGAL_ENTITY_TYPES.has(value as FiscalSponsorshipLegalEntityType)
    ? (value as FiscalSponsorshipLegalEntityType)
    : null
}

function normalizeProjectDurationType(
  value: FiscalSponsorshipApplicationInput["projectDurationType"]
) {
  return value &&
    PROJECT_DURATION_TYPES.has(value as FiscalSponsorshipProjectDurationType)
    ? (value as FiscalSponsorshipProjectDurationType)
    : null
}

export function normalizeFiscalSponsorshipInput(
  input: FiscalSponsorshipApplicationInput
): NormalizeFiscalSponsorshipApplicationResult {
  const projectId = input.projectId?.trim()
  if (!projectId) {
    return {
      ok: false,
      error: "Choose a project before saving this application.",
    }
  }

  if (hasFundraisingGoal(input.metadata) && !readFundraisingGoal(input.metadata)) {
    return { ok: false, error: "Enter a valid fundraising amount and choose Monthly, Annually, or Total." }
  }

  const applicantFirstName = normalizeOptionalString(input.applicantFirstName)
  const applicantLastName = normalizeOptionalString(input.applicantLastName)
  const inferredFullName = [applicantFirstName, applicantLastName]
    .filter(Boolean)
    .join(" ")
  const applicantFullName =
    normalizeOptionalString(input.applicantFullName) ||
    (inferredFullName.length > 0 ? inferredFullName : null)

  return {
    ok: true,
    value: {
      projectId,
      status: normalizeStatus(input.status),
      applicantFullName,
      applicantFirstName,
      applicantLastName,
      mailingStreetAddress: normalizeOptionalString(input.mailingStreetAddress),
      mailingStreetAddress2: normalizeOptionalString(
        input.mailingStreetAddress2
      ),
      mailingCity: normalizeOptionalString(input.mailingCity),
      mailingState: normalizeOptionalString(input.mailingState),
      mailingPostalCode: normalizeOptionalString(input.mailingPostalCode),
      phoneNumber: normalizeOptionalString(input.phoneNumber),
      primaryEmail: normalizeOptionalString(input.primaryEmail),
      legalEntityType: normalizeLegalEntityType(input.legalEntityType),
      legalEntityHas501c3: normalizeBoolean(input.legalEntityHas501c3),
      formationStatus: normalizeOptionalString(input.formationStatus),
      projectName: normalizeOptionalString(input.projectName),
      projectDurationType: normalizeProjectDurationType(
        input.projectDurationType
      ),
      temporaryStartDate: normalizeDateString(input.temporaryStartDate),
      temporaryEndDate: normalizeDateString(input.temporaryEndDate),
      focusArea: normalizeOptionalString(input.focusArea),
      projectDescription: normalizeOptionalString(input.projectDescription),
      projectLocation: normalizeOptionalString(input.projectLocation),
      estimatedBudgetCents: normalizeBudgetCents(input.estimatedBudgetCents),
      expenseSummary: normalizeOptionalString(input.expenseSummary),
      prospectiveFundingSources: normalizeOptionalString(
        input.prospectiveFundingSources
      ),
      publicBenefit: normalizeOptionalString(input.publicBenefit),
      leadershipBackground: normalizeOptionalString(input.leadershipBackground),
      initiativeHistory: normalizeOptionalString(input.initiativeHistory),
      shortPublicDescription: normalizeOptionalString(
        input.shortPublicDescription
      ),
      operatesOutsideUnitedStates: normalizeBoolean(
        input.operatesOutsideUnitedStates
      ),
      receivesInvestorReturnFunds: normalizeBoolean(
        input.receivesInvestorReturnFunds
      ),
      engagesInLobbying: normalizeBoolean(input.engagesInLobbying),
      hasLegalComplianceFinancialConcerns: normalizeBoolean(
        input.hasLegalComplianceFinancialConcerns
      ),
      concernsExplanation: normalizeOptionalString(input.concernsExplanation),
      sourceSnapshot: input.sourceSnapshot ?? {},
      documentTemplatePayload: input.documentTemplatePayload ?? {},
      metadata: input.metadata ?? {},
    },
  }
}
