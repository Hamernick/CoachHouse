import { hasFundraisingGoal, readFundraisingGoal } from "../lib/fundraising-goal"
import type { FiscalApplicationRow } from "./workflow-support"

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

export function validateApplicationForSubmission(
  application: FiscalApplicationRow
) {
  const missingFields: string[] = []

  if (
    !hasText(application.applicant_full_name) &&
    (!hasText(application.applicant_first_name) ||
      !hasText(application.applicant_last_name))
  ) {
    missingFields.push("applicant name")
  }

  if (!hasText(application.primary_email)) missingFields.push("primary email")
  if (!hasText(application.mailing_street_address)) {
    missingFields.push("U.S. mailing address")
  }
  if (!hasText(application.mailing_city)) missingFields.push("mailing city")
  if (!hasText(application.mailing_state)) missingFields.push("mailing state")
  if (!hasText(application.mailing_postal_code)) {
    missingFields.push("mailing postal code")
  }
  if (!hasText(application.legal_entity_type)) {
    missingFields.push("legal entity type")
  }
  if (
    application.legal_entity_type &&
    application.legal_entity_type !== "individual" &&
    !hasText(application.formation_status)
  ) {
    missingFields.push("formation status")
  }
  if (!hasText(application.project_name)) missingFields.push("project name")
  if (!hasText(application.project_description)) {
    missingFields.push("project description")
  }
  if (!hasText(application.public_benefit)) missingFields.push("public benefit")
  if (!hasText(application.project_duration_type)) {
    missingFields.push("project duration")
  }
  const goal = readFundraisingGoal(application.metadata)
  if (hasFundraisingGoal(application.metadata)) {
    if (!goal?.amountCents) missingFields.push("anticipated fundraising amount and timeframe")
  } else if (!application.estimated_budget_cents || application.estimated_budget_cents <= 0) {
    // Existing applications retain their original total budget; do not reinterpret it as a recurring goal.
    missingFields.push("anticipated fundraising amount")
  }
  if (!hasText(application.prospective_funding_sources)) {
    missingFields.push("funding sources")
  }

  if (missingFields.length > 0) {
    return `Complete these fiscal application fields before submitting: ${missingFields.join(", ")}.`
  }

  if (typeof application.operates_outside_united_states !== "boolean" || typeof application.engages_in_lobbying !== "boolean") {
    return "Answer the questions about operating outside the United States and lobbying before submitting."
  }
  if ([application.operates_outside_united_states, application.engages_in_lobbying,
    application.has_legal_compliance_financial_concerns].includes(true) && !hasText(application.concerns_explanation)) {
    return "Explain each eligibility answer marked Yes before submitting. These answers require review, not automatic rejection."
  }

  return null
}
