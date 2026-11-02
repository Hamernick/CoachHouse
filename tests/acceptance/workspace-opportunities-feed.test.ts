import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
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
  it("renders sourced cards and one menu without save buttons or invented match scores", () => {
    const html = render({ opportunities: [opportunity], state: "ready", canEdit: true })
    expect(html).toContain("Community grant")
    expect(html).toContain("Example Foundation")
    expect(html).toContain('dateTime="2027-01-15T17:00:00Z"')
    expect(html).not.toContain('aria-label="Save Community grant"')
    expect(html).toContain('aria-label="Options for Community grant"')
    expect(html).not.toMatch(/\d+% match/i)
  })
  it("keeps read-only opportunities readable without mutation controls", () => {
    const html = render({ opportunities: [opportunity], state: "ready" })
    expect(html).toContain("Community grant")
    expect(html).not.toContain('aria-label="Save Community grant"')
    expect(html).not.toContain('aria-label="Archive Community grant"')
  })
  it("presents legacy saved records as active without a save action", () => {
    const html = render({ opportunities: [{ ...opportunity, status: "saved" }], state: "ready", canEdit: true })
    expect(html).toContain("Active")
    expect(html).not.toContain('aria-label="Saved Community grant"')
    expect(html).not.toContain('aria-label="Save Community grant"')
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
  expect(html).toContain('aria-label="Options for Community grant"')
  expect(html).not.toContain('aria-label="Save Community grant"')
  expect(html).not.toContain('aria-label="Archive Community grant"')
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

it("shows both timeline dates on saved range reports",()=>{
  const html=render({opportunities:[{...opportunity,report:{version:1,blocks:[],timeline:{from:"2027-01-10",to:"2027-01-15"}}}],state:"ready"})
  expect(html).toContain('dateTime="2027-01-10"')
  expect(html).toContain('dateTime="2027-01-15"')
})

it("shows compact suggested titles and per-award amounts while preserving the original name", () => {
  const title="Community Infrastructure for Research in Computer and Information Science and Engineering (CIRC)"
  const html=render({opportunities:[{...opportunity,title,origin:"suggested",report:{version:1,blocks:[{id:opportunity.id,kind:"facts",title:"Published facts",items:[{id:opportunity.id,label:"Award",value:"$12,000.00–$50,000.00 per award"}]}]}}],state:"ready"})
  expect(html).toContain("CIRC: Community Infrastructure for Research")
  expect(html).toContain("$12k–$50k")
  expect(html).toContain(`title="${title}"`)
  expect(html).toContain(`aria-label="Show more about ${title}"`)
})

import { opportunityCardAmount, opportunityCardTitle } from "@/features/workspace-finance/lib/opportunity-card-summary"
import type { OpportunityReport } from "@/features/workspace-finance/lib/opportunity-report"

const report = (value: string, label = "Award"): OpportunityReport => ({ version: 1, blocks: [{ id: "00000000-0000-4000-8000-000000000001", title: "Published facts", kind: "facts", items: [{ id: "00000000-0000-4000-8000-000000000002", label, value }] }] })
describe("opportunity card summary", () => {
  it("keeps identifying acronyms in a five-word heading without changing manual titles", () => {
    const title = "Community Infrastructure for Research in Computer and Information Science and Engineering (CIRC)"
    expect(opportunityCardTitle(title, false)).toBe("CIRC: Community Infrastructure for Research")
    expect(opportunityCardTitle(title, true)).toBe(title)
    expect(opportunityCardTitle("Local community grants", false)).toBe("Local community grants")
    expect(opportunityCardTitle("Community infrastructure for research in computer science", false)).toBe("Community infrastructure for research…")
  })
  it.each([
    ["$12,000.00–$50,000.00 per award", "$12k–$50k"],
    ["$50,000.00–$5,000,000.00 per award", "$50k–$5M"],
    ["Up to $50,000.00 per award", "Up to $50k"],
    ["From $12,000.00 per award; maximum not published", "From $12k"],
    ["$2,500", "$2.5k"],
    ["$12,000–$12,000 per award", "$12k"],
    ["$0–$50,000 per award", "$0–$50k"],
  ])("formats explicit award value %s", (value, label) => {
    expect(opportunityCardAmount(report(value))).toMatchObject({ label, detail: value })
  })
  it.each(["Amount not published", "In-kind: 12 computers", "$50,000–$12,000 per award", "$12k estimated", "$1,00", "CAD 12,000", "$12,000 total across all awards", "Up to $1–$2"])("does not infer money from %s", value => {
    expect(opportunityCardAmount(report(value))).toBeNull()
  })
  it("never substitutes program totals, budgets, or conflicting award facts", () => {
    expect(opportunityCardAmount(report("$24,000,000", "Program total"))).toBeNull()
    expect(opportunityCardAmount(report("$2,500", "Budget"))).toBeNull()
    expect(opportunityCardAmount({ version: 1, blocks: [...report("$100").blocks, ...report("$200").blocks] })).toBeNull()
  })
})

import { opportunityDeadlineLabel, opportunityFeedStats } from "@/features/workspace-finance/lib/opportunity-feed-stats"

describe("feed funding statistics", () => {
  it("excludes expired, closed and ambiguous amounts without summing program budgets", () => {
    const now = Date.parse("2026-10-28T12:00:00Z")
    const item = (id: string, value: string, extra = {}) => ({ id, title: id, status: "new" as const, report: report(value), ...extra })
    expect(opportunityFeedStats([
      item("range", "$100–$500"), item("floor", "From $900"), item("expired", "$100000", { dueAt: "2026-10-27T00:00:00Z" }),
      item("closed", "$100000", { status: "awarded" }), item("archive", "$100000", { status: "dismissed" }),
      item("budget", "$100000", { report: report("$100000", "Budget") }), item("invalid", "$100000", { dueAt: "invalid" }),
    ], now)).toMatchObject({ award: { value: 500, title: "range" }, deadline: null })
    expect(opportunityFeedStats([item("zero", "$0")], now).award?.value).toBe(0)
    expect(opportunityFeedStats([item("floor", "From $900")], now).award).toBeNull()
    expect(opportunityFeedStats([], now)).toEqual({ award: null, deadline: null })
  })
})

it("uses the nearest open deadline and updates its countdown", () => {
  const now = Date.parse("2026-10-28T12:00:00Z")
  const items = [
    { id: "later", title: "Later", status: "new" as const, dueAt: "2026-11-02T12:00:00Z" },
    { id: "next", title: "Next", status: "new" as const, dueAt: "2026-10-30T12:00:00Z" },
    { id: "archived", title: "Archived", status: "dismissed" as const, dueAt: "2026-10-29T12:00:00Z" },
  ]
  const deadline = opportunityFeedStats(items, now).deadline!
  expect(deadline.title).toBe("Next")
  expect(opportunityDeadlineLabel(deadline.at, now)).toBe("2 days")
  expect(opportunityDeadlineLabel(deadline.at, deadline.at - 3_600_000)).toBe("1 hr")
  expect(opportunityDeadlineLabel(deadline.at, deadline.at - 60_000)).toBe("1 min")
  expect(opportunityDeadlineLabel(deadline.at, deadline.at + 1)).toBe("—")
  expect(opportunityFeedStats(items, deadline.at + 1).deadline?.title).toBe("Later")
})

import { opportunityCalendarEvents, opportunityCalendarPresentation } from "@/features/workspace-finance/lib/opportunity-calendar"
it("projects one linked calendar entry per dated opportunity without archived or undated rows", () => {
  const items = [
    { ...opportunity, dueAt: "2026-11-08T12:00:00Z" },
    { ...opportunity, id: "range", report: { version: 1 as const, blocks: [], timeline: { from: "2026-11-02", to: "2026-11-09" } } },
    { ...opportunity, id: "undated", dueAt: null },
    { ...opportunity, id: "archived", status: "dismissed" as const },
    { ...opportunity, id: "invalid", dueAt: "invalid" },
  ]
  const events = opportunityCalendarEvents(items, "org", "2026-11-01T00:00:00Z", "2026-11-30T23:59:59Z")
  expect(events).toHaveLength(2)
  expect(events[0]).toMatchObject({ id: `opportunity:${opportunity.id}`, orgId: "org", source: { kind: "workspace_opportunity", opportunityId: opportunity.id }, startsAt: "2026-11-08T12:00:00Z", allDay: false })
  expect(events[1]).toMatchObject({ startsAt: "2026-11-02T00:00:00", endsAt: "2026-11-09T23:59:59.999", allDay: true })
  expect(opportunityCalendarEvents(items, "org", "2026-12-01T00:00:00Z", "2026-12-31T23:59:59Z")).toHaveLength(0)
  expect(opportunityCalendarEvents(items.map(item => ({ ...item, status: "dismissed" as const })), "org")).toHaveLength(0)
})

it("labels the opportunity window as a range and only its due date as a deadline", () => {
  const event = opportunityCalendarEvents([{ ...opportunity, dueAt: "2026-11-09T12:00:00Z", report: { version: 1, blocks: [], timeline: { from: "2026-11-02", to: "2026-11-09" } } }], "org")[0]
  const middle = opportunityCalendarPresentation(event, new Date(2026, 10, 5))!
  expect(middle.label).toBe("Window")
  expect(middle.isDeadline).toBe(false)
  expect(middle.detail).toContain("2026")
  expect(middle.detail).not.toContain("all day")
  const deadline = opportunityCalendarPresentation(event, new Date("2026-11-09T12:00:00Z"))!
  expect(deadline).toMatchObject({ label: "Deadline", isDeadline: true })
  expect(event.eventType).toBe("other")
  expect(event.source).toMatchObject({ deadlineAt: "2026-11-09T12:00:00Z", window: { from: "2026-11-02", to: "2026-11-09" } })
})
