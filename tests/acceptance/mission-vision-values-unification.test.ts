import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  applyApprovedMissionVisionValuesReview,
  findOrganizationNarrativeRevisionConflict,
  normalizeOrganizationNarrativeHtml,
  organizationNarrativeHtmlToPlainText,
  planMissionVisionValuesMigration,
  proposeMissionVisionValuesReview,
  resolveOrganizationNarratives,
  resolveRoadmapSections,
  updateOrganizationNarratives,
} from "@/lib/roadmap"
import { SECTION_DEFINITIONS } from "@/lib/roadmap/definitions"
import { syncMappedAnswersToOrganizationProfile } from "@/app/api/modules/[id]/assignment-submission/_lib/profile-sync"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("Mission, Vision, and Values canonical roadmap contract", () => {
  it("keeps the historical Mission id and inserts Vision and Values in order", () => {
    expect(
      SECTION_DEFINITIONS.slice(0, 6).map(({ id, title, slug }) => ({
        id,
        title,
        slug,
      }))
    ).toEqual([
      { id: "origin_story", title: "Origin Story", slug: "origin-story" },
      { id: "need", title: "Need", slug: "need" },
      {
        id: "mission_vision_values",
        title: "Mission",
        slug: "mission-vision-values",
      },
      { id: "vision", title: "Vision", slug: "vision" },
      { id: "values", title: "Values", slug: "values" },
      {
        id: "theory_of_change",
        title: "Theory of Change",
        slug: "theory-of-change",
      },
    ])
  })

  it("shows the renamed template without rewriting stored Mission content", () => {
    const combined = "<h2>Mission</h2><p>Exact existing content.</p>\n"
    const sections = resolveRoadmapSections({
      roadmap: {
        sections: [
          {
            id: "mission_vision_values",
            title: "Mission, Vision, Values",
            subtitle: "Your guiding statements and principles.",
            slug: "mission-vision-values",
            content: combined,
            lastUpdated: "2026-07-01T12:00:00.000Z",
            isPublic: true,
            status: "complete",
            customMetadata: { source: "member" },
          },
        ],
      },
    })
    const mission = sections.find(({ id }) => id === "mission_vision_values")

    expect(mission).toMatchObject({
      title: "Mission",
      slug: "mission-vision-values",
      content: combined,
      lastUpdated: "2026-07-01T12:00:00.000Z",
      isPublic: true,
      status: "complete",
      storageExtras: { customMetadata: { source: "member" } },
    })
  })

  it("copies legacy fields only into empty canonical sections", () => {
    const combined = "<h2>Mission</h2><p>Do not alter this byte.  </p>\n"
    const profile = {
      mission: "A different legacy mission",
      vision: "A future where everyone thrives.",
      values: ["Equity", "Care"],
      roadmap: {
        heroUrl: "https://example.com/hero.jpg",
        sections: [
          {
            id: "mission_vision_values",
            title: "Mission, Vision, Values",
            subtitle: "Your guiding statements and principles.",
            slug: "mission-vision-values",
            content: combined,
            lastUpdated: "2026-07-01T12:00:00.000Z",
            isPublic: true,
            status: "complete",
            customMetadata: { source: "member" },
          },
        ],
      },
    }
    const plan = planMissionVisionValuesMigration(profile, {
      now: "2026-08-01T12:00:00.000Z",
    })
    const nextSections = resolveRoadmapSections(plan.nextProfile)
    const mission = nextSections.find(
      ({ id }) => id === "mission_vision_values"
    )
    const vision = nextSections.find(({ id }) => id === "vision")
    const values = nextSections.find(({ id }) => id === "values")

    expect(plan.changed).toBe(true)
    expect(plan.reviewRequired).toBe(true)
    expect(plan.actions.map(({ key, result }) => [key, result])).toEqual([
      ["mission", "conflict"],
      ["vision", "copied_legacy"],
      ["values", "copied_legacy"],
    ])
    expect(mission).toMatchObject({
      content: combined,
      lastUpdated: "2026-07-01T12:00:00.000Z",
      isPublic: true,
      status: "complete",
      storageExtras: { customMetadata: { source: "member" } },
    })
    expect(vision).toMatchObject({
      content: "<p>A future where everyone thrives.</p>",
      isPublic: false,
    })
    expect(values).toMatchObject({
      content: "<p>Equity<br>Care</p>",
      isPublic: false,
    })
    expect(plan.nextProfile).toMatchObject({
      mission: profile.mission,
      vision: profile.vision,
      values: profile.values,
      roadmap: {
        heroUrl: profile.roadmap.heroUrl,
        migrations: {
          mvvSplitV1: {
            appliedAt: "2026-08-01T12:00:00.000Z",
            actions: plan.actions,
          },
        },
      },
    })
  })

  it("never overwrites populated roadmap content and is idempotent", () => {
    const profile = {
      mission: "Legacy mission",
      vision: "Legacy vision",
      values: "Legacy values",
      roadmap: {
        sections: [
          {
            id: "mission_vision_values",
            content: "<p>Canonical mission</p>",
          },
          { id: "vision", content: "<p>Canonical vision</p>" },
          { id: "values", content: "<p>Canonical values</p>" },
        ],
      },
    }
    const first = planMissionVisionValuesMigration(profile)
    const second = planMissionVisionValuesMigration(first.nextProfile)

    expect(first.changed).toBe(false)
    expect(first.actions.every(({ result }) => result === "conflict")).toBe(
      true
    )
    expect(resolveOrganizationNarratives(first.nextProfile)).toEqual({
      mission: "<p>Canonical mission</p>",
      vision: "<p>Canonical vision</p>",
      values: "<p>Canonical values</p>",
    })
    expect(second.changed).toBe(false)
    expect(second.nextProfile).toEqual(first.nextProfile)
  })

  it("does not resurrect a legacy backup after a canonical section is cleared", () => {
    expect(
      resolveOrganizationNarratives({
        vision: "Legacy backup",
        roadmap: {
          sections: [
            {
              id: "vision",
              content: "",
              lastUpdated: "2026-08-01T12:00:00.000Z",
            },
          ],
        },
      }).vision
    ).toBe("")
  })

  it("preserves safe rich formatting and removes unsafe HTML", () => {
    const rich =
      '<h2>Purpose</h2><ul><li><strong>Care</strong></li></ul><img src="https://example.com/a.jpg"><script>alert(1)</script><svg onload=alert(2)></svg><a href="java&#x73;cript:alert(3)" onclick="alert(4)">link</a><img src=x onerror=alert(5)>'
    const result = updateOrganizationNarratives({}, { mission: rich })
    const mission = resolveOrganizationNarratives(result.nextProfile).mission

    expect(mission).toContain("<h2>Purpose</h2>")
    expect(mission).toContain("<strong>Care</strong>")
    expect(mission).toContain('<img src="https://example.com/a.jpg">')
    expect(mission).not.toContain("<script")
    expect(mission).not.toContain("javascript:")
    expect(mission).not.toContain("onclick")
    expect(mission).not.toContain("onerror")
    expect(mission).not.toContain("<svg")
    expect(mission).not.toContain("&#x73;cript")
    expect(
      organizationNarrativeHtmlToPlainText(
        "<h2>Mission</h2><p>Serve people.</p><h2>Values</h2><ul><li>Care</li></ul>"
      )
    ).toBe("Mission\n\nServe people.\n\nValues\n\n- Care")
  })

  it("detects stale narrative revisions", () => {
    const profile = updateOrganizationNarratives(
      {},
      {
        mission: "Current mission",
      }
    ).nextProfile

    expect(
      findOrganizationNarrativeRevisionConflict({
        profile,
        updates: { mission: "New mission" },
        expectedRevisions: { mission: null },
      })
    ).toBe("mission")
  })

  it("proposes only explicit Vision and Values heading extracts", () => {
    const combined =
      "<h2>Mission</h2><p>Keep all combined content.</p><h2>Our Vision</h2><p>A thriving future.</p><h2>Core Values</h2><ul><li>Care</li><li>Equity</li></ul><h2>Notes</h2><p>Not part of values.</p>"
    const profile = {
      vision: "Legacy vision beside proposal",
      values: ["Legacy value"],
      roadmap: {
        sections: [{ id: "mission_vision_values", content: combined }],
      },
    }
    const proposal = proposeMissionVisionValuesReview(profile)

    expect(proposal.combinedContent).toBe(combined)
    expect(proposal.legacy).toEqual({
      mission: "",
      vision: "Legacy vision beside proposal",
      values: "Legacy value",
    })
    expect(proposal.extracts.vision?.content).toBe("<p>A thriving future.</p>")
    expect(proposal.extracts.values?.content).toBe(
      "<ul><li>Care</li><li>Equity</li></ul>"
    )

    const applied = applyApprovedMissionVisionValuesReview({
      profile,
      proposal,
      approved: { vision: true, values: true },
    })
    expect(applied.applied).toEqual(["vision", "values"])
    expect(resolveOrganizationNarratives(applied.nextProfile)).toEqual({
      mission: combined,
      vision: "<p>A thriving future.</p>",
      values: "<ul><li>Care</li><li>Equity</li></ul>",
    })
  })

  it("refuses stale or unapproved manual-review proposals", () => {
    const profile = {
      roadmap: {
        sections: [
          {
            id: "mission_vision_values",
            content: "<h2>Vision</h2><p>Original proposal.</p>",
          },
        ],
      },
    }
    const proposal = proposeMissionVisionValuesReview(profile)
    const stale = applyApprovedMissionVisionValuesReview({
      profile: {
        roadmap: {
          sections: [
            {
              id: "mission_vision_values",
              content: "<h2>Vision</h2><p>Changed.</p>",
            },
          ],
        },
      },
      proposal,
      approved: { vision: true },
    })
    const unapproved = applyApprovedMissionVisionValuesReview({
      profile,
      proposal,
      approved: {},
    })

    expect(stale.error).toContain("changed after review")
    expect(stale.applied).toEqual([])
    expect(unapproved.applied).toEqual([])
    expect(unapproved.skipped.vision).toBe("Not approved.")
  })
})

