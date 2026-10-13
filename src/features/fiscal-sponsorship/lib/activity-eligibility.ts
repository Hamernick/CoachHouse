import type { FiscalSponsorshipApplicationPrefill } from "../types"

export type FiscalSponsorshipActivityEligibilityState =
  | "inactive"
  | "lit"
  | "active"

export type FiscalSponsorshipActivityEligibilityCriterion = {
  id:
    | "impact-narrative"
    | "us-operations"
    | "funding-use"
    | "mission-fit"
    | "tax-mailing"
  label: string
  met: boolean
  detail: string
}

export type FiscalSponsorshipActivityEligibility = {
  criteria: FiscalSponsorshipActivityEligibilityCriterion[]
  completedCount: number
  eligible: boolean
  label: string
  state: Exclude<FiscalSponsorshipActivityEligibilityState, "active">
  totalCount: number
}

export type FiscalSponsorshipActivityEligibilityActivity = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
  location?: string | null
  locationType?: string | null
  addressCity?: string | null
  addressState?: string | null
  addressCountry?: string | null
  focusArea?: string | null
  objectKind?: string | null
  publicBenefit?: string | null
  estimatedBudgetCents?: number | null
  goalCents?: number | null
  wizardSnapshot?: Record<string, unknown> | null
}

export type FiscalSponsorshipActivityEligibilityOrganization = {
  description?: string | null
  ein?: string | null
  mission?: string | null
  need?: string | null
  address?: string | null
  addressStreet?: string | null
  addressCity?: string | null
  addressState?: string | null
  addressPostal?: string | null
  addressCountry?: string | null
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function hasText(value: string | null | undefined) {
  return Boolean(cleanText(value))
}

function readSnapshotString(
  snapshot: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = snapshot?.[key]
  return typeof value === "string" ? cleanText(value) : null
}

function readSnapshotTextList(
  snapshot: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = snapshot?.[key]
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => (typeof entry === "string" ? cleanText(entry) : null))
    .filter((entry): entry is string => Boolean(entry))
}

function hasPositiveAmount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function hasOperatingLocation({
  activity,
  organization,
  prefill,
}: {
  activity: FiscalSponsorshipActivityEligibilityActivity | null | undefined
  organization:
    | FiscalSponsorshipActivityEligibilityOrganization
    | null
    | undefined
  prefill: FiscalSponsorshipApplicationPrefill | null | undefined
}) {
  if (
    hasText(activity?.addressCountry) ||
    hasText(organization?.addressCountry)
  ) {
    return true
  }

  const state = cleanText(
    activity?.addressState ??
      prefill?.mailingState ??
      organization?.addressState
  )
  const city = cleanText(
    activity?.addressCity ?? prefill?.mailingCity ?? organization?.addressCity
  )
  const postal = cleanText(
    prefill?.mailingPostalCode ?? organization?.addressPostal
  )

  return Boolean(state && (city || postal))
}

function hasMailingAddress({
  organization,
  prefill,
}: {
  organization:
    | FiscalSponsorshipActivityEligibilityOrganization
    | null
    | undefined
  prefill: FiscalSponsorshipApplicationPrefill | null | undefined
}) {
  const street = cleanText(
    prefill?.mailingStreetAddress ??
      organization?.addressStreet ??
      organization?.address
  )
  const city = cleanText(prefill?.mailingCity ?? organization?.addressCity)
  const state = cleanText(prefill?.mailingState ?? organization?.addressState)
  const postal = cleanText(
    prefill?.mailingPostalCode ?? organization?.addressPostal
  )

  return Boolean(street && city && state && postal)
}

export function analyzeFiscalSponsorshipActivityEligibility({
  activity,
  organization,
  prefill,
}: {
  activity?: FiscalSponsorshipActivityEligibilityActivity | null
  organization?: FiscalSponsorshipActivityEligibilityOrganization | null
  prefill?: FiscalSponsorshipApplicationPrefill | null
}): FiscalSponsorshipActivityEligibility {
  const snapshot = activity?.wizardSnapshot
  const publicBenefit = cleanText(activity?.publicBenefit)
  const successOutcomes = readSnapshotTextList(snapshot, "successOutcomes")
  const oneSentence = readSnapshotString(snapshot, "oneSentence")
  const fundingSource = readSnapshotString(snapshot, "fundingSource")
  const focusArea =
    cleanText(activity?.focusArea) ??
    readSnapshotString(snapshot, "programType")
  const estimatedBudgetKnown =
    hasPositiveAmount(activity?.estimatedBudgetCents) ||
    hasPositiveAmount(activity?.goalCents)
  const hasActivityNarrative = Boolean(
    cleanText(activity?.title) &&
    (cleanText(activity?.description) ||
      cleanText(activity?.subtitle) ||
      oneSentence)
  )
  const hasPublicBenefit = Boolean(
    publicBenefit || successOutcomes.length > 0 || prefill?.publicBenefit
  )
  const hasMissionFit = Boolean(
    focusArea ||
    cleanText(activity?.objectKind) ||
    cleanText(organization?.mission) ||
    cleanText(organization?.need)
  )
  const hasFundingUseSignal = Boolean(fundingSource || estimatedBudgetKnown)
  const hasTaxId = hasText(organization?.ein)
  const mailingReady = hasMailingAddress({ organization, prefill })

  const criteria: FiscalSponsorshipActivityEligibilityCriterion[] = [
    {
      id: "impact-narrative",
      label: "Impact narrative",
      met: hasPublicBenefit || hasActivityNarrative,
      detail: hasPublicBenefit ? "impact found" : "add impact",
    },
    {
      id: "us-operations",
      label: "Operating location",
      met: hasOperatingLocation({ activity, organization, prefill }),
      detail: "location check",
    },
    {
      id: "funding-use",
      label: "Funding use",
      met: hasFundingUseSignal,
      detail: hasFundingUseSignal ? "use signal" : "add funding use",
    },
    {
      id: "mission-fit",
      label: "Mission fit signal",
      met: hasMissionFit,
      detail: hasMissionFit ? "mission signal" : "add focus",
    },
    {
      id: "tax-mailing",
      label: "Tax ID + mailing",
      met: hasTaxId && mailingReady,
      detail: hasTaxId && mailingReady ? "ready" : "need EIN/address",
    },
  ]
  const completedCount = criteria.filter((criterion) => criterion.met).length
  const totalCount = criteria.length
  const eligible = completedCount === totalCount

  return {
    criteria,
    completedCount,
    eligible,
    label: eligible ? "Review ready" : `${completedCount}/${totalCount}`,
    state: eligible ? "lit" : "inactive",
    totalCount,
  }
}
