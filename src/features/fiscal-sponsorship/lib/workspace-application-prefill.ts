import { formatFiscalSponsorshipProgramAmount, resolveFiscalSponsorshipProgramLocation } from "./application-data"
import type { FiscalSponsorshipApplicationPrefill, FiscalSponsorshipProgramOption } from "../types"

// The workspace's legacy prefill includes its first program. Starting another
// application may reuse organization identity, never that program's budget/dates.
export function buildWorkspaceApplicantPrefill(
  base: FiscalSponsorshipApplicationPrefill | null
): FiscalSponsorshipApplicationPrefill {
  return {
    applicantFullName: base?.applicantFullName,
    applicantFirstName: base?.applicantFirstName,
    applicantLastName: base?.applicantLastName,
    mailingStreetAddress: base?.mailingStreetAddress,
    mailingStreetAddress2: base?.mailingStreetAddress2,
    mailingCity: base?.mailingCity,
    mailingState: base?.mailingState,
    mailingPostalCode: base?.mailingPostalCode,
    phoneNumber: base?.phoneNumber,
    primaryEmail: base?.primaryEmail,
    legalEntityHas501c3: base?.legalEntityHas501c3,
    formationStatus: base?.formationStatus,
  }
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = cleanText(value)
    if (cleaned) return cleaned
  }

  return null
}

function dateInputValue(value: string | null | undefined) {
  const cleaned = cleanText(value)
  if (!cleaned) return null

  const dateMatch = cleaned.match(/^\d{4}-\d{2}-\d{2}/)
  return dateMatch ? dateMatch[0] : null
}

function resolveProgramSourceLabel(program: FiscalSponsorshipProgramOption) {
  return firstText(program.objectKind, program.focusArea, "Activity")
}

export function buildSelectedProgramPrefill({
  basePrefill,
  program,
}: {
  basePrefill: FiscalSponsorshipApplicationPrefill | null
  program: FiscalSponsorshipProgramOption | null
}): FiscalSponsorshipApplicationPrefill | null {
  if (!program) return basePrefill

  const location = resolveFiscalSponsorshipProgramLocation(program)
  const formattedGoal = formatFiscalSponsorshipProgramAmount(program.goalCents)
  const formattedRaised = formatFiscalSponsorshipProgramAmount(
    program.raisedCents
  )
  const fundingParts = [
    program.prospectiveFundingSources,
    formattedGoal ? `Public fundraising goal: ${formattedGoal}` : null,
    formattedRaised ? `Raised to date: ${formattedRaised}` : null,
  ].filter((part): part is string => Boolean(part))
  const estimatedBudgetCents =
    typeof program.estimatedBudgetCents === "number" &&
    program.estimatedBudgetCents > 0
      ? program.estimatedBudgetCents
      : typeof program.goalCents === "number" && program.goalCents > 0
        ? program.goalCents
        : (basePrefill?.estimatedBudgetCents ?? null)

  return {
    ...basePrefill,
    sourceActivityId: program.id,
    sourceActivityTitle: cleanText(program.title),
    sourceActivityKind: resolveProgramSourceLabel(program),
    projectName: firstText(program.title, basePrefill?.projectName),
    projectDescription: firstText(
      program.description,
      program.subtitle,
      basePrefill?.projectDescription
    ),
    projectLocation: firstText(
      location === "Location needed" ? null : location,
      basePrefill?.projectLocation
    ),
    focusArea: firstText(
      program.focusArea,
      program.objectKind,
      basePrefill?.focusArea
    ),
    projectDurationType: dateInputValue(program.endDate)
      ? "temporary"
      : dateInputValue(program.startDate)
        ? "ongoing_multi_year"
        : (basePrefill?.projectDurationType ?? null),
    temporaryStartDate: firstText(
      dateInputValue(program.startDate),
      basePrefill?.temporaryStartDate
    ),
    temporaryEndDate: firstText(
      dateInputValue(program.endDate),
      basePrefill?.temporaryEndDate
    ),
    estimatedBudgetCents,
    budgetRows:
      program.budgetRows && program.budgetRows.length > 0
        ? program.budgetRows
        : (basePrefill?.budgetRows ?? null),
    expenseSummary: firstText(
      program.expenseSummary,
      basePrefill?.expenseSummary
    ),
    prospectiveFundingSources: firstText(
      fundingParts.join("; "),
      basePrefill?.prospectiveFundingSources
    ),
    publicBenefit: firstText(program.publicBenefit, basePrefill?.publicBenefit),
    shortPublicDescription: firstText(
      program.subtitle,
      program.description,
      basePrefill?.shortPublicDescription
    ),
  }
}

