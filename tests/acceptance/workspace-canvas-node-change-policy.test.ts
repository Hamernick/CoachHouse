import { describe, expect, it } from "vitest"
import type { NodeChange } from "@xyflow/react"

import { shouldReconcileWorkspaceCanvasNodes } from "../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-node-change-policy"

describe("workspace canvas node change policy", () => {
  it("keeps live drag positions on the fast path", () => {
    const transientPosition = {
      id: "organization-overview",
      type: "position",
      position: { x: 120, y: 80 },
      dragging: true,
    } satisfies NodeChange
    const selection = {
      id: "organization-overview",
      type: "select",
      selected: true,
    } satisfies NodeChange
    const settledPosition = {
      id: "organization-overview",
      type: "position",
      position: { x: 160, y: 96 },
      dragging: false,
    } satisfies NodeChange

    expect(
      shouldReconcileWorkspaceCanvasNodes([transientPosition, selection])
    ).toBe(false)
    expect(
      shouldReconcileWorkspaceCanvasNodes([selection, settledPosition])
    ).toBe(true)
  })
})
