import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("workspace canvas v2 viewport controls", () => {
  it("keeps the reset view action removed from the viewport control path", () => {
    const hookSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-viewport-controls.ts"
    )
    const surfaceSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2.tsx"
    )
    const flowSurfaceSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-flow-surface.tsx"
    )

    expect(hookSource).not.toContain("handleResetView")
    expect(surfaceSource).not.toContain("onResetView")
    expect(hookSource).not.toContain("onResetToBaseLayout")
    expect(surfaceSource).not.toContain("onResetToBaseLayout")
    expect(flowSurfaceSource).not.toContain("onResetToBaseLayout")
  })

  it("keeps zoom and recenter controls while omitting reset view", () => {
    const panelSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-viewport-controls-panel.tsx"
    )
    const viewSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view.tsx"
    )
    const surfaceSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2.tsx"
    )
    const flowStateSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-flow-state.ts"
    )

    expect(panelSource).toContain('aria-label="Zoom out"')
    expect(panelSource).toContain('aria-label="Zoom in"')
    expect(panelSource).toContain('aria-label="Recenter view"')
    expect(viewSource).toContain("group/workspace-canvas-surface")
    expect(viewSource).toContain("panOnScroll")
    expect(viewSource).toContain("panOnScrollSpeed={0.8}")
    expect(viewSource).toContain("onNodeDoubleClick={onNodeDoubleClick}")
    expect(surfaceSource).toContain(
      "onNodeDoubleClick: flowState.handleNodeDoubleClick"
    )
    expect(flowStateSource).toContain(
      "executeWorkspaceCanvasViewportCommand({"
    )
    expect(flowStateSource).toContain(
      'command: { kind: "focus-card", cardId: node.id }'
    )
    expect(panelSource).toContain(
      'data-workspace-canvas-viewport-controls="true"'
    )
    expect(panelSource).toContain(
      "group-has-[[data-workspace-canvas-drawer-fullscreen=true]]/workspace-canvas-surface:hidden"
    )
    expect(
      panelSource.match(/h-8 w-11 touch-manipulation rounded-lg after:absolute after:inset-x-0 after:-inset-y-1\.5 md:w-8 md:after:hidden/g)
    ).toHaveLength(3)
    expect(panelSource).toContain(
      "ownerId: `workspace-canvas:viewport-${control}`"
    )
    expect(panelSource).not.toContain("WorkspaceCanvasSurfaceV2HelpOverlay")
    expect(panelSource).not.toContain("particleActions")
    expect(panelSource).not.toContain("RotateCcwIcon")
    expect(panelSource).not.toContain("MyOrganizationCalendarView")
    expect(panelSource).not.toContain("ListTreeIcon")
    expect(panelSource).not.toContain("NetworkIcon")
    expect(panelSource).not.toContain("WorkspaceOntologyMode")
    expect(panelSource).not.toContain("data-workspace-ontology-mode")
    expect(panelSource).not.toContain("onOntologyModeChange")
    expect(panelSource).not.toContain("Focus ontology view")
    expect(panelSource).not.toContain("Map ontology view")
    expect(viewSource).not.toContain("onOntologyModeChange")
    expect(panelSource).not.toContain('aria-label="Reset view"')
    expect(panelSource).not.toContain('title="Reset view"')
  })

  it("preserves keyboard-only canvas focus styling", () => {
    const globalsSource = readSource("src/app/globals.css")

    expect(globalsSource).toContain(
      ".workspace-flow .react-flow__node:focus-visible [data-workspace-card]"
    )
    expect(globalsSource).not.toContain(
      ".workspace-flow .react-flow__node.selected [data-workspace-card]"
    )
    expect(globalsSource).toContain("outline-offset: 3px;")
    expect(globalsSource).not.toContain(
      "0 0 0 6px color-mix(in srgb, var(--ring)"
    )
  })
})
