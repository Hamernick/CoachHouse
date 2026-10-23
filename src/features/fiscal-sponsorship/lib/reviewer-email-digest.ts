/** Shared staff-only digest. Values come from the immutable queued snapshot. */
import { renderMinimalEmail } from "@/lib/email/minimal-template"

const labels: Record<string, string> = {
  individual: "Individual", corporation: "Corporation", informal_group_with_ein: "Informal group with EIN",
  llc: "LLC", partnership: "Partnership", other: "Other", temporary: "Temporary or one-time", ongoing_multi_year: "Ongoing / multi-year",
}

export function reviewerEmailDigest(snapshot: Record<string, unknown>, url: string, corrections = false) {
  const value = (key: string) => {
    const raw = snapshot[key]
    if (typeof raw === "boolean") return raw ? "Yes" : "No"
    if (typeof raw !== "string" || !raw.trim()) return "Not provided"
    return ["legal_entity_type", "project_duration_type"].includes(key) ? labels[raw] ?? raw.trim() : raw.trim()
  }
  const excerpt = (key: string) => {
    const text = value(key)
    return text.length > 480 ? `${text.slice(0, 479).trimEnd()}…` : text
  }
  const goal = snapshot.fundraising_goal as { amountCents?: unknown; period?: unknown } | null
  const amount = typeof goal?.amountCents === "number" ? goal.amountCents : snapshot.estimated_budget_cents
  const period = goal?.period === "monthly" ? " / month" : goal?.period === "annually" ? " / year" : goal?.period === "total" ? " total" : ""
  const funding = typeof amount === "number" && Number.isFinite(amount) && amount > 0
    ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: amount % 100 ? 2 : 0 }).format(amount / 100)}${period}` : "Not provided"
  const received = typeof snapshot.received_at === "string" ? new Date(snapshot.received_at) : null
  const receivedAt = received && !Number.isNaN(received.getTime())
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(received) + " UTC" : "Not provided"
  const project = value("project_name") === "Not provided" ? "Fiscal sponsorship application" : value("project_name")
  const status = corrections ? "Corrections received" : "Ready for review"
  const intro = corrections
    ? "The applicant has submitted the requested corrections. Review the updated application below, then open the project to continue the review."
    : "A new fiscal sponsorship application is ready for your review. Here is the opportunity at a glance, based on the applicant’s submitted answers."
  const details: [string, string][] = [
    ["Applicant", value("applicant_full_name")], ["Email", value("primary_email")],
    ["Received", receivedAt], ["Location", value("project_location")], ["Focus area", value("focus_area")],
    ["Fundraising goal", funding], ["Duration", value("project_duration_type")],
  ]
  if (snapshot.project_duration_type === "temporary") details.push(["Project dates", `${value("temporary_start_date")} – ${value("temporary_end_date") === "Not provided" ? "End date not provided" : value("temporary_end_date")}`])
  const sections: [string, string][] = [
    ["The opportunity", excerpt("project_description")], ["Public benefit", excerpt("public_benefit")],
    ["Funding plan", excerpt("prospective_funding_sources")], ["Planned expenses", excerpt("expense_summary")],
    ["Leadership", excerpt("leadership_background")], ["Track record", excerpt("initiative_history")],
  ]
  const considerations: [string, string][] = [
    ["Legal entity", value("legal_entity_type")], ["Formation status", value("formation_status")],
    ["Reports 501(c)(3) status", value("legal_entity_has_501c3")],
    ["Activities outside the US", value("operates_outside_united_states")], ["Lobbying activities", value("engages_in_lobbying")],
    ["Legal, compliance or financial concerns", value("has_legal_compliance_financial_concerns")],
  ]
  if (value("concerns_explanation") !== "Not provided") sections.push(["Applicant’s explanation", excerpt("concerns_explanation")])
  const subject = `${corrections ? "FS corrections received" : "New FS application"}: ${project.replace(/[\r\n]+/g, " ").slice(0, 150)}`
  return { subject, ...renderMinimalEmail({
    siteUrl: new URL(url).origin,
    eyebrow: `Fiscal sponsorship · ${status}`,
    title: project,
    intro,
    details: details.map(([label, value]) => ({ label, value })),
    sections: [
      ...sections.filter(([, text]) => text !== "Not provided").map(([title, text]) => ({ title, body: [text] })),
      { title: "Review details", details: considerations.map(([label, value]) => ({ label, value })) },
    ],
    action: { label: "Review application", href: url },
    helpText: "Sign in with your Coach House staff account to record a decision or request more information.",
    footer: "Applicant-reported information. Longer answers are shortened here; open the application for complete answers.",
    previewText: corrections ? "The updated application is ready for review." : "Review the submitted project and funding plan.",
  }) }
}
