import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildWorkspaceBoardUiPreferencesStorageKey,
  normalizeWorkspaceCanvasPersonPlacementsPreference,
  normalizeWorkspaceCanvasViewportPreference,
  normalizeWorkspaceDataDrawerSnapPointPreference,
  normalizeWorkspaceDataDrawerTabPreference,
  patchWorkspaceBoardUiPreferences,
  readWorkspaceBoardUiPreferences,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-ui-preferences"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

function stubLocalStorage() {
  const storage = new Map<string, string>()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
    },
  })
  return storage
}

describe("workspace board UI preferences", () => {
  it("starts a fresh organization with Organization and no expanded drawer preference", () => {
    stubLocalStorage()
    const preferences = readWorkspaceBoardUiPreferences({ orgId: "new-org", viewerId: "new-user" })
    expect(preferences.dataDrawerTab).toBe("organization")
    expect(preferences.dataDrawerSnapPoint).toBeNull()
    expect(normalizeWorkspaceDataDrawerTabPreference(undefined)).toBe("organization")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("scopes persisted UI state to the active organization and viewer", () => {
    expect(
      buildWorkspaceBoardUiPreferencesStorageKey({
        orgId: "org 1",
        viewerId: "user@example.com",
      })
    ).toBe("coachhouse:workspace-board-ui:v1:org%201:user%40example.com")
  })

  it("keeps introduction dismissal scoped, reversible, and independent of canvas preferences", () => {
    stubLocalStorage()
    const scope = { orgId: "org-1", viewerId: "viewer-1" }
    patchWorkspaceBoardUiPreferences(scope, { canvasViewport: { x: 12, y: 18, zoom: 1 } })
    patchWorkspaceBoardUiPreferences(scope, { acceleratorIntroductionDismissed: true })
    expect(readWorkspaceBoardUiPreferences(scope).acceleratorIntroductionDismissed).toBe(true)
    expect(readWorkspaceBoardUiPreferences(scope).canvasViewport).toEqual({ x: 12, y: 18, zoom: 1 })
    expect(readWorkspaceBoardUiPreferences({ ...scope, orgId: "org-2" }).acceleratorIntroductionDismissed).toBe(false)
    expect(readWorkspaceBoardUiPreferences({ ...scope, viewerId: "viewer-2" }).acceleratorIntroductionDismissed).toBe(false)
    patchWorkspaceBoardUiPreferences(scope, { acceleratorIntroductionDismissed: false })
    expect(readWorkspaceBoardUiPreferences(scope).acceleratorIntroductionDismissed).toBe(false)
  })

  it("normalizes the saved React Flow viewport before storage", () => {
    expect(
      normalizeWorkspaceCanvasViewportPreference({
        x: 12.345,
        y: -98.765,
        zoom: 4,
      })
    ).toEqual({
      x: 12.35,
      y: -98.76,
      zoom: 1.25,
    })
    expect(normalizeWorkspaceCanvasViewportPreference({ x: 1 })).toBeNull()
  })

  it("normalizes saved workspace person placements before storage", () => {
    expect(
      normalizeWorkspaceCanvasPersonPlacementsPreference([
        { personId: " person-a ", x: 12.4, y: -8.6 },
        { personId: "", x: 1, y: 2 },
        { personId: "person-b", x: 999999, y: -999999 },
        { personId: "person-a", x: 22.8, y: 33.2 },
      ])
    ).toEqual([
      { personId: "person-b", x: 50000, y: -50000 },
      { personId: "person-a", x: 23, y: 33 },
    ])

    expect(normalizeWorkspaceCanvasPersonPlacementsPreference({})).toEqual([])
  })

  it("patches local UI preferences without requiring board-layout persistence", () => {
    const storage = stubLocalStorage()
    const scope = {
      orgId: "org-1",
      viewerId: "user-1",
    }

    patchWorkspaceBoardUiPreferences(scope, {
      canvasViewport: { x: 10, y: 20, zoom: 0.75 },
      canvasViewportLayoutVersion: 2,
      dataDrawerSnapPoint: 0.48,
      dataDrawerTab: "documents",
      teamAccessCollapsed: true,
      workspacePersonPlacements: [{ personId: "person-a", x: 120, y: 220 }],
    })

    expect(
      storage.get(buildWorkspaceBoardUiPreferencesStorageKey(scope))
    ).toBeTruthy()
    expect(readWorkspaceBoardUiPreferences(scope)).toEqual({
      acceleratorIntroductionDismissed: false,
      canvasViewport: { x: 10, y: 20, zoom: 0.75 },
      canvasViewportLayoutVersion: 2,
      dataDrawerSnapPoint: 0.48,
      dataDrawerTab: "documents",
      teamAccessCollapsed: true,
      workspacePersonPlacements: [{ personId: "person-a", x: 120, y: 220 }],
    })
  })

  it("defaults invalid drawer tabs to Organization", () => {
    expect(normalizeWorkspaceDataDrawerTabPreference("organization")).toBe(
      "organization"
    )
    expect(normalizeWorkspaceDataDrawerTabPreference("accelerator")).toBe(
      "accelerator"
    )
    expect(normalizeWorkspaceDataDrawerTabPreference("people")).toBe("people")
    expect(normalizeWorkspaceDataDrawerTabPreference("roadmap")).toBe("roadmap")
    expect(normalizeWorkspaceDataDrawerTabPreference("documents")).toBe(
      "documents"
    )
    expect(normalizeWorkspaceDataDrawerTabPreference("unknown")).toBe(
      "organization"
    )
  })

  it("restores the Particles destination only within the saved organization/viewer scope", () => {
    stubLocalStorage()
    const scope = { orgId: "org-1", viewerId: "viewer-1" }
    patchWorkspaceBoardUiPreferences(scope, {
      dataDrawerTab: "particles",
      dataDrawerSnapPoint: 0.48,
    })
    expect(readWorkspaceBoardUiPreferences(scope).dataDrawerTab).toBe(
      "particles"
    )
    expect(
      readWorkspaceBoardUiPreferences({ ...scope, orgId: "org-2" })
        .dataDrawerTab
    ).toBe("organization")
    expect(
      readWorkspaceBoardUiPreferences({ ...scope, viewerId: "viewer-2" })
        .dataDrawerTab
    ).toBe("organization")
  })

  it("keeps the collapsed drawer tall enough for its tab row", () => {
    expect(normalizeWorkspaceDataDrawerSnapPointPreference(0.06)).toBe("68px")
    expect(normalizeWorkspaceDataDrawerSnapPointPreference("44px")).toBe("68px")
    expect(normalizeWorkspaceDataDrawerSnapPointPreference("52px")).toBe("68px")
    expect(normalizeWorkspaceDataDrawerSnapPointPreference("68px")).toBe("68px")
    expect(normalizeWorkspaceDataDrawerSnapPointPreference(0.48)).toBe(0.48)
  })

  it("wires viewport and drawer state through the shared preference contract", () => {
    const surfaceSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2.tsx"
    )
    const viewportPreferencesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-viewport-preferences.ts"
    )
    const viewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view.tsx"
    )
    const viewTypesSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view-types.ts"
    )
    const cameraEffectsSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/runtime/workspace-canvas-camera-controller-effects.ts"
    )
    const drawerSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx"
    )

    expect(surfaceSource).toContain("useWorkspaceCanvasViewportPreferences")
    expect(surfaceSource).toContain("suppressInitialFit")
    expect(surfaceSource).toContain("onMoveEnd: handleCanvasMoveEnd")
    expect(viewportPreferencesSource).toContain(
      "setViewportZoom(viewport.zoom)"
    )
    expect(viewportPreferencesSource).toContain("viewportZoom,")
    expect(surfaceSource).toContain("uiPreferencesScope,")
    expect(viewSource).toContain("uiPreferencesScope={uiPreferencesScope}")
    expect(viewportPreferencesSource).toContain(
      "readWorkspaceBoardUiPreferences"
    )
    expect(viewportPreferencesSource).toContain("flowInstance.setViewport")
    expect(viewportPreferencesSource).toContain(
      "patchWorkspaceBoardUiPreferences"
    )
    expect(viewportPreferencesSource).toContain("canvasViewport,")
    expect(viewportPreferencesSource).toContain(
      "WORKSPACE_CANVAS_VIEWPORT_LAYOUT_VERSION"
    )
    expect(viewportPreferencesSource).toContain("canvasViewport: null")
    expect(viewportPreferencesSource).toContain("suppressInitialFit:")
    expect(viewTypesSource).toContain("onMoveEnd: OnMoveEnd")
    expect(viewSource).toContain("onMoveEnd={onMoveEnd}")
    expect(cameraEffectsSource).toContain("if (suppressInitialFit) return")
    expect(drawerSource).toContain("dataDrawerSnapPoint: storedSnapPoint")
    const navigationSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-drawer-navigation.ts"
    )
    expect(navigationSource).toContain("dataDrawerTab: next.tab")
    expect(drawerSource).toContain(
      "if (request || guideState) return"
    )
    expect(drawerSource).toContain("}, [request, uiPreferencesScope, guideState])")
  })
})
