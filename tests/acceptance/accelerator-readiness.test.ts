import { describe, expect, it } from "vitest"

import { resolveAcceleratorReadiness } from "@/lib/accelerator/readiness"
import type { ModuleCardStatus } from "@/lib/accelerator/progress"
import type { RoadmapSection, RoadmapSectionStatus } from "@/lib/roadmap"

function makeSection(id: string, status: RoadmapSectionStatus, content = "Filled content"): RoadmapSection {
  return {
    id,
    title: id,
    subtitle: id,
    slug: id,
    titleExample: undefined,
    subtitleExample: undefined,
    prompt: "",
    placeholder: "",
    content: status === "not_started" ? "" : content,
    imageUrl: undefined,
    lastUpdated: null,
    isPublic: false,
    layout: "square",
    status,
    ctaLabel: undefined,
    ctaUrl: undefined,
    homework: null,
    templateTitle: id,
    templateSubtitle: id,
    titleIsTemplate: false,
    subtitleIsTemplate: false,
  }
}

function makeModule(slug: string, status: ModuleCardStatus) {
  return { slug, status }
}

describe("accelerator readiness", () => {
  const coreSections = [
    "origin_story",
    "need",
    "mission_vision_values",
    "theory_of_change",
    "program",
  ].map((id) => makeSection(id, "complete"))

  const baseProfile = {
    name: "Bright Futures",
    ein: "01-2345678",
    tagline: "Impact from idea to launch",
    mission: "Support families",
    need: "Absenteeism support gap",
    values: "Stewardship",
    address_city: "Los Angeles",
    address_state: "CA",
  }

  const verifiedProfile = {
    ...baseProfile,
    formationStatus: "approved",
    documents: {
      verificationLetter: { path: "seed/verification.pdf" },
      bylaws: { path: "seed/bylaws.pdf" },
      stateRegistration: { path: "seed/state.pdf" },
      goodStandingCertificate: { path: "seed/standing.pdf" },
      w9: { path: "seed/w9.pdf" },
    },
  }

  it.each(["not_started", "in_progress", "completed"] as const)(
    "verifies documented organizations regardless of Formation lesson status: %s",
    (status) => {
      const readiness = resolveAcceleratorReadiness({
        profile: verifiedProfile,
        modules: ["naming-your-nfp", "nfp-registration", "filing-1023"].map(
          (slug) => makeModule(slug, status),
        ),
        roadmapSections: coreSections,
        programs: [{ goal_cents: 2500000 }],
        peopleCount: 1,
      })

      expect(readiness.verified).toBe(true)
      expect(readiness.verifiedMissing).toEqual([])
      expect(readiness.verifiedChecklist.map((item) => item.id)).not.toContain("formation-lessons")
      expect(readiness.progressPercent).toBe(100)
      // The separate Fundable training milestone is not rewritten by verification.
      expect(readiness.fundable).toBe(status === "completed")
    },
  )

  it("allows verification with no course enrollment", () => {
    const readiness = resolveAcceleratorReadiness({
      profile: verifiedProfile,
      modules: [],
      roadmapSections: coreSections,
      programs: [{ goal_cents: 2500000 }],
      peopleCount: 0,
    })
    expect(readiness.verified).toBe(true)
    expect(readiness.verifiedChecklist.every((item) => item.complete)).toBe(true)
  })

  it.each([null, "", "invalid", "12345678"])("requires a valid EIN: %s", (ein) => {
    const readiness = resolveAcceleratorReadiness({
      profile: { ...verifiedProfile, ein }, modules: [], roadmapSections: [], programs: [], peopleCount: 0,
    })
    expect(readiness.verified).toBe(false)
    expect(readiness.verifiedMissing).toContain("Add an EIN")
  })

  it.each(["pre_501c3", "in_progress", undefined])("requires 501(c)(3) status: %s", (formationStatus) => {
    const readiness = resolveAcceleratorReadiness({
      profile: { ...verifiedProfile, formationStatus }, modules: [], roadmapSections: [], programs: [], peopleCount: 0,
    })
    expect(readiness.verified).toBe(false)
    expect(readiness.verifiedMissing).toContain("Confirm 501(c)(3) status")
  })

  it("verifies from status and EIN without courses, document uploads, roadmap or funding goals", () => {
    const readiness = resolveAcceleratorReadiness({
      profile: { ein: "01-2345678", formationStatus: "approved" },
      modules: [], roadmapSections: [], programs: [], peopleCount: 0,
    })
    expect(readiness.verified).toBe(true)
    expect(readiness.fundable).toBe(false)
    expect(readiness.verifiedMissing).toEqual([])
    expect(readiness.verifiedChecklist.map((item) => item.id)).toEqual(["ein", "approved-formation-status"])
  })

  it("returns Building when hard requirements are missing", () => {
    const readiness = resolveAcceleratorReadiness({
      profile: {
        ...baseProfile,
        formationStatus: "in_progress",
      },
      modules: [makeModule("naming-your-nfp", "completed"), makeModule("nfp-registration", "not_started")],
      roadmapSections: coreSections,
      programs: [{ goal_cents: null }],
      peopleCount: 1,
    })

    expect(readiness.fundable).toBe(false)
    expect(readiness.verified).toBe(false)
    expect(readiness.fundableMissing).toContain("Complete the Formation class")
    expect(readiness.fundableMissing).toContain("Set a program funding goal")
    expect(readiness.fundableChecklist).toEqual([
      {
        id: "formation-lessons",
        label: "Complete the Formation class",
        complete: false,
      },
      {
        id: "program-funding-goal",
        label: "Set a program funding goal",
        complete: false,
      },
      {
        id: "legal-formation-document",
        label: "Upload legal formation document",
        complete: false,
      },
    ])
    expect(readiness.progressPercent).toBeLessThan(readiness.fundableCheckpoint)
  })

  it("returns Fundable when fundable criteria are met", () => {
    const readiness = resolveAcceleratorReadiness({
      profile: {
        ...baseProfile,
        formationStatus: "in_progress",
        documents: {
          articlesOfIncorporation: { path: "seed/articles.pdf" },
        },
      },
      modules: [
        makeModule("naming-your-nfp", "completed"),
        makeModule("nfp-registration", "completed"),
        makeModule("filing-1023", "completed"),
      ],
      roadmapSections: coreSections,
      programs: [{ goal_cents: 2500000 }],
      peopleCount: 1,
    })

    expect(readiness.fundable).toBe(true)
    expect(readiness.verified).toBe(false)
    expect(readiness.fundableChecklist.every((item) => item.complete)).toBe(true)
    expect(
      readiness.verifiedChecklist.find(
        (item) => item.id === "approved-formation-status",
      )?.complete,
    ).toBe(false)
    expect(readiness.progressPercent).toBeGreaterThanOrEqual(readiness.fundableCheckpoint)
    expect(readiness.progressPercent).toBeLessThan(readiness.verifiedCheckpoint)
  })

  it("retains Verified and Fundable when both existing states qualify", () => {
    const readiness = resolveAcceleratorReadiness({
      profile: {
        ...baseProfile,
        formationStatus: "approved",
        documents: {
          verificationLetter: { path: "seed/verification.pdf" },
          bylaws: { path: "seed/bylaws.pdf" },
          stateRegistration: { path: "seed/state.pdf" },
        },
      },
      modules: [
        makeModule("naming-your-nfp", "completed"),
        makeModule("nfp-registration", "completed"),
        makeModule("filing-1023", "completed"),
        makeModule("financial-handbook", "in_progress"),
      ],
      roadmapSections: coreSections,
      programs: [{ goal_cents: 2500000 }],
      peopleCount: 2,
    })

    expect(readiness.fundable).toBe(true)
    expect(readiness.verified).toBe(true)
    expect(readiness.verifiedChecklist.every((item) => item.complete)).toBe(true)
    expect(readiness.score).toBe(100)
    expect(readiness.progressPercent).toBe(100)
  })
})
