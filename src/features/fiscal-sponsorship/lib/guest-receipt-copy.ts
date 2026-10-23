import { parseGuestApplicationAnswers, type GuestApplicationAnswers } from "./guest-followup"

const fields: [keyof GuestApplicationAnswers, string][] = [
  ["applicantFirstName", "First name"], ["applicantLastName", "Last name"], ["primaryEmail", "Email"],
  ["mailingStreetAddress", "Street address"], ["mailingStreetAddress2", "Address line 2"],
  ["mailingCity", "City"], ["mailingState", "State"], ["mailingPostalCode", "Postal code"], ["phoneNumber", "Phone"],
  ["legalEntityType", "Legal entity"], ["legalEntityHas501c3", "501(c)(3) status"], ["formationStatus", "Formation status"],
  ["projectName", "Project name"], ["projectDescription", "Project description"], ["projectLocation", "Project location"],
  ["projectDurationType", "Project duration"], ["temporaryStartDate", "Start date"], ["temporaryEndDate", "End date"],
  ["focusArea", "Focus area"], ["fundraisingGoal", "Fundraising goal"], ["expenseSummary", "Expenses"],
  ["prospectiveFundingSources", "Funding sources"], ["publicBenefit", "Public benefit"],
  ["leadershipBackground", "Leadership background"], ["initiativeHistory", "Initiative history"],
  ["operatesOutsideUnitedStates", "Activities outside the United States"], ["engagesInLobbying", "Lobbying"],
  ["hasLegalComplianceFinancialConcerns", "Legal, compliance or financial concerns"], ["concernsExplanation", "Explanation"],
]

export function guestReceiptDetails(snapshot: Record<string, unknown>) {
  const answers = parseGuestApplicationAnswers(snapshot)
  const format = (key: keyof GuestApplicationAnswers) => {
    const value = answers[key]
    if (value === null || value === undefined || value === "") return "Not provided"
    if (typeof value === "boolean") return value ? "Yes" : "No"
    if (typeof value === "object") return `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value.amountCents / 100)} (${value.period})`
    return key === "legalEntityType" || key === "projectDurationType" ? String(value).replaceAll("_", " ") : String(value)
  }
  return fields.map(([key, label]) => ({ label, value: format(key) }))
}

export function guestReceiptCopy(snapshot: Record<string, unknown>) {
  return guestReceiptDetails(snapshot).map(({ label, value }) => `${label}:\n${value}`).join("\n\n")
}
