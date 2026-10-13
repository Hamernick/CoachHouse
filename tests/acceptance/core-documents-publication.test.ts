import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  resolveOrganizationCoreDocuments,
  resolvePublicOrganizationProfileNarratives,
  updateOrganizationCoreDocuments,
  updateRoadmapSection,
} from "@/lib/roadmap"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("Core Documents publication", () => {
  it("keeps untouched legacy public-profile narratives visible", () => {
    expect(
      resolvePublicOrganizationProfileNarratives({
        origin_story: "Legacy origin",
        need: "Legacy need",
        mission: "Legacy mission",
        vision: "Legacy vision",
        values: ["Care", "Trust"],
        theory_of_change: "Legacy theory",
      })
    ).toEqual({
      originStory: "<p>Legacy origin</p>",
      needStatement: "<p>Legacy need</p>",
      mission: "<p>Legacy mission</p>",
      vision: "<p>Legacy vision</p>",
      values: "<p>Care<br>Trust</p>",
      theoryOfChange: "<p>Legacy theory</p>",
    })
  })

  it("keeps saved drafts off the public organization profile", () => {
    const lastUpdated = "2026-08-18T18:00:00.000Z"

    expect(
      resolvePublicOrganizationProfileNarratives({
        origin_story: "Previously public origin",
        need: "Previously public need",
        mission: "Previously public mission",
        vision: "Previously public vision",
        values: "Previously public values",
        theory_of_change: "Previously public theory",
        roadmap: {
          sections: [
            {
              id: "origin_story",
              content: "<p>Draft origin</p>",
              status: "in_progress",
              lastUpdated,
              publicProfileStatusControlled: true,
            },
            {
              id: "need",
              content: "<p>Draft need</p>",
              status: "in_progress",
              lastUpdated,
              publicProfileStatusControlled: true,
            },
            {
              id: "mission_vision_values",
              content: "<p>Draft mission</p>",
              status: "in_progress",
              lastUpdated,
              publicProfileStatusControlled: true,
            },
            {
              id: "vision",
              content: "<p>Draft vision</p>",
              status: "in_progress",
              lastUpdated,
              publicProfileStatusControlled: true,
            },
            {
              id: "values",
              content: "<p>Draft values</p>",
              status: "in_progress",
              lastUpdated,
              publicProfileStatusControlled: true,
            },
            {
              id: "theory_of_change",
              content: "<p>Draft theory</p>",
              status: "in_progress",
              lastUpdated,
              publicProfileStatusControlled: true,
            },
          ],
        },
      })
    ).toEqual({
      originStory: "",
      needStatement: "",
      mission: "",
      vision: "",
      values: "",
      theoryOfChange: "",
    })
  })

  it("preserves the previous public version while a replacement is drafted", () => {
    const initiallyPublic = updateRoadmapSection({}, "need", {
      content: "<p>Current public need</p>",
      status: "complete",
    })
    const drafting = updateRoadmapSection(initiallyPublic.nextProfile, "need", {
      content: "<p>Private replacement</p>",
      status: "in_progress",
    })

    expect(drafting.section.publishedContent).toBe("<p>Current public need</p>")
    expect(
      resolvePublicOrganizationProfileNarratives(drafting.nextProfile)
        .needStatement
    ).toBe("<p>Current public need</p>")

    const republished = updateRoadmapSection(drafting.nextProfile, "need", {
      status: "complete",
    })
    expect(republished.section.publishedContent).toBeUndefined()
    expect(
      resolvePublicOrganizationProfileNarratives(republished.nextProfile)
        .needStatement
    ).toBe("<p>Private replacement</p>")
  })

  it("keeps legacy public content stable when publication controls activate", () => {
    const drafting = updateRoadmapSection(
      { need: "Legacy public need" },
      "need",
      {
        content: "<p>Private replacement</p>",
        status: "in_progress",
      }
    )

    expect(drafting.section.publicProfileStatusControlled).toBe(true)
    expect(drafting.section.publishedContent).toBe("Legacy public need")
    expect(
      resolvePublicOrganizationProfileNarratives(drafting.nextProfile)
        .needStatement
    ).toBe("<p>Legacy public need</p>")
  })

  it("activates draft privacy when a legacy document is edited", () => {
    const edited = updateRoadmapSection(
      {
        roadmap: {
          sections: [
            {
              id: "mission_vision_values",
              content: "<p>Current public mission</p>",
              status: "in_progress",
              lastUpdated: "2026-08-17T18:00:00.000Z",
            },
          ],
        },
      },
      "mission_vision_values",
      { content: "<p>Private replacement</p>" }
    )

    expect(edited.section.publicProfileStatusControlled).toBe(true)
    expect(edited.section.publishedContent).toBe(
      "<p>Current public mission</p>"
    )
    expect(
      resolvePublicOrganizationProfileNarratives(edited.nextProfile).mission
    ).toBe("<p>Current public mission</p>")
  })

  it("routes all six profile and homework narratives through Core Documents", () => {
    const updated = updateOrganizationCoreDocuments(
      { need: "Legacy need" },
      {
        originStory: "Origin",
        need: "Need",
        mission: "Mission",
        vision: "Vision",
        values: "Values",
        theoryOfChange: "Theory",
      }
    )

    expect(resolveOrganizationCoreDocuments(updated.nextProfile)).toEqual({
      originStory: "<p>Origin</p>",
      need: "<p>Need</p>",
      mission: "<p>Mission</p>",
      vision: "<p>Vision</p>",
      values: "<p>Values</p>",
      theoryOfChange: "<p>Theory</p>",
    })

    const organizationAction = readSource("src/actions/organization.ts")
    const assignmentSync = readSource(
      "src/app/api/modules/[id]/assignment-submission/_lib/profile-sync.ts"
    )
    const assignmentRoute = readSource(
      "src/app/api/modules/[id]/assignment-submission/route.ts"
    )
    expect(organizationAction).toContain("updateOrganizationCoreDocuments")
    expect(assignmentSync).toContain("getOrganizationCoreDocumentKey")
    expect(assignmentSync).toContain("updateOrganizationCoreDocuments")
    expect(assignmentRoute).toContain(
      'revalidateTag("public-map-organizations", "max")'
    )
  })

  it("projects public Core Documents into the public profile", () => {
    const lastUpdated = "2026-08-18T18:00:00.000Z"
    const section = (id: string, content: string) => ({
      id,
      content,
      status: "complete",
      lastUpdated,
      publicProfileStatusControlled: true,
    })

    expect(
      resolvePublicOrganizationProfileNarratives({
        roadmap: {
          sections: [
            section("origin_story", "<p>Public <strong>origin</strong></p>"),
            section("need", "<p>Public need</p>"),
            section("mission_vision_values", "<p>Public mission</p>"),
            section("vision", "<p>Public vision</p>"),
            section("values", "<ul><li>Care</li><li>Trust</li></ul>"),
            section("theory_of_change", "<p>Public theory</p>"),
          ],
        },
      })
    ).toEqual({
      originStory: "<p>Public <strong>origin</strong></p>",
      needStatement: "<p>Public need</p>",
      mission: "<p>Public mission</p>",
      vision: "<p>Public vision</p>",
      values: "<ul><li>Care</li><li>Trust</li></ul>",
      theoryOfChange: "<p>Public theory</p>",
    })
  })

  it("preserves rich text and image-only public Core Documents", () => {
    const narratives = resolvePublicOrganizationProfileNarratives({
      roadmap: {
        sections: [
          {
            id: "origin_story",
            content:
              '<h2 style="text-align:center">Our beginning</h2><p><em>Built together.</em></p>',
            status: "complete",
            lastUpdated: "2026-08-18T18:00:00.000Z",
            publicProfileStatusControlled: true,
          },
          {
            id: "need",
            content:
              '<img src="https://example.org/need.png" alt="Community need map" onerror="alert(1)"><script>alert(1)</script>',
            status: "complete",
            lastUpdated: "2026-08-18T18:00:00.000Z",
            publicProfileStatusControlled: true,
          },
        ],
      },
    })

    expect(narratives.originStory).toContain("<h2")
    expect(narratives.originStory).toContain("<em>Built together.</em>")
    expect(narratives.needStatement).toContain(
      '<img src="https://example.org/need.png" alt="Community need map">'
    )
    expect(narratives.needStatement).not.toContain("onerror")
    expect(narratives.needStatement).not.toContain("script")
  })

  it("uses the new labels, keeps colors, and refreshes the public map", () => {
    const panel = readSource("src/components/roadmap/roadmap-section-panel.tsx")
    const editor = readSource(
      "src/components/roadmap/roadmap-editor/hooks/use-roadmap-editor-state.ts"
    )
    const editorShell = readSource(
      "src/components/roadmap/roadmap-editor/components/roadmap-editor-shell.tsx"
    )
    const action = readSource("src/actions/roadmap.ts")
    const publicMapQuery = readSource("src/lib/public-map/organization-projection.ts")

    expect(panel).toContain(
      '<SelectItem value="not_started">Not started</SelectItem>'
    )
    expect(panel).toContain('{controlsPublicProfile ? "Draft" : "In progress"}')
    expect(panel).toContain('{controlsPublicProfile ? "Public" : "Complete"}')
    expect(panel).toContain('"Core document publication status"')
    expect(panel).toContain('status === "complete" ? "bg-emerald-500"')
    expect(panel).toContain(
      'status === "in_progress" ? "bg-amber-500" : "bg-border"'
    )
    expect(editor).toContain("expectedLastUpdated: activeSection.lastUpdated")
    expect(editor).toContain("content: draft.content")
    expect(editorShell).toContain(
      "status={controlsPublicProfile ? activeSection.status : status}"
    )
    expect(action).toContain('revalidateTag("public-map-organizations", "max")')
    expect(action).toContain('revalidatePath("/map")')
    expect(publicMapQuery).toContain(
      "resolvePublicOrganizationProfileNarratives(profile)"
    )
  })

  it("hydrates organization profile editors with canonical rich HTML", () => {
    const helpers = readSource(
      "src/app/(dashboard)/my-organization/_lib/helpers.ts"
    )
    const storyEditor = readSource(
      "src/components/organization/org-profile-card/tabs/company-tab/edit-sections/story.tsx"
    )

    expect(helpers).not.toContain("organizationNarrativeHtmlToPlainText")
    expect(helpers).toContain("need: coreDocuments.need")
    expect(helpers).toContain("originStory: coreDocuments.originStory")
    expect(storyEditor).toContain("<RichTextEditor")
    expect(storyEditor).toContain("preserveImages")
    expect(storyEditor).not.toContain("<Textarea")
  })
})
