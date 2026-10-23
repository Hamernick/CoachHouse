import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/actions/workspace-finance", () => ({ updateWorkspaceFinanceOpportunityStatus: vi.fn() }))
vi.mock("@/actions/workspace-opportunities", () => ({ createWorkspaceOpportunity: vi.fn(), updateWorkspaceOpportunity: vi.fn() }))
import { WorkspaceOpportunitiesFeed } from "@/features/workspace-finance"

const opportunity = { id: "00000000-0000-4000-8000-000000000001", title: "Community grant", source: "Example Foundation", dueAt: "2027-01-15T17:00:00Z", status: "new" as const }
const render = (props: Parameters<typeof WorkspaceOpportunitiesFeed>[0]) => renderToStaticMarkup(createElement(WorkspaceOpportunitiesFeed, props))

describe("workspace opportunity feed", () => {
  it("offers inline creation for an editable empty organization feed", () => {
    const html = render({ opportunities: [], state: "ready", canEdit: true, organizationId: "00000000-0000-4000-8000-000000000001" })
    expect(html).toContain("No opportunities yet.")
    expect(html).toContain("Add opportunity")
    expect(render({ opportunities: [], state: "ready", organizationId: "00000000-0000-4000-8000-000000000001" })).not.toContain("Add opportunity")
  })
  it("renders sourced cards and named save/dismiss actions without invented match scores", () => {
    const html = render({ opportunities: [opportunity], state: "ready", canEdit: true })
    expect(html).toContain("Community grant")
    expect(html).toContain("Example Foundation")
    expect(html).toContain('dateTime="2027-01-15T17:00:00Z"')
    expect(html).toContain('aria-label="Save Community grant"')
    expect(html).toContain('aria-label="Dismiss Community grant"')
    expect(html).not.toContain("%")
  })
  it("keeps read-only opportunities readable without mutation controls", () => {
    const html = render({ opportunities: [opportunity], state: "ready" })
    expect(html).toContain("Community grant")
    expect(html).not.toContain("<button")
  })
  it("shows persisted saved status and disables repeated saves", () => {
    const html = render({ opportunities: [{ ...opportunity, status: "saved" }], state: "ready", canEdit: true })
    expect(html).toContain('aria-label="Saved Community grant"')
    expect(html).toMatch(/disabled=""[^>]*aria-label="Saved Community grant"/)
  })
  it("does not offer save to overwrite an application or award", () => {
    for (const status of ["applied", "awarded", "not_awarded"] as const) {
      const html = render({ opportunities: [{ ...opportunity, status }], state: "ready", canEdit: true })
      expect(html).not.toContain('aria-label="Save Community grant"')
    }
  })
  it("distinguishes loading, failed, and genuinely empty feeds", () => {
    expect(render({ state: "loading" })).toContain('role="status"')
    expect(render({ state: "error" })).toContain('role="alert"')
    expect(render({ state: "error" })).not.toContain("No opportunities yet")
    expect(render({ state: "ready" })).toContain("No opportunities yet")
  })
  it("omits invalid deadlines and retains required attribution", () => {
    const html = render({ opportunities: [{ ...opportunity, dueAt: "invalid", attribution: "grants_gov" }], state: "ready" })
    expect(html).not.toContain("Invalid Date")
    expect(html).not.toContain("<time")
    expect(html).toContain("Source: Grants.gov")
  })
})

it("shows edit instead of suggestion controls for manually created reports", () => {
  const html = render({ opportunities: [{ ...opportunity, origin: "manual" }], canEdit: true, organizationId: opportunity.id })
  expect(html).toContain('aria-label="Edit Community grant"')
  expect(html).not.toContain('aria-label="Save Community grant"')
  expect(html).not.toContain('aria-label="Dismiss Community grant"')
})
it("keeps report details expandable and escapes authored text", () => {
  const html = render({ opportunities: [{ ...opportunity, origin: "manual", report: { version: 1, blocks: [{ id: opportunity.id, title: "", kind: "text", text: "<script>unsafe</script>" }] } }] })
  expect(html).toContain('aria-label="Show more about Community grant"')
  expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;')
  expect(html).not.toContain('<script>')
})

import { OpportunityReportContent } from "@/features/workspace-finance/components/opportunity-report-content"
it("renders populated fact components and hides empty ones", () => {
  const html = renderToStaticMarkup(createElement(OpportunityReportContent, { options: [], report: { version: 1, blocks: [
    { id: opportunity.id, title: "Facts", kind: "facts", items: [{ id: opportunity.id, label: "Budget", value: "$3,000" }] },
    { id: "00000000-0000-4000-8000-000000000002", title: "Empty", kind: "text", text: " " },
  ] } }))
  expect(html).toContain("<dt")
  expect(html).toContain("Budget")
  expect(html).toContain("$3,000")
  expect(html).not.toContain("Empty")
})