describe("Mission, Vision, and Values integration guardrails", () => {
  it("writes invited-member answers to the supplied organization only", async () => {
    const filters: Array<[string, unknown]> = []
    let updatePayload: Record<string, unknown> | null = null
    const selectQuery = {
      eq(key: string, value: unknown) {
        filters.push([key, value])
        return this
      },
      async maybeSingle() {
        return {
          data: {
            profile: { vision: "Legacy backup" },
            updated_at: "2026-08-01T12:00:00.000Z",
          },
          error: null,
        }
      },
    }
    const updateQuery = {
      eq(key: string, value: unknown) {
        filters.push([key, value])
        return this
      },
      select() {
        return this
      },
      async maybeSingle() {
        return { data: { user_id: "defy-org-id" }, error: null }
      },
    }
    const supabase = {
      from() {
        return {
          select() {
            return selectQuery
          },
          update(payload: Record<string, unknown>) {
            updatePayload = payload
            return updateQuery
          },
        }
      },
    }

    const result = await syncMappedAnswersToOrganizationProfile({
      supabase: supabase as never,
      organizationId: "defy-org-id",
      sanitizedAnswers: { vision_final: "A thriving future." },
      orgKeyMapping: { vision_final: "vision" },
    })
    const writtenProfile = (updatePayload as { profile: Record<string, unknown> } | null)?.profile

    expect(result).toEqual({ ok: true })
    expect(filters).toContainEqual(["user_id", "defy-org-id"])
    expect(filters).not.toContainEqual(["user_id", "invited-user-id"])
    expect(writtenProfile.vision).toBe("Legacy backup")
    expect(resolveOrganizationNarratives(writtenProfile).vision).toBe(
      "<p>A thriving future.</p>"
    )
  })

  it("updates curriculum mappings without changing the historical Mission id", () => {
    const migration = readSource(
      "supabase/migrations/20260801190000_split_mission_vision_values_roadmap_sections.sql"
    )
    const seed = readSource("supabase/seed.sql")

    expect(migration).toContain("when 'mission' then 'mission_vision_values'")
    expect(migration).toContain("when 'vision' then 'vision'")
    expect(migration).toContain("when 'values' then 'values'")
    expect(seed).toContain("'roadmap_section', 'vision'")
    expect(seed).toContain("'roadmap_section', 'values'")
  })

  it("indexes canonical Mission content with legacy fallback", () => {
    const migration = readSource(
      "supabase/migrations/20260801191000_update_search_index_canonical_mission.sql"
    )

    expect(migration).toContain(
      "public.organization_narrative_plain_text(o.profile, 'mission_vision_values', 'mission')"
    )
    expect(migration).toContain("target.section->>'lastUpdated' is not null")
    expect(migration).toContain("p_profile->>p_legacy_key")
    expect(migration).not.toContain("coalesce(o.profile->>'mission', '')")
  })

  it("syncs invited members through the active organization and surfaces failures", () => {
    const route = readSource(
      "src/app/api/modules/[id]/assignment-submission/route.ts"
    )
    const sync = readSource(
      "src/app/api/modules/[id]/assignment-submission/_lib/profile-sync.ts"
    )

    expect(route).toContain("organizationId: orgId")
    expect(route).toContain("submissionSaved: true")
    expect(route).not.toContain("organizationId: user.id")
    expect(sync).toContain("updateOrganizationCoreDocuments")
    expect(sync).toContain('.eq("updated_at", organizationRow.updated_at)')
  })

  it("routes both editors through the shared narrative writer and stale-write checks", () => {
    const roadmapAction = readSource("src/actions/roadmap.ts")
    const organizationAction = readSource("src/actions/organization.ts")
    const organizationEditor = readSource(
      "src/components/organization/org-profile-card/tabs/company-tab/edit-sections/story.tsx"
    )

    expect(roadmapAction).toContain("updateOrganizationNarrativeSection")
    expect(roadmapAction).toContain("expectedLastUpdated")
    expect(roadmapAction).toContain('.eq("updated_at", orgRow.updated_at)')
    expect(organizationAction).toContain("updateOrganizationNarratives")
    expect(organizationAction).toContain(
      "findOrganizationNarrativeRevisionConflict"
    )
    expect(organizationAction).toContain('.eq("updated_at", orgRow.updated_at)')
    expect(organizationEditor).toContain("<RichTextEditor")
    expect(organizationEditor).toContain('name: "mission"')
    expect(organizationEditor).toContain('name: "vision"')
    expect(organizationEditor).toContain('name: "values"')
  })

  it("keeps migration execution dry-run by default and blocks bulk apply", () => {
    const runner = readSource("src/lib/roadmap/mvv-migration-runner.ts")

    expect(runner).toContain("apply = false")
    expect(runner).toContain("Apply requires one explicit organization id.")
    expect(runner).toContain('.eq("updated_at", row.updated_at)')
  })
})
