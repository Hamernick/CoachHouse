import { afterEach, describe, expect, it, vi } from "vitest"
import { focusWorkspaceCanvasPeople } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-fit-request"

import {
  executeWorkspaceCanvasViewportCommand,
  resolveWorkspaceCanvasCameraDuration,
  resolveWorkspaceCanvasDrawerAwareFocusViewportSize,
  resolveWorkspaceCanvasViewportCommand,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/runtime/workspace-canvas-viewport-command"

const LAYOUT_OPTIONS = {
  padding: 0.24,
  minZoom: 0.2,
  maxZoom: 1.25,
  duration: 220,
} as const

const SCENE_OPTIONS = {
  padding: 0.3,
  minZoom: 0.24,
  maxZoom: 1.14,
  duration: 280,
} as const

const FOCUS_OPTIONS = {
  padding: 0.34,
  minZoom: 0.24,
  maxZoom: 1.15,
  duration: 240,
} as const

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("workspace canvas viewport command", () => {
  it("reveals an unmeasured offscreen person above the drawer", () => {
    const setViewport = vi.fn()
    const fitView = vi.fn()
    focusWorkspaceCanvasPeople(
      { setViewport, fitView } as never,
      [{ id: "workspace-person:a", position: { x: 5000, y: -2000 }, data: {} }],
      { width: 1000, height: 320 }
    )
    const [viewport, options] = setViewport.mock.calls[0]
    expect((5000 + 122) * viewport.zoom + viewport.x).toBeCloseTo(500)
    expect((-2000 + 32) * viewport.zoom + viewport.y).toBeCloseTo(160)
    expect(options.duration).toBe(260)
    expect(fitView).not.toHaveBeenCalled()
  })

  it("reveals a person without animation for reduced motion", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) })
    const setViewport = vi.fn()
    focusWorkspaceCanvasPeople(
      { setViewport } as never,
      [{ id: "workspace-person:a", position: { x: 20, y: 30 }, data: {} }],
      { width: 1000, height: 320 }
    )
    expect(setViewport.mock.calls[0][1]).toEqual({ duration: 0 })
  })
  it("removes camera motion when reduced motion is requested", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: true })),
    })

    expect(resolveWorkspaceCanvasCameraDuration(520)).toBe(0)
  })

  it("uses only the canvas area above an overlapping drawer for card focus", () => {
    expect(
      resolveWorkspaceCanvasDrawerAwareFocusViewportSize({
        frameRect: { top: 0, bottom: 800, width: 1200, height: 800 },
        drawerRect: { top: 420, bottom: 800, width: 1200, height: 380 },
      })
    ).toEqual({ width: 1200, height: 420 })

    expect(
      resolveWorkspaceCanvasDrawerAwareFocusViewportSize({
        frameRect: { top: 0, bottom: 800, width: 1200, height: 800 },
        drawerRect: { top: 732, bottom: 800, width: 1200, height: 68 },
      })
    ).toBeNull()
  })

  it("centers a focused card within the drawer-aware viewport", () => {
    const setViewport = vi.fn()
    const fitView = vi.fn()
    const flowInstance = {
      getNodes: vi.fn(() => [
        {
          id: "organization-overview",
          position: { x: 400, y: 300 },
          width: 240,
          height: 160,
        },
      ]),
      setViewport,
      fitView,
    }

    const result = executeWorkspaceCanvasViewportCommand({
      flowInstance: flowInstance as never,
      command: { kind: "focus-card", cardId: "organization-overview" },
      layoutFitOptions: LAYOUT_OPTIONS,
      sceneFitOptions: SCENE_OPTIONS,
      focusCardOptions: FOCUS_OPTIONS,
      focusViewportSize: { width: 1200, height: 420 },
    })

    expect(result.executed).toBe(true)
    expect(setViewport).toHaveBeenCalledOnce()
    expect(fitView).not.toHaveBeenCalled()
  })

  it("frames an organization and guide as a column during identity", () => {
    const setViewport = vi.fn()
    vi.stubGlobal("document", { querySelector: (selector: string) => {
      if (selector.includes("data-setup-guide-stage")) return { querySelector: () => ({ offsetHeight: 240 }) }
      if (selector.includes("flow-frame")) return { getBoundingClientRect: () => ({ top: 80, width: 390, height: 660 }) }
      if (selector.includes("overlay-drawer")) return { getBoundingClientRect: () => ({ top: 672 }) }
      return null
    } })
    executeWorkspaceCanvasViewportCommand({
      flowInstance: { getNodes: () => [{ id: "organization-overview", position: { x: 400, y: 300 }, width: 672, height: 800 }], setViewport } as never,
      command: { kind: "focus-card", cardId: "organization-overview" },
      layoutFitOptions: LAYOUT_OPTIONS, sceneFitOptions: SCENE_OPTIONS, focusCardOptions: FOCUS_OPTIONS,
      focusViewportSize: null,
    })
    const camera = setViewport.mock.calls[0][0]
    const top = 300 * camera.zoom + camera.y
    const bottom = top + 800 * camera.zoom
    const guideHeight = 240
    expect((400 + 336) * camera.zoom + camera.x).toBeCloseTo(195)
    expect((top + bottom + 20 + guideHeight) / 2).toBeCloseTo(296)
    expect(bottom + 20 + guideHeight).toBeLessThanOrEqual(576)
    expect(camera.zoom).toBeLessThan(0.4)
  })

  it("uses the shared precedence of scene-fit, then tutorial completion exit, then focus-card, then fit-visible", () => {
    expect(
      resolveWorkspaceCanvasViewportCommand({
        tutorialSceneFitRequest: {
          nodeIds: ["workspace-canvas-tutorial"],
          requestKey: 2,
          signature: "scene::2",
          layoutKey: "scene-layout",
          x: 100,
          y: 200,
          zoom: 0.72,
        },
        tutorialCompletionExitRequest: {
          kind: "focus-card",
          cardId: "accelerator",
          requestKey: 4,
        },
        focusCardRequest: {
          cardId: "calendar",
          requestKey: 5,
        },
        visibleNodeIds: ["organization-overview", "calendar", "accelerator"],
      })
    ).toEqual({
      kind: "scene-fit",
      sceneFitRequest: {
        nodeIds: ["workspace-canvas-tutorial"],
        requestKey: 2,
        signature: "scene::2",
        layoutKey: "scene-layout",
        x: 100,
        y: 200,
        zoom: 0.72,
      },
    })

    expect(
      resolveWorkspaceCanvasViewportCommand({
        tutorialSceneFitRequest: null,
        tutorialCompletionExitRequest: {
          kind: "focus-card",
          cardId: "accelerator",
          requestKey: 4,
        },
        focusCardRequest: {
          cardId: "calendar",
          requestKey: 5,
        },
        visibleNodeIds: ["organization-overview", "calendar", "accelerator"],
      })
    ).toEqual({
      kind: "focus-card",
      cardId: "accelerator",
    })

    expect(
      resolveWorkspaceCanvasViewportCommand({
        tutorialSceneFitRequest: null,
        tutorialCompletionExitRequest: {
          kind: "focus-card",
          cardId: "deck",
          requestKey: 4,
        },
        focusCardRequest: {
          cardId: "calendar",
          requestKey: 5,
        },
        visibleNodeIds: ["organization-overview", "calendar", "accelerator"],
      })
    ).toEqual({
      kind: "fit-visible",
      nodeIds: ["organization-overview", "calendar", "accelerator"],
    })

    expect(
      resolveWorkspaceCanvasViewportCommand({
        tutorialSceneFitRequest: null,
        tutorialCompletionExitRequest: null,
        focusCardRequest: {
          cardId: "calendar",
          requestKey: 5,
        },
        visibleNodeIds: ["organization-overview", "calendar", "accelerator"],
      })
    ).toEqual({
      kind: "focus-card",
      cardId: "calendar",
    })

    expect(
      resolveWorkspaceCanvasViewportCommand({
        tutorialSceneFitRequest: null,
        tutorialCompletionExitRequest: null,
        focusCardRequest: null,
        visibleNodeIds: ["organization-overview", "accelerator"],
      })
    ).toEqual({
      kind: "fit-visible",
      nodeIds: ["organization-overview", "accelerator"],
    })
  })

  it("does not treat the journey target as an implicit recenter focus request", () => {
    expect(
      resolveWorkspaceCanvasViewportCommand({
        tutorialSceneFitRequest: null,
        tutorialCompletionExitRequest: null,
        focusCardRequest: null,
        visibleNodeIds: ["organization-overview", "programs", "accelerator"],
      })
    ).toEqual({
      kind: "fit-visible",
      nodeIds: ["organization-overview", "programs", "accelerator"],
    })
  })

  it("executes authored scene-fit centers through the shared viewport executor", () => {
    const setCenter = vi.fn()
    const fitView = vi.fn()
    const flowInstance = {
      getNodes: vi.fn(() => []),
      setCenter,
      fitView,
    } as const

    executeWorkspaceCanvasViewportCommand({
      flowInstance: flowInstance as never,
      command: {
        kind: "scene-fit",
        sceneFitRequest: {
          nodeIds: ["workspace-canvas-tutorial"],
          requestKey: 1,
          signature: "scene::1",
          layoutKey: "scene-layout",
          x: 512,
          y: 388,
          zoom: 2,
          duration: 320,
        },
      },
      layoutFitOptions: LAYOUT_OPTIONS,
      sceneFitOptions: SCENE_OPTIONS,
      focusCardOptions: FOCUS_OPTIONS,
    })

    expect(setCenter).toHaveBeenCalledWith(512, 388, {
      zoom: 1.14,
      duration: 320,
    })
    expect(fitView).not.toHaveBeenCalled()
  })

  it("executes accelerator branch fits through the shared viewport executor", () => {
    const setCenter = vi.fn()
    const fitView = vi.fn()
    const flowInstance = {
      getNodes: vi.fn(() => [
        { id: "accelerator" },
        { id: "workspace-board-accelerator-step" },
      ]),
      setCenter,
      fitView,
    } as const

    const result = executeWorkspaceCanvasViewportCommand({
      flowInstance: flowInstance as never,
      command: {
        kind: "fit-nodes",
        nodeIds: ["accelerator", "workspace-board-accelerator-step"],
        options: "accelerator-focus",
      },
      layoutFitOptions: LAYOUT_OPTIONS,
      sceneFitOptions: SCENE_OPTIONS,
      focusCardOptions: FOCUS_OPTIONS,
      acceleratorFocusOptions: {
        padding: 0.4,
        minZoom: 0.3,
        maxZoom: 1.05,
        duration: 260,
      },
    })

    expect(result).toEqual({
      executed: true,
      kind: "fit-nodes",
      nodeCount: 2,
    })
    expect(fitView).toHaveBeenCalledWith({
      nodes: [
        { id: "accelerator" },
        { id: "workspace-board-accelerator-step" },
      ],
      padding: 0.4,
      minZoom: 0.3,
      maxZoom: 1.05,
      duration: 260,
    })
    expect(setCenter).not.toHaveBeenCalled()
  })
})
