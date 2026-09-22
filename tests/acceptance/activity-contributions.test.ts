import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ActivityContributions } from "@/components/github-contributions"
import { buildActivityDays } from "@/features/coach-dashboard/lib"

describe("recorded activity contributions", () => {
  it("renders recorded counts, calendar labels and one keyboard entry without GitHub data", () => {
    const data = buildActivityDays(["2026-09-19T12:00:00Z", "2026-09-19T13:00:00Z", "2026-09-21T12:00:00Z"], new Date("2026-09-20T16:00:00Z"))
      .filter(day => !day.future).map(day => ({ date: day.date, count: day.count, level: day.count ? 1 : 0 }))
    const html = renderToStaticMarkup(createElement(ActivityContributions, { data, caption: "Assigned organizations · UTC" }))
    expect(html).toContain("2 recorded events")
    expect(html).toContain('data-date="2026-09-19"')
    expect(html).not.toContain('data-date="2026-09-21"')
    expect(html).toContain('data-slot="month-labels"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).not.toContain("github.com")
  })
  it("renders a genuine zero-activity calendar", () => {
    const html = renderToStaticMarkup(createElement(ActivityContributions, { data: [{ date: "2026-09-20", count: 0, level: 0 }], caption: "UTC" }))
    expect(html).toContain("0 recorded events")
    expect(html).toContain('data-level="0"')
  })
})
