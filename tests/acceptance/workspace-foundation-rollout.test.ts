import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { resolveMyOrganizationPageSearchState } from "@/app/(dashboard)/my-organization/_lib/my-organization-page-search"
import { resolveInitialWorkspaceDrawerData } from "@/app/(dashboard)/my-organization/_lib/my-organization-page-state"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

async function resolveDrawerData(
  searchParams: Record<string, string>,
  needsInitialOnboarding = false
) {
  const searchState = await resolveMyOrganizationPageSearchState(
    Promise.resolve(searchParams)
  )

  return resolveInitialWorkspaceDrawerData({
    acceleratorGroupParam: searchState.acceleratorGroupParam,
    acceleratorModuleParam: searchState.acceleratorModuleParam,
    acceleratorStepParam: searchState.acceleratorStepParam,
    drawerParam: searchState.drawerParam,
    focusParam: searchState.focusParam,
    needsInitialOnboarding,
    programIdParam: searchState.programIdParam,
    roadmapSectionParam: searchState.roadmapSectionParam,
    tabParam: searchState.tabParam,
    viewParam: searchState.viewParam,
  }).initialDrawerData
}

describe("workspace foundation core availability", () => {
  it("preserves the launch focus on a full page reload", async () => {
    await expect(
      resolveDrawerData({ drawer: "accelerator", focus: "organization-launch" })
    ).resolves.toMatchObject({
      initialDrawerTab: "accelerator",
      initialFocus: "organization-launch",
    })
  })

  it("opens every core drawer without rollout configuration", async () => {
    await expect(
      resolveDrawerData({ drawer: "documents", focus: "w9" })
    ).resolves.toMatchObject({
      initialDrawerTab: "documents",
      initialFocus: "w9",
    })
    await expect(
      resolveDrawerData({ drawer: "roadmap", section: "origin-story" })
    ).resolves.toMatchObject({
      initialDrawerTab: "roadmap",
      initialRoadmapSectionSlug: "origin-story",
    })
    await expect(
      resolveDrawerData({
        programId: "program-1",
        tab: "programs",
        view: "editor",
      })
    ).resolves.toMatchObject({
      initialDrawerTab: "organization",
      initialEditMode: true,
      initialProfileTab: "programs",
      initialProgramId: "program-1",
    })
  })

  it("has no environment gate around rendering, taxonomy, or People mutations", () => {
    const pageSource = readSource(
      "src/app/(dashboard)/my-organization/_lib/my-organization-page-content.tsx"
    )
    const surfaceSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view.tsx"
    )
    const peopleStateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-people-state.ts"
    )
    const peopleSource = readSource("src/actions/people.ts")
    const segmentSource = readSource("src/actions/people-segments.ts")
    const tagSource = readSource("src/actions/people-tags.ts")

    expect(
      existsSync(join(ROOT, "src/lib/workspace/foundation-rollout.ts"))
    ).toBe(false)
    expect(pageSource).toContain("resolveInitialWorkspaceDrawerData")
    expect(pageSource).toContain(
      "loadOrganizationPeopleTaxonomy({ orgId, supabase })"
    )
    expect(pageSource).not.toContain("workspaceFoundationEnabled")
    expect(surfaceSource).toContain(
      "onOpenDataDrawer={onOpenWorkspaceDataDrawer}"
    )
    expect(surfaceSource).toContain("<WorkspaceCanvasOverlayDrawer")
    expect(surfaceSource).not.toContain("workspaceFoundationEnabled")
    expect(peopleStateSource).toContain(
      "allowEditing || workspaceDataDrawerCanEdit"
    )
    expect(peopleStateSource).not.toContain("workspaceFoundationEnabled")
    expect(peopleSource).not.toContain("isWorkspaceFoundationRolloutEnabled")
    expect(segmentSource).not.toContain("isWorkspaceFoundationRolloutEnabled")
    expect(tagSource).not.toContain("isWorkspaceFoundationRolloutEnabled")
  })
})
