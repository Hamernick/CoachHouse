import type { FiscalSponsorshipApplicationDraft } from "./application-draft"
import { parseFundraisingAmount } from "./fundraising-goal"
import { pickGuestFiscalDraft } from "./guest-draft"
import { guestSubmissionSchema } from "./guest-submission-schema"

export function guestSubmissionInput(draft: FiscalSponsorshipApplicationDraft) {
  const { fundraisingGoalDollars, fundraisingGoalPeriod, ...fields } = pickGuestFiscalDraft(draft)
  const boolean = (value: string | undefined) => value === "yes" ? true : value === "no" ? false : null
  return guestSubmissionSchema.safeParse({ application: {
    ...fields,
    fundraisingGoal: { amountCents: parseFundraisingAmount(fundraisingGoalDollars ?? ""), period: fundraisingGoalPeriod },
    legalEntityHas501c3: draft.legalEntityType === "individual" ? null : boolean(fields.legalEntityHas501c3),
    temporaryStartDate: fields.temporaryStartDate || null, temporaryEndDate: fields.temporaryEndDate || null,
    operatesOutsideUnitedStates: boolean(fields.operatesOutsideUnitedStates), engagesInLobbying: boolean(fields.engagesInLobbying),
    hasLegalComplianceFinancialConcerns: boolean(fields.hasLegalComplianceFinancialConcerns),
  } })
}

export function guestFieldName(path: PropertyKey[]) {
  return path[1] === "fundraisingGoal" ? "fundraisingGoalDollars" : String(path[1] ?? "application")
}
export function guestFieldLabel(field: string) {
  const names: Record<string, string> = {
    applicantFirstName: "First name", applicantLastName: "Last name", primaryEmail: "Email",
    fundraisingGoalDollars: "Fundraising amount", legalEntityType: "Legal entity",
    formationStatus: "Formation status", projectDurationType: "Project duration",
  }
  return names[field] ?? field.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())
}
