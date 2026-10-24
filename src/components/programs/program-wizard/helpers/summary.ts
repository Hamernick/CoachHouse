import type { ProgramWizardFormState } from "../schema"
import { computeBudgetBreakdown } from "./budget"
import { computeFeasibility, money, ratio } from "./feasibility"

export function summaryText(form: ProgramWizardFormState) {
  const budget = computeBudgetBreakdown(form)
  const participantReceives = [
    form.participantReceive1,
    form.participantReceive2,
    form.participantReceive3,
  ]
    .map((entry) => entry.trim())
    .filter(Boolean)

  const outcomes = [
    form.successOutcome1,
    form.successOutcome2,
    form.successOutcome3,
  ]
    .map((entry) => entry.trim())
    .filter(Boolean)

  const feasibility = computeFeasibility(form)

  return [
    `Resource Brief: ${form.title.trim() || "Untitled resource"}`,
    ``,
    `Summary: ${form.oneSentence.trim() || "Not set"}`,
    `Resource type: ${form.objectKind}`,
    `Public benefit focus: ${form.programType}`,
    `Delivery: ${form.coreFormat}${form.formatAddons.length > 0 ? ` + ${form.formatAddons.join(", ")}` : ""}`,
    ``,
    `Who is served: ${form.servesWho.trim() || "Not set"}`,
    `Eligibility: ${form.eligibilityRules.trim() || "Not set"}`,
    `Participants receive: ${participantReceives.length > 0 ? participantReceives.join("; ") : "Not set"}`,
    `Outcomes: ${outcomes.length > 0 ? outcomes.join("; ") : "Not set"}`,
    ``,
    `Pilot size: ${form.pilotPeopleServed} participants`,
    `Staffing: ${form.staffCount} staff, ${form.volunteerCount} volunteers`,
    `Start month: ${form.startMonth || "Not set"}`,
    `Duration: ${form.durationLabel.trim() || "Not set"}`,
    `Frequency: ${form.frequency.trim() || "Not set"}`,
    `Location: ${form.locationMode}${form.locationDetails.trim() ? ` (${form.locationDetails.trim()})` : ""}`,
    `Budget: ${money(budget.totalBudget)}`,
    `Raised or committed: ${money(budget.raised)}`,
    `Fundraising need: ${money(budget.fundraisingTarget)}`,
    `Cost per participant: ${money(feasibility.costPerParticipant)}`,
    `Staff ratio: ${ratio(feasibility.participantsPerStaff)}`,
    `Estimated service intensity: ${
      feasibility.serviceIntensity !== null
        ? `${feasibility.serviceIntensity} sessions`
        : "Not enough data"
    }`,
    `Feasibility flags: ${feasibility.flags.length > 0 ? feasibility.flags.join("; ") : "None"}`,
  ].join("\n")
}
