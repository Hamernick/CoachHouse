import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ReactFlowProvider } from "@xyflow/react"
import { ParticleEdge } from "@/features/workspace-particles/components/particle-edge"
import { describe, expect, it } from "vitest"
import { Position, type InternalNode, type Node } from "@xyflow/react"
import {
  PARTICLE_HANDLE_SIDES,
  resolveParticleEdgeGeometry,
} from "@/features/workspace-particles/lib/particle-handle-geometry"
import { particleHandleId } from "@/features/workspace-particles/lib/particle-handle-ids"
import { buildParticleLink } from "@/features/workspace-particles/lib/connection-editing"
import { ID, graph, particle } from "./fixtures/particle-fixtures"

function measured(
  id: string,
  x: number,
  y: number,
  width = 280,
  height = 200,
  outcome?: string
): InternalNode {
  const node: Node = { id, position: { x, y }, data: {} }
  const tool = !id.startsWith("00000000")
  const handles = (type: "source" | "target") =>
    PARTICLE_HANDLE_SIDES.flatMap((side) => {
      const ids =
        type === "target"
          ? ["in"]
          : ["out", ...(outcome ? [`outcome:${outcome}`] : [])]
      return ids.map((handle, index) => {
        const fraction = (index + 1) / (ids.length + 1)
        return {
          id: tool
            ? `workspace-card-${type}-${side}`
            : particleHandleId(handle, side),
          nodeId: id,
          type,
          position: side,
          width: 12,
          height: 12,
          x:
            (side === Position.Left
              ? 0
              : side === Position.Right
                ? width
                : width * fraction) - 6,
          y:
            (side === Position.Top
              ? 0
              : side === Position.Bottom
                ? height
                : height * fraction) - 6,
        }
      })
    })
  return {
    ...node,
    measured: { width, height },
    internals: {
      userNode: node,
      positionAbsolute: node.position,
      z: 0,
      handleBounds: { source: handles("source"), target: handles("target") },
    },
  }
}

describe("live Particle connection attachment", () => {
  it.each([
    [600, 0, Position.Right, Position.Left],
    [-600, 0, Position.Left, Position.Right],
    [0, 500, Position.Bottom, Position.Top],
    [0, -500, Position.Top, Position.Bottom],
  ])(
    "follows a connected card to (%s, %s)",
    (x, y, sourcePosition, targetPosition) => {
      expect(
        resolveParticleEdgeGeometry(
          measured(ID(1), 0, 0),
          measured(ID(2), x, y)
        )
      ).toMatchObject({ sourcePosition, targetPosition })
    }
  )

  it("reads current absolute positions on every update, including source movement", () => {
    const target = measured(ID(2), 600, 0)
    expect(
      resolveParticleEdgeGeometry(measured(ID(1), 0, 0), target)
    ).toMatchObject({ sourceX: 286, targetX: 594 })
    expect(
      resolveParticleEdgeGeometry(measured(ID(1), 1200, 0), target)
    ).toMatchObject({
      sourcePosition: Position.Left,
      sourceX: 1194,
      targetX: 886,
    })
  })

  it("accounts for unequal measured dimensions and resolves ties deterministically", () => {
    expect(
      resolveParticleEdgeGeometry(
        measured(ID(1), 0, 0, 280, 900),
        measured(ID(2), 400, 650)
      )
    ).toMatchObject({
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })
    expect(
      resolveParticleEdgeGeometry(measured(ID(1), 0, 0), measured(ID(2), 0, 0))
    ).toMatchObject({
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })
  })

  it.each(["organization-overview", "programs", "fiscal-sponsorship"])(
    "uses existing %s native handles in both directions",
    (id) => {
      const tool = measured(id, 0, 500)
      const domain = measured(ID(1), 0, 0)
      expect(resolveParticleEdgeGeometry(domain, tool)).toMatchObject({
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        sourceY: 206,
        targetY: 494,
      })
      expect(resolveParticleEdgeGeometry(tool, domain)).toMatchObject({
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
        sourceY: 494,
        targetY: 206,
      })
    }
  )

  it("retains measured outcome-port spacing when moving onto a vertical side", () => {
    const source = measured(ID(1), 0, 0, 300, 200, "yes")
    expect(
      resolveParticleEdgeGeometry(
        source,
        measured(ID(2), 0, 500),
        "outcome:yes"
      )
    ).toMatchObject({
      sourcePosition: Position.Bottom,
      sourceX: 200,
      sourceY: 206,
    })
  })

  it("falls back while endpoints or their native handles are unmeasured", () => {
    const source = measured(ID(1), 0, 0)
    const target = measured(ID(2), 0, 500)
    expect(resolveParticleEdgeGeometry(undefined, target)).toBeNull()
    source.measured = {}
    expect(resolveParticleEdgeGeometry(source, target)).toBeNull()
    expect(
      resolveParticleEdgeGeometry(measured(ID(1), 0, 0), target, "missing")
    ).toBeNull()
  })

  it.each(PARTICLE_HANDLE_SIDES)(
    "persists semantic handles when connecting from %s",
    (side) => {
      const result = buildParticleLink(
        graph(),
        {
          source: ID(1),
          target: ID(2),
          sourceHandle: particleHandleId("out", side),
          targetHandle: particleHandleId("in", side),
        },
        ID(90)
      )
      expect(result).toMatchObject({
        ok: true,
        value: {
          id: ID(90),
          sourceHandle: "out",
          targetHandle: "in",
          relationship: "dependency",
        },
      })
    }
  )

  it("preserves decision outcomes and rejects unknown aliases", () => {
    const decision = particle(1, "decision")
    if (decision.type !== "decision") throw new Error("Expected decision")
    const outcome = decision.data.outcomes[0].id
    const input = graph([decision, particle(2)])
    expect(
      buildParticleLink(
        input,
        {
          source: ID(1),
          target: ID(2),
          sourceHandle: `outcome:${outcome}@bottom`,
          targetHandle: "in@top",
        },
        ID(90)
      )
    ).toMatchObject({
      ok: true,
      value: {
        sourceHandle: `outcome:${outcome}`,
        targetHandle: "in",
        outcome,
        relationship: "decision_outcome",
      },
    })
    expect(
      buildParticleLink(
        input,
        { source: ID(1), target: ID(2), sourceHandle: "out@diagonal" },
        ID(90)
      )
    ).toMatchObject({ ok: false })
  })
})

describe("Particle edge renderer", () => {
  it("uses live native node geometry rather than fixed edge coordinates", () => {
    const render = (x: number) => {
      const nodes = [measured(ID(1), 0, 0), measured(ID(2), x, 0)]
      const initialNodes = nodes.map((node) => ({
        ...node,
        width: node.measured.width,
        height: node.measured.height,
        handles: [
          ...(node.internals.handleBounds?.source ?? []),
          ...(node.internals.handleBounds?.target ?? []),
        ],
      }))
      const providerProps = {
        initialNodes,
        children: createElement(
          "svg",
          null,
          createElement(ParticleEdge, {
            id: ID(90),
            source: ID(1),
            target: ID(2),
            type: "workspace-particle",
            sourceX: 9999,
            sourceY: 9999,
            targetX: 9999,
            targetY: 9999,
            sourceHandleId: "out",
            targetHandleId: "in",
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            selectable: false,
            deletable: false,
          })
        ),
      }
      return renderToStaticMarkup(
        createElement(ReactFlowProvider, providerProps)
      )
    }
    expect(render(600)).toContain("M286 100")
    expect(render(-600)).toContain("M-6 100")
    expect(render(-600)).not.toContain("M9999")
  })
})
