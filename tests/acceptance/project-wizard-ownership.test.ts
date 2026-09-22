import "./test-utils"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { StepOwnership } from "@/features/platform-admin-dashboard/upstream/components/project-wizard/steps/StepOwnership"
import { StepReview } from "@/features/platform-admin-dashboard/upstream/components/project-wizard/steps/StepReview"
import type { ProjectData } from "@/features/platform-admin-dashboard/upstream/components/project-wizard/types"

const data: ProjectData = {
  successType: "undefined",
  deliverables: [],
  deadlineType: "none",
  contributorIds: ["harrold"],
  stakeholderIds: ["james", "mitch"],
  ownerId: "jason-d",
  addStarterTasks: false,
}

describe("project wizard ownership directory", () => {
  it("does not invent people when the directory is empty", () => {
    const updateData = vi.fn()
    const html = renderToStaticMarkup(
      createElement(StepOwnership, { data, updateData })
    )
    expect(html).toContain("No assignable people are available")
    expect(html).not.toMatch(/Jason D|Harrold|James|Mitch|platform-lab/)
    expect(updateData).not.toHaveBeenCalled()
  })

  it("shows supplied profiles instead of stale placeholder selections", () => {
    const html = renderToStaticMarkup(
      createElement(StepOwnership, {
        data,
        updateData: vi.fn(),
        people: [{ id: "real-coach", name: "Coach Directory Person" }],
      })
    )
    expect(html).toContain("Coach Directory Person")
    expect(html).not.toMatch(/Jason D|Harrold|James|Mitch|Full access|Can edit/)
  })

  it("resolves review ownership from the same directory", () => {
    const people = [{ id: "real-coach", name: "Coach Directory Person" }]
    const stale = renderToStaticMarkup(
      createElement(StepReview, { data, people })
    )
    expect(stale).toContain("Not assigned")
    expect(stale).not.toMatch(/Jason D|Contributors:/)
    const actual = renderToStaticMarkup(
      createElement(StepReview, {
        data: { ...data, ownerId: "real-coach" },
        people,
      })
    )
    expect(actual).toContain("Coach Directory Person")
  })
})
