import type { FiscalSponsorshipApplicationRecord } from "../types"
import { readFundraisingGoal } from "../lib/fundraising-goal"

export function FiscalGuestApplicationDetails({ application: a }: { application: FiscalSponsorshipApplicationRecord }) {
  const goal = readFundraisingGoal(a.metadata)
  const amount = goal?.amountCents ?? a.estimatedBudgetCents
  const fundraising = amount == null ? null : `${new Intl.NumberFormat(undefined, {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(amount / 100)} ${goal?.period ?? "total"}`
  const yesNo = (value: boolean | null) => value == null ? null : value ? "Yes" : "No"
  const groups: { title: string; fields: [string, string | null][] }[] = [
    { title: "Applicant", fields: [
      ["Name", a.applicantFullName], ["Email", a.primaryEmail], ["Phone", a.phoneNumber],
      ["Mailing address", [a.mailingStreetAddress, a.mailingStreetAddress2, a.mailingCity, a.mailingState, a.mailingPostalCode].filter(Boolean).join(", ")],
      ["Entity type", a.legalEntityType?.replaceAll("_", " ") ?? null],
      ["Formation status", a.formationStatus], ["501(c)(3)", yesNo(a.legalEntityHas501c3)],
    ] },
    { title: "Project", fields: [
      ["Name", a.projectName], ["Description", a.projectDescription], ["Location", a.projectLocation],
      ["Focus", a.focusArea], ["Duration", a.projectDurationType?.replaceAll("_", " ") ?? null],
      ["Start date", a.temporaryStartDate], ["End date", a.temporaryEndDate],
      ["Public benefit", a.publicBenefit], ["Leadership", a.leadershipBackground], ["History", a.initiativeHistory],
    ] },
    { title: "Funding", fields: [["Fundraising goal", fundraising], ["Funding sources", a.prospectiveFundingSources], ["Expenses", a.expenseSummary]] },
    { title: "Eligibility", fields: [
      ["Operates outside the U.S.", yesNo(a.operatesOutsideUnitedStates)],
      ["Lobbying", yesNo(a.engagesInLobbying)],
      ["Legal, compliance or financial concerns", yesNo(a.hasLegalComplianceFinancialConcerns)],
      ["Explanation", a.concernsExplanation],
    ] },
  ]
  return (
    <div className="space-y-5 py-3">
      {groups.map(({ title, fields }) => (
        <section key={title}>
          <h3 className="mb-2 text-sm font-medium">{title}</h3>
          <dl className="space-y-3">
            {fields.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{value || "Not provided"}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
