import { FUNDRAISING_PERIODS, readFundraisingGoal } from "./fundraising-goal"
import type { FiscalSponsorshipApplicationRecord } from "../types"

export type FiscalSponsorshipAgreementDocument = {
  filename: string
  html: string
  mime: "text/html"
  sizeBytes: number
  title: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function textOrPlaceholder(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? escapeHtml(trimmed) : "<em>Not provided</em>"
}

function dollarsFromCents(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not provided"
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value / 100)
}

function yesNoOrPlaceholder(value: boolean | null | undefined) {
  if (value === true) return "Yes"
  if (value === false) return "No"
  return "Not provided"
}

function slugifyFilename(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return slug || "fiscal-sponsorship-agreement"
}

export function buildFiscalSponsorshipAgreementDocument({
  application,
  generatedAt,
  organizationName,
}: {
  application: FiscalSponsorshipApplicationRecord
  generatedAt: string
  organizationName: string
}): FiscalSponsorshipAgreementDocument {
  const projectName =
    application.projectName?.trim() || "Fiscal Sponsorship Project"
  const title = `Model C Fiscal Sponsorship Agreement - ${projectName}`
  const generatedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(generatedAt))

  const fundraisingGoal = readFundraisingGoal(application.metadata)
  const period = FUNDRAISING_PERIODS.find((option) => option.value === fundraisingGoal?.period)?.label
  const rows: Array<[string, string | null | undefined]> = [
    ["Project", projectName],
    ["Organization", organizationName],
    ["Applicant", application.applicantFullName],
    ["Primary email", application.primaryEmail],
    ["Legal entity type", application.legalEntityType],
    ["Formation status", application.formationStatus],
    ["Project location", application.projectLocation],
    ["Focus area", application.focusArea],
    fundraisingGoal
      ? ["Anticipated fundraising", `${dollarsFromCents(fundraisingGoal.amountCents)} · ${period}`]
      : ["Estimated budget", dollarsFromCents(application.estimatedBudgetCents)],
  ]

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        color: #111827;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.55;
        margin: 48px auto;
        max-width: 760px;
      }
      h1, h2 { line-height: 1.15; }
      h1 { font-size: 30px; margin: 0 0 8px; }
      h2 { border-top: 1px solid #d1d5db; font-size: 18px; margin-top: 32px; padding-top: 24px; }
      p, li { font-size: 14px; }
      table { border-collapse: collapse; margin-top: 20px; width: 100%; }
      th, td { border-bottom: 1px solid #e5e7eb; font-size: 13px; padding: 10px 0; text-align: left; vertical-align: top; }
      th { color: #6b7280; font-weight: 600; width: 34%; }
      .eyebrow { color: #6b7280; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .signature-grid { display: grid; gap: 32px; grid-template-columns: 1fr 1fr; margin-top: 36px; }
      .signature-line { border-top: 1px solid #111827; padding-top: 8px; }
    </style>
  </head>
  <body>
    <p class="eyebrow">Coach House fiscal sponsorship</p>
    <h1>Model C Fiscal Sponsorship Agreement</h1>
    <p>Prepared ${escapeHtml(generatedDate)} from the approved fiscal sponsorship application.</p>

    <table>
      <tbody>
        ${rows
          .map(
            ([label, value]) =>
              `<tr><th>${escapeHtml(label)}</th><td>${textOrPlaceholder(
                value
              )}</td></tr>`
          )
          .join("\n        ")}
      </tbody>
    </table>

    <h2>Approved charitable activity</h2>
    <p>${textOrPlaceholder(application.projectDescription)}</p>

    <h2>Public benefit</h2>
    <p>${textOrPlaceholder(application.publicBenefit)}</p>

    <h2>Budget and funding</h2>
    ${fundraisingGoal ? "" : `<p><strong>Expense summary:</strong> ${textOrPlaceholder(application.expenseSummary)}</p>`}
    <p><strong>Prospective funding sources:</strong> ${textOrPlaceholder(
      application.prospectiveFundingSources
    )}</p>

    <h2>Leadership and history</h2>
    <p><strong>Leadership:</strong> ${textOrPlaceholder(
      application.leadershipBackground
    )}</p>
    <p><strong>History:</strong> ${textOrPlaceholder(
      application.initiativeHistory
    )}</p>

    <h2>Eligibility acknowledgements</h2>
    <ul>
      <li>Operates outside the United States: ${yesNoOrPlaceholder(application.operatesOutsideUnitedStates)}</li>
      <li>Engages in lobbying: ${yesNoOrPlaceholder(application.engagesInLobbying)}</li>
      <li>Legal, compliance, or financial concerns: ${yesNoOrPlaceholder(application.hasLegalComplianceFinancialConcerns)}</li>
    </ul>
    <p><strong>Explanation:</strong> ${textOrPlaceholder(application.concernsExplanation)}</p>

    <h2>Signature packet</h2>
    <p>This agreement is prepared for Coach House countersignature and applicant signature through the configured signing provider.</p>
    <div class="signature-grid">
      <div class="signature-line">Coach House authorized signer</div>
      <div class="signature-line">Applicant signer</div>
    </div>
  </body>
</html>`

  return {
    filename: `${slugifyFilename(projectName)}-model-c-agreement.html`,
    html,
    mime: "text/html",
    sizeBytes: Buffer.byteLength(html, "utf8"),
    title,
  }
}
