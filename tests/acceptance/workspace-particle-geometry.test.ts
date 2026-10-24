import { describe, expect, it } from "vitest"
import { Position, type InternalNode, type Node } from "@xyflow/react"
import { createParticleGeometrySelector } from "@/features/workspace-particles/lib/particle-geometry-observer"

function measured(id: string): InternalNode {
  const node: Node = { id, data: {}, position: { x: 0, y: 0 } }
  return {
    ...node,
    measured: { width: 280, height: 200 },
    internals: {
      positionAbsolute: { x: 0, y: 0 },
      z: 0,
      userNode: node,
      handleBounds: {
        target: null,
        source: [
          {
            id: "out",
            position: Position.Right,
            x: 280,
            y: 100,
            width: 12,
            height: 12,
            nodeId: id,
            type: "source",
          },
        ],
      },
    },
  }
}

describe("Particle geometry notifications", () => {
  it("ignores selection, card content and viewport updates across 250 cards", () => {
    const nodeLookup = new Map(
      Array.from({ length: 250 }, (_, i) => [String(i), measured(String(i))])
    )
    const select = createParticleGeometrySelector()
    const revision = select({ nodeLookup })
    for (let i = 0; i < 100; i++) {
      const node = nodeLookup.get("0")!
      nodeLookup.set("0", {
        ...node,
        selected: i % 2 === 0,
        data: { title: String(i) },
      })
      expect(select({ nodeLookup })).toBe(revision)
    }
  })

  it("reports drag start and finish without notifying for intermediate positions", () => {
    const node = measured("a"),
      nodeLookup = new Map([[node.id, node]])
    const select = createParticleGeometrySelector()
    const idle = select({ nodeLookup })
    node.dragging = true
    const dragging = select({ nodeLookup })
    expect(dragging).not.toBe(idle)
    for (let x = 1; x <= 120; x++) {
      node.internals.positionAbsolute.x = x
      expect(select({ nodeLookup })).toBe(dragging)
    }
    node.dragging = false
    const settled = select({ nodeLookup })
    expect(settled).not.toBe(dragging)
    expect(settled).not.toBe(idle)
    expect(select({ nodeLookup })).toBe(settled)
  })

  it("waits until every selected card finishes dragging", () => {
    const a = measured("a"),
      b = measured("b")
    const nodeLookup = new Map([
      [a.id, a],
      [b.id, b],
    ])
    const select = createParticleGeometrySelector()
    select({ nodeLookup })
    a.dragging = b.dragging = true
    const dragging = select({ nodeLookup })
    a.dragging = false
    expect(select({ nodeLookup })).toBe(dragging)
    b.dragging = false
    expect(select({ nodeLookup })).not.toBe(dragging)
  })

  it.each(["move", "resize", "handle", "hide", "unmeasure"])(
    "detects %s even when React Flow mutates the same lookup",
    (change) => {
      const node = measured("a"),
        nodeLookup = new Map([[node.id, node]])
      const select = createParticleGeometrySelector()
      const before = select({ nodeLookup })
      if (change === "move") node.internals.positionAbsolute.y = 40
      if (change === "resize") node.measured.height = 400
      if (change === "handle") node.internals.handleBounds!.source![0].y = 120
      if (change === "hide") node.hidden = true
      if (change === "unmeasure") node.internals.handleBounds = undefined
      expect(select({ nodeLookup })).not.toBe(before)
    }
  )

  it("handles replacements, removal, empty graphs and independent canvases", () => {
    const nodeLookup = new Map([["a", measured("a")]])
    const select = createParticleGeometrySelector(),
      other = createParticleGeometrySelector()
    const before = select({ nodeLookup })
    const otherBefore = other({ nodeLookup })
    nodeLookup.delete("a")
    nodeLookup.set("b", measured("b"))
    expect(select({ nodeLookup })).not.toBe(before)
    nodeLookup.clear()
    const empty = select({ nodeLookup })
    expect(select({ nodeLookup })).toBe(empty)
    expect(other({ nodeLookup: new Map([["a", measured("a")]]) })).toBe(
      otherBefore
    )
  })

  it("ignores equivalent handle remeasurement and lookup iteration order", () => {
    const a = measured("a"),
      b = measured("b")
    const select = createParticleGeometrySelector()
    const before = select({
      nodeLookup: new Map([
        [a.id, a],
        [b.id, b],
      ]),
    })
    expect(
      select({
        nodeLookup: new Map([
          [b.id, measured(b.id)],
          [a.id, measured(a.id)],
        ]),
      })
    ).toBe(before)
  })
})
