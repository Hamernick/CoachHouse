import { describe, expect, it } from "vitest"

import { normalizeMemberWorkspaceCreateProjectInput } from "@/features/member-workspace/server/project-create-input"

describe("normalizeMemberWorkspaceCreateProjectInput", () => {
  it("normalizes project form input into persisted project fields", () => {
    const result = normalizeMemberWorkspaceCreateProjectInput({
      name: "  Volunteer onboarding revamp  ",
      status: "planned",
      priority: "medium",
      startDate: "2026-04-07",
      endDate: "2026-05-05",
      clientName: "  Community Partners ",
      typeLabel: " Operations ",
      tags: " Community, Ops, Ops ",
      memberLabels: " Jason Reed, Amina Clark ",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Volunteer onboarding revamp",
        description: null,
        overviewDocumentHtml: null,
        hasOverviewDocumentHtml: false,
        status: "planned",
        priority: "medium",
        startDate: "2026-04-07",
        endDate: "2026-05-05",
        clientName: "Community Partners",
        typeLabel: "Operations",
        durationLabel: "4 weeks",
        tags: ["Community", "Ops"],
        memberLabels: ["Jason Reed", "Amina Clark"],
      },
    })
  })

  it("rejects projects whose end date is before the start date", () => {
    expect(
      normalizeMemberWorkspaceCreateProjectInput({
        name: "Broken schedule",
        status: "planned",
        priority: "medium",
        startDate: "2026-05-05",
        endDate: "2026-04-07",
      }),
    ).toEqual({
      ok: false,
      error: "End date must be on or after the start date.",
    })
  })
  it("preserves edited labels, colors, and deleted option lists", () => {
    const optionSettings = { tags: [], sprintTypes: [{ id: "design", label: "Planning", color: "#2563eb" }] }
    const result = normalizeMemberWorkspaceCreateProjectInput({ name: "Project", status: "planned", priority: "medium", startDate: "2026-09-20", endDate: "2026-09-21", typeLabel: "Planning", optionSettings })
    expect(result).toMatchObject({ ok: true, value: { optionSettings, typeLabel: "Planning", tags: [] } })
  })
  it.each([
    { tags: [{ id: "one", label: "Tag", color: "url(evil)" }], sprintTypes: [] },
    { tags: [{ id: "one", label: "Tag" }, { id: "two", label: "tag" }], sprintTypes: [] },
    { tags: [{ id: "one", label: "two,tags" }], sprintTypes: [] },
  ])("rejects invalid option colors and ambiguous names", (optionSettings) => {
    expect(normalizeMemberWorkspaceCreateProjectInput({ name: "Project", status: "planned", priority: "medium", startDate: "2026-09-20", endDate: "2026-09-21", optionSettings })).toMatchObject({ ok: false })
  })

})
