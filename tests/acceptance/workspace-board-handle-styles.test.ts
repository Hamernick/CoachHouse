import { describe, expect, it } from "vitest"
import { Position } from "@xyflow/react"

import { isWorkspaceNodeAutoHeightCard } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-class-name"
import { resolveWorkspaceBoardHandleClassName } from "@/lib/workspace-canvas/handle-styles"

describe("workspace board handle styles", () => {
  it("does not add custom styling when handles are visible", () => {
    const leftHandleClassName = resolveWorkspaceBoardHandleClassName({
      position: Position.Left,
    })
    const rightHandleClassName = resolveWorkspaceBoardHandleClassName({
      position: Position.Right,
    })

    expect(leftHandleClassName).toBe("")
    expect(rightHandleClassName).toBe("")
  })

  it("hides handles only when explicitly requested", () => {
    expect(
      resolveWorkspaceBoardHandleClassName({
        position: Position.Right,
      }),
    ).not.toContain("!opacity-0")

    expect(
      resolveWorkspaceBoardHandleClassName({
        position: Position.Right,
        hidden: true,
      }),
    ).toContain("!opacity-0")
  })

  it("marks the intrinsically sized workspace cards as auto-height", () => {
    expect(isWorkspaceNodeAutoHeightCard("organization-overview")).toBe(true)
    expect(isWorkspaceNodeAutoHeightCard("programs")).toBe(true)
    expect(isWorkspaceNodeAutoHeightCard("accelerator")).toBe(true)
    expect(isWorkspaceNodeAutoHeightCard("calendar")).toBe(true)
    expect(isWorkspaceNodeAutoHeightCard("communications")).toBe(true)
  })
})
