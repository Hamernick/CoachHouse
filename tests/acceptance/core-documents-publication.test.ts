import { readFileSync } from "node:fs"
import { join } from "node:path"

import { resolveCoreDocumentPublication, prepareCoreDocumentProfileSave } from "@/lib/roadmap/core-document-publication"
import { ORGANIZATION_CORE_DOCUMENT_SECTION_IDS } from "@/lib/roadmap/organization-core-documents"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

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
  it.each(Object.entries(ORGANIZATION_CORE_DOCUMENT_SECTION_IDS))(
    "shares the same publication status for %s in both editors",
    (key, id) => {
      let profile: Record<string, unknown> = {}
      for (const status of ["complete", "in_progress", "not_started", "complete"] as const) {
        profile = updateRoadmapSection(profile, id, { content: "<p>Keep this content</p>", status }).nextProfile
        const state = resolveCoreDocumentPublication(profile)
        expect(state[key as keyof typeof state].status).toBe(status)
        const publicKey = key === "need" ? "needStatement" : key
        const visible = resolvePublicOrganizationProfileNarratives(profile)
        expect(visible[publicKey as keyof typeof visible]).toBe(status === "complete" ? "<p>Keep this content</p>" : "")
        expect(resolveOrganizationCoreDocuments(profile)[key as keyof typeof state]).toBe("<p>Keep this content</p>")
      }
    }
  )

  it("does not send unchanged content or publication settings during unrelated saves", () => {
    const saved = { name: "Before", mission: "<p>Original</p>", coreDocumentPublication: resolveCoreDocumentPublication({ mission: "Original" }) }
    const patch = prepareCoreDocumentProfileSave({ ...saved, name: "After" }, saved)
    expect(patch).not.toHaveProperty("mission")
    expect(patch.coreDocumentPublication).toEqual({})
    const changed = prepareCoreDocumentProfileSave({ ...saved, coreDocumentPublication: {
      ...saved.coreDocumentPublication,
      mission: { ...saved.coreDocumentPublication.mission, status: "in_progress" },
    } }, saved)
    expect(changed.coreDocumentPublication).toEqual({ mission: { status: "in_progress", lastUpdated: null } })
  })

  it.each([null, "2026-10-21T12:00:00Z"])("never serves stale or legacy content for a controlled draft (%s)", (lastUpdated) => {
    const profile = { need: "Old legacy copy", roadmap: { sections: [{ id: "need", content: "Draft", publishedContent: "Old public copy", status: "in_progress", publicProfileStatusControlled: true, lastUpdated }] } }
    expect(resolvePublicOrganizationProfileNarratives(profile).needStatement).toBe("")
  })

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

  it("hides the previous public version when switched to Draft", () => {
    const initiallyPublic = updateRoadmapSection({}, "need", {
      content: "<p>Current public need</p>",
      status: "complete",
    })
    const drafting = updateRoadmapSection(initiallyPublic.nextProfile, "need", {
      content: "<p>Private replacement</p>",
      status: "in_progress",
    })

    expect(drafting.section.publishedContent).toBeUndefined()
    expect(
      resolvePublicOrganizationProfileNarratives(drafting.nextProfile)
        .needStatement
    ).toBe("")

    const republished = updateRoadmapSection(drafting.nextProfile, "need", {
      status: "complete",
    })
    expect(republished.section.publishedContent).toBeUndefined()
    expect(
      resolvePublicOrganizationProfileNarratives(republished.nextProfile)
        .needStatement
    ).toBe("<p>Private replacement</p>")
  })

  it("hides legacy public content when explicitly switched to Draft", () => {
    const drafting = updateRoadmapSection(
      { need: "Legacy public need" },
      "need",
      {
        content: "<p>Private replacement</p>",
        status: "in_progress",
      }
    )

    expect(drafting.section.publicProfileStatusControlled).toBe(true)
    expect(drafting.section.publishedContent).toBeUndefined()
    expect(
      resolvePublicOrganizationProfileNarratives(drafting.nextProfile)
        .needStatement
    ).toBe("")
  })

  it("preserves legacy public visibility on a content-only edit", () => {
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
    expect(edited.section.publishedContent).toBeUndefined()
    expect(edited.section.status).toBe("complete")
    expect(
      resolvePublicOrganizationProfileNarratives(edited.nextProfile).mission
    ).toBe("<p>Private replacement</p>")
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
      "src/components/roadmap/roadmap-editor/hooks/use-roadmap-save.ts"
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
    expect(editor).toContain("expectedLastUpdated:draft.lastUpdated")
    expect(editor).toContain("content:draft.content")
    expect(editorShell).toContain(
      "status={controlsPublicProfile ? activeSection.status : status}"
    )
    expect(action).toContain('revalidateTag("public-map-organizations", { expire: 0 })')
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


it("public narratives never fall back to an inactive editor body for a Drive source", () => {
  for (const selection of [{ documentSource: "google_drive" }, { driveSource: { provider: "google_drive", fileId: "123456789012", name: "Drive doc", webViewLink: "https://docs.google.com/document/d/123456789012/edit" } }]) {
    expect(resolvePublicOrganizationProfileNarratives({ mission: "Private legacy", roadmap: { sections: [{ id: "mission_vision_values", content: "Private editor", status: "complete", publicProfileStatusControlled: true, ...selection }] } }).mission).toBe("")
  }
})

it("public roadmap sections require explicit sharing and never expose drafts or inactive editor bodies", async () => {
  const { resolvePublicRoadmapSections } = await import("@/lib/roadmap/sections")
  const profile = { roadmap: { sections: [
    { id: "vision", content: "Private draft", isPublic: true, status: "in_progress", publicProfileStatusControlled: true },
    { id: "private", title: "Private title", content: "Private body", isPublic: false },
    { id: "drive", content: "Private inactive body", isPublic: true, documentSource: "google_drive" },
    { id: "shared", title: "Shared title", content: "Reviewed public body", isPublic: true },
  ] } }
  expect(resolvePublicRoadmapSections(profile).map(section => section.id)).toEqual(["shared"])
  expect(profile.roadmap.sections[1].content).toBe("Private body")
})


const publicReader = vi.hoisted(() => ({ profile: {} as Record<string, unknown>, allowed: true, blocked: [] as string[] }))
vi.mock("@/lib/feature-flags", () => ({ publicSharingEnabled: true }))
vi.mock("@/lib/organization/public-document-audience", () => ({ filterPublicDocumentSections: async (sections: { id: string }[]) => publicReader.allowed ? sections.filter(section => !publicReader.blocked.includes(section.id)) : null }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: () => ({ select() { return this }, ilike() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { user_id: "public-org", profile: publicReader.profile, is_public_roadmap: true } }) }) }) }))
vi.mock("@/components/roadmap/public-roadmap-presentation", () => ({ PublicRoadmapPresentation: (props: unknown) => createElement("pre", null, JSON.stringify(props)) }))
vi.mock("@/components/roadmap/public-roadmap-tracker", () => ({ RoadmapAnalyticsTracker: (props: unknown) => createElement("pre", null, JSON.stringify(props)) }))

