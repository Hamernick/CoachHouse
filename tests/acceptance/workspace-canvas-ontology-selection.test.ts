import { describe, expect, it } from "vitest"
import type { NodeChange } from "@xyflow/react"

import { buildWorkspaceOntologyEmphasisResolver } from "../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-ontology-emphasis"
import { applyWorkspaceOntologySelectionChanges } from "../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-ontology-selection"

describe("workspace ontology selection", () => {
  it("tracks selected ontology nodes without treating positions as selection", () => {
    const selectedIds = new Set(["ontology:organization:mission"])
    const changes = [
      {
        id: "ontology:organization:mission",
        type: "select",
        selected: false,
      },
      {
        id: "ontology:accelerator:legal",
        type: "select",
        selected: true,
      },
      {
        id: "ontology:accelerator:legal",
        type: "position",
        position: { x: 320, y: 160 },
        dragging: false,
      },
    ] satisfies NodeChange[]

    expect(
      Array.from(
        applyWorkspaceOntologySelectionChanges({ selectedIds, changes })
      )
    ).toEqual(["ontology:accelerator:legal"])
  })

  it("preserves the same set when no selection changed", () => {
    const selectedIds = new Set(["ontology:organization:mission"])
    const result = applyWorkspaceOntologySelectionChanges({
      selectedIds,
      changes: [],
    })

    expect(result).toBe(selectedIds)
  })

  it("keeps the active path and its immediate actions while dimming siblings", () => {
    const resolveEmphasis = buildWorkspaceOntologyEmphasisResolver(
      ["ontology:organization:formation"],
      "organization-overview"
    )

    expect(
      resolveEmphasis({
        id: "ontology:organization:formation",
        parentId: "organization-overview",
        rootId: "organization-overview",
      })
    ).toEqual({ active: true, dimmed: false })
    expect(
      resolveEmphasis({
        id: "ontology:organization:file",
        parentId: "ontology:organization:formation",
        rootId: "organization-overview",
      }).dimmed
    ).toBe(false)
    expect(
      resolveEmphasis({
        id: "ontology:organization:programs",
        parentId: "organization-overview",
        rootId: "organization-overview",
      }).dimmed
    ).toBe(true)
    expect(
      resolveEmphasis({
        id: "ontology:accelerator:start",
        parentId: "accelerator",
        rootId: "accelerator",
      }).dimmed
    ).toBe(true)
  })
})
