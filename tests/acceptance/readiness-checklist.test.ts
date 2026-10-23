import { describe, expect, it } from "vitest"

import { buildReadinessChecklist } from "@/lib/accelerator/readiness-checklist"

describe("readiness checklist link resolution", () => {
  it("maps dynamic formation and roadmap reasons to next-step links", () => {
    const checklist = buildReadinessChecklist({
      reasons: [
        "Complete the Formation class",
        "Complete core roadmap sections",
      ],
      nextFormationModuleHref: "/accelerator/class/formation/module/2",
      nextCoreRoadmapHref: "/accelerator/roadmap/theory-of-change",
    })

    expect(checklist).toEqual([
      {
        href: "/accelerator/class/formation/module/2",
        label: "Complete the Formation class",
      },
      {
        href: "/accelerator/roadmap/theory-of-change",
        label: "Complete core roadmap sections",
      },
    ])
  })

  it("uses stable fallbacks and limits items", () => {
    const checklist = buildReadinessChecklist({
      reasons: [
        "Complete the Formation class",
        "Complete core roadmap sections",
        "Upload verification letter",
        "Set a program funding goal",
      ],
      maxItems: 3,
    })

    expect(checklist).toEqual([
      {
        href: "/accelerator/class/formation/module/1",
        label: "Complete the Formation class",
      },
      {
        href: "/workspace/roadmap/origin-story",
        label: "Complete core roadmap sections",
      },
      { href: "/organization/documents", label: "Upload verification letter" },
    ])
  })

  it("drops unknown reasons and deduplicates repeated entries", () => {
    const checklist = buildReadinessChecklist({
      reasons: [
        "Unknown reason",
        "Upload legal formation document",
        "Upload legal formation document",
      ],
    })

    expect(checklist).toEqual([
      { href: "/organization/documents", label: "Upload legal document" },
    ])
  })

  it("opens organization readiness work in the canonical workspace editor", () => {
    const checklist = buildReadinessChecklist({
      reasons: [
        "Set a program funding goal",
        "Formation status must be approved",
      ],
    })

    expect(checklist).toEqual([
      {
        href: "/workspace?view=editor&tab=programs",
        label: "Set a program funding goal",
      },
      {
        href: "/workspace?view=editor&tab=company",
        label: "Set formation status",
      },
    ])
  })
})

it("links the Verified badge requirements to the existing organization editor", () => {
  const checklist = buildReadinessChecklist({ reasons: ["Add an EIN", "Confirm 501(c)(3) status"] })
  expect(checklist).toHaveLength(2)
  expect(checklist.map((item) => item.label)).toEqual(["Add an EIN", "Confirm 501(c)(3) status"])
  expect(checklist.every((item) => item.href.includes("company"))).toBe(true)
})