it("public roadmap page passes only explicitly shared sections to presentation and analytics", async () => {
 publicReader.profile = { name: "Public organization", roadmap: { sections: [
  { id: "private", slug: "private-slug", title: "Private title", content: "Private content", isPublic: false },
  { id: "shared", slug: "shared-slug", title: "Shared title", content: "Shared content", isPublic: true },
 ] } }
 const { default: Page } = await import("@/app/[org]/roadmap/page")
 const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ org: "public-org" }) }))
 expect(html).not.toMatch(/Private title|Private content|private-slug/)
 expect(html).toContain("Shared content")
 expect(html).toContain("shared-slug")
})


it("public roadmap withholds folder-restricted titles, bodies and analytics slugs while retaining other published sections", async () => {
 publicReader.blocked = ["restricted"]
 publicReader.profile = { roadmap: { sections: [
  { id: "restricted", slug: "restricted-slug", title: "Restricted title", content: "Restricted body", imageUrl: "https://private.example/image", isPublic: true },
  { id: "shared", slug: "shared-slug", title: "Shared title", content: "Shared body", isPublic: true },
 ] } }
 try {
  const { default: Page } = await import("@/app/[org]/roadmap/page")
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ org: "public-org" }) }))
  expect(html).not.toMatch(/Restricted|restricted-slug|private.example/)
  expect(html).toContain("Shared body")
  expect(html).toContain("shared-slug")
  expect(JSON.stringify(publicReader.profile)).toContain("Restricted body")
 } finally { publicReader.blocked = [] }
})
