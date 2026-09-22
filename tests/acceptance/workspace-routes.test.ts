import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  WORKSPACE_ACCELERATOR_PATH,
  WORKSPACE_DRAWER_TABS,
  WORKSPACE_PATH,
  WORKSPACE_ROADMAP_PATH,
  getOrganizationDocumentsPath,
  getWorkspaceAcceleratorPaywallPath,
  getWorkspaceDrawerPath,
  getWorkspaceEditorPath,
  getMemberWorkspacePaywallPath,
  getWorkspaceRoadmapDrawerPath,
  getWorkspaceRoadmapSectionPath,
  normalizeWorkspaceDrawerTab,
} from "@/lib/workspace/routes"
import { getLegacyMyOrganizationTabDestination } from "@/app/(dashboard)/my-organization/_lib/my-organization-page-search"

const ROOT = process.cwd()

describe("workspace routes", () => {
  it("exposes canonical workspace surface paths", () => {
    expect(WORKSPACE_PATH).toBe("/workspace")
    expect(WORKSPACE_ROADMAP_PATH).toBe("/workspace/roadmap")
    expect(WORKSPACE_ACCELERATOR_PATH).toBe("/workspace/accelerator")
    expect(WORKSPACE_DRAWER_TABS).toEqual([
      "organization",
      "finance",
      "people",
      "documents",
      "particles",
      "tools",
      "accelerator",
      "roadmap",
    ])
    expect(normalizeWorkspaceDrawerTab(" accelerator ")).toBe("accelerator")
    expect(normalizeWorkspaceDrawerTab("finance")).toBe("finance")
    expect(normalizeWorkspaceDrawerTab("tools")).toBe("tools")
    expect(normalizeWorkspaceDrawerTab(null)).toBeNull()
  })

  it("builds editor and roadmap detail links", () => {
    expect(getWorkspaceDrawerPath({ tab: "accelerator" })).toBe(
      "/workspace?drawer=accelerator"
    )
    expect(getWorkspaceDrawerPath({ tab: "finance" })).toBe(
      "/workspace?drawer=finance"
    )
    expect(getWorkspaceDrawerPath({ tab: "tools" })).toBe(
      "/workspace?drawer=tools"
    )
    expect(getWorkspaceDrawerPath({ tab: "particles" })).toBe(
      "/workspace?drawer=particles"
    )
    expect(
      getWorkspaceDrawerPath({
        tab: "accelerator",
        moduleId: "module-1",
        stepId: "module-1:video",
      })
    ).toBe(
      "/workspace?drawer=accelerator&module=module-1&step=module-1%3Avideo"
    )
    expect(
      getWorkspaceDrawerPath({ tab: "documents", focus: "state filing" })
    ).toBe("/workspace?drawer=documents&focus=state+filing")
    expect(getWorkspaceEditorPath({ tab: "company" })).toBe(
      "/workspace?view=editor&tab=company"
    )
    expect(
      getWorkspaceEditorPath({
        tab: "programs",
        programId: "program-1",
      })
    ).toBe("/workspace?view=editor&tab=programs&programId=program-1")
    expect(getWorkspaceEditorPath({ tab: "company", focus: "mission" })).toBe(
      "/workspace?view=editor&tab=company&focus=mission"
    )
    expect(getOrganizationDocumentsPath({ focus: "w9" })).toBe(
      "/organization/documents?focus=w9"
    )
    expect(getWorkspaceRoadmapSectionPath("origin-story")).toBe(
      "/workspace/roadmap/origin-story"
    )
    expect(getWorkspaceRoadmapDrawerPath("origin-story")).toBe(
      "/workspace?drawer=roadmap&section=origin-story"
    )
  })

  it("preserves legacy document and roadmap deep-link parameters", () => {
    expect(
      getLegacyMyOrganizationTabDestination({
        tabParam: "documents",
        focusParam: "w9",
        roadmapSectionParam: null,
      })
    ).toBe("/workspace?drawer=documents&focus=w9")
    expect(
      getLegacyMyOrganizationTabDestination({
        tabParam: "roadmap",
        focusParam: "",
        roadmapSectionParam: "origin-story",
      })
    ).toBe("/workspace?drawer=roadmap&section=origin-story")
    expect(
      getLegacyMyOrganizationTabDestination({
        tabParam: "company",
        focusParam: "mission",
        roadmapSectionParam: null,
      })
    ).toBeNull()
  })

  it("builds the accelerator paywall link with a source", () => {
    expect(getWorkspaceAcceleratorPaywallPath("guide")).toBe(
      "/workspace?paywall=organization&plan=organization&upgrade=accelerator-access&source=guide"
    )
  })

  it("retires every legacy accelerator page behind the workspace route", () => {
    const source = readFileSync(
      join(ROOT, "src/app/(accelerator)/layout.tsx"),
      "utf8"
    )

    expect(source).toContain("redirect(WORKSPACE_ACCELERATOR_PATH)")
    expect(source).not.toContain("<AppShell")
  })

  it("uses the shared drawer-tab contract in server route state", () => {
    const source = readFileSync(
      join(
        ROOT,
        "src/app/(dashboard)/my-organization/_lib/my-organization-page-content.tsx"
      ),
      "utf8"
    )
    const pageStateSource = readFileSync(
      join(
        ROOT,
        "src/app/(dashboard)/my-organization/_lib/my-organization-page-state.ts"
      ),
      "utf8"
    )

    expect(pageStateSource).toContain(
      "normalizeWorkspaceDrawerTab(drawerParam)"
    )
    expect(source).not.toContain(
      '["organization", "accelerator", "roadmap", "people", "documents"]'
    )
  })

  it("builds the member workspace paywall link with a source", () => {
    expect(getMemberWorkspacePaywallPath("tasks")).toBe(
      "/workspace?paywall=organization&plan=organization&upgrade=member-workspace-access&source=tasks"
    )
  })

  it("keeps self-only free users from landing on the workspace canvas", () => {
    const source = readFileSync(
      join(ROOT, "src/app/(dashboard)/workspace/page.tsx"),
      "utf8"
    )

    expect(source).toContain("resolveDashboardLayoutState")
    expect(source).toContain("!state.showMemberWorkspace")
    expect(source).toContain("member_onboarding=1")
    expect(source).toContain("redirect(FIND_PATH)")
  })

  it("preserves document focus through authentication", () => {
    const source = readFileSync(
      join(
        ROOT,
        "src/app/(dashboard)/organization/documents/organization-documents-page-content.tsx"
      ),
      "utf8"
    )

    expect(source).toContain("getOrganizationDocumentsPath")
    expect(source).toContain("encodeURIComponent(returnPath)")
  })
})
