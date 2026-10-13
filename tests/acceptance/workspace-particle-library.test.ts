import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  readParticleDrag,
  placeParticle,
} from "@/features/workspace-particles/lib/particle-placement"
import { filterParticleLibraryTools } from "@/features/workspace-particles/lib/particle-library"
import { reduceWorkspaceBoardVisibility } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-visibility-reducer"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { readParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { ParticleLibrary } from "@/features/workspace-particles/components/particle-library"
import { ParticleLibraryTile } from "@/features/workspace-particles/components/particle-library-tile"
import { placeWorkspaceTool } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-tool-placement"
import {
  buildDefaultBoardState,
  normalizeWorkspaceBoardState,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import { resolveVisibleWorkspaceCanvasCardIds } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-visible-cards"
import {
  batch,
  edge,
  graph,
  particle,
  ID,
  WORKSPACE,
  NOW,
} from "./fixtures/particle-fixtures"

describe("Particle library placement", () => {
  it("keeps deliberate Organization removal through unrelated legacy visibility edits", () => {
    const initial = buildDefaultBoardState("balanced")
    const hidden = placeWorkspaceTool(initial, "organization-overview", false)
    const updated = reduceWorkspaceBoardVisibility(hidden, {
      type: "dock_toggle_card",
      cardId: "accelerator",
    })
    const reloaded = normalizeWorkspaceBoardState(
      JSON.parse(JSON.stringify(updated))
    )
    expect(reloaded.visibility?.organizationHiddenExplicitly).toBe(true)
    expect(reloaded.hiddenCardIds).toContain("organization-overview")
    const restored = normalizeWorkspaceBoardState(
      placeWorkspaceTool(reloaded, "organization-overview", true)
    )
    expect(restored.hiddenCardIds).not.toContain("organization-overview")
    expect(restored.visibility?.organizationHiddenExplicitly).not.toBe(true)
  })

  it("filters tool labels and descriptions with the same flexible word matching", () => {
    const tools = [
      { title: "Fiscal Sponsorship", subtitle: "Application and documents" },
      { title: "Activities", subtitle: "Programs and events" },
    ]
    expect(filterParticleLibraryTools(tools, "  fiscal DOCUMENTS  ")).toEqual([
      tools[0],
    ])
    expect(filterParticleLibraryTools(tools, "events")).toEqual([tools[1]])
    expect(filterParticleLibraryTools(tools, "unmatched")).toEqual([])
    expect(filterParticleLibraryTools(tools, "")).toEqual(tools)
  })

  it("accepts only validated same-workspace Particle or tool drags", () => {
    for (const payload of [
      { kind: "particle", workspaceId: WORKSPACE, id: ID(1) },
      { kind: "tool", workspaceId: WORKSPACE, id: "organization-overview" },
      { kind: "tool", workspaceId: WORKSPACE, id: "programs" },
      { kind: "tool", workspaceId: WORKSPACE, id: "fiscal-sponsorship" },
    ])
      expect(readParticleDrag(JSON.stringify(payload), WORKSPACE)).toEqual(
        payload
      )
    for (const payload of [
      "broken",
      JSON.stringify({ kind: "tool", workspaceId: ID(500), id: "programs" }),
      JSON.stringify({
        kind: "tool",
        workspaceId: WORKSPACE,
        id: "unregistered",
      }),
      JSON.stringify({
        kind: "particle",
        workspaceId: WORKSPACE,
        id: "not-a-uuid",
      }),
      "x".repeat(1025),
    ]) {
      expect(readParticleDrag(payload, WORKSPACE)).toBeNull()
    }
  })

  it("persists a remove/restore round trip without deleting nested records or connections", async () => {
    const record = particle(2, "activity")
    if (record.type !== "activity") throw new Error("fixture")
    record.data.steps = [
      { id: ID(20), title: "Book venue", order: 0, status: "done" },
    ]
    const initial = graph([particle(1, "objective"), record], [edge(10, 1, 2)])
    const hidden = await applyParticleBatch(
      initial,
      batch(100, [
        {
          kind: "put_particle",
          particle: placeParticle(record, false),
          expectedRevision: record.revision,
        },
      ]),
      NOW
    )
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) return
    const reloaded = readParticleGraph(
      JSON.parse(JSON.stringify(hidden.value.graph)),
      WORKSPACE
    )
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    expect(reloaded.value.connections).toEqual(initial.connections)
    expect(particleConnectionsToFlow(reloaded.value)).toEqual([])
    const saved = reloaded.value.particles.find(
      (item) => item.id === record.id
    )!
    expect(saved.data).toEqual(record.data)
    expect(saved.position).toEqual(record.position)
    const restored = await applyParticleBatch(
      reloaded.value,
      batch(
        101,
        [
          {
            kind: "put_particle",
            particle: placeParticle(saved, true, { x: 421, y: -37 }),
            expectedRevision: saved.revision,
          },
        ],
        reloaded.value.revision
      ),
      NOW
    )
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(particleConnectionsToFlow(restored.value.graph)).toHaveLength(1)
    expect(
      restored.value.graph.particles.find((item) => item.id === record.id)
        ?.position
    ).toEqual({ x: 421, y: -37 })
  })

  it("lets locked Particles return to the library without moving their position", () => {
    const record = { ...particle(1), locked: true }
    const restored = placeParticle(placeParticle(record, false), true, {
      x: 999,
      y: 999,
    })
    expect(restored.position).toEqual(record.position)
    expect(restored.canvasHidden).toBe(false)
  })

  it.each(["organization-overview", "programs", "fiscal-sponsorship"] as const)(
    "keeps %s placement after board normalization without moving other tools",
    (id) => {
      const initial = buildDefaultBoardState("balanced")
      const hidden = placeWorkspaceTool(initial, id, false)
      expect(hidden.nodes).toBe(initial.nodes)
      expect(hidden.connections).toBe(initial.connections)
      const reloaded = normalizeWorkspaceBoardState(
        JSON.parse(JSON.stringify(hidden))
      )
      expect(reloaded.hiddenCardIds).toContain(id)
      expect(
        resolveVisibleWorkspaceCanvasCardIds(reloaded.hiddenCardIds)
      ).not.toContain(id)
      const restored = placeWorkspaceTool(reloaded, id, true, {
        x: 437,
        y: 283,
      })
      expect(restored.hiddenCardIds).not.toContain(id)
      expect(restored.nodes.find((node) => node.id === id)).toMatchObject({
        x: 437,
        y: 283,
      })
      for (const node of reloaded.nodes.filter((node) => node.id !== id))
        expect(restored.nodes.find((item) => item.id === node.id)).toBe(node)
    }
  )
})

describe("Particle preview gallery", () => {
  it("renders actual checklist content in rounded previews, without editor links", () => {
    const record = particle(1, "activity")
    if (record.type !== "activity") throw new Error("fixture")
    record.canvasHidden = true
    record.title = "Community dinner"
    record.data.steps = [
      { id: ID(20), title: "Book venue", status: "done", order: 0 },
    ]
    const html = renderToStaticMarkup(
      createElement(ParticleLibrary, {
        particles: [record],
        editable: true,
        canEdit: true,
        pending: false,
        error: null,
        onCreate: async () => true,
        onRetry: () => {},
        onPlace: () => {},
      })
    )
    expect(html).toContain("Book venue")
    expect(html).toContain("1 of 1 complete")
    expect(html).toContain("columns-[320px]")
    expect(html).toContain("rounded-[28px]")
    expect(html).not.toContain("On canvas")
    expect(html).toContain('aria-label="Add Community dinner to canvas"')
    expect(html).not.toContain('aria-label="Open Community dinner"')
    expect(html).toContain('type="search"')
    expect(html).toContain("inert=")
  })

  it("places minimal on-canvas placeholders after available previews without mounting their contents", () => {
    const placed = particle(1, "activity")
    if (placed.type !== "activity") throw new Error("fixture")
    placed.title = "Placed activity"
    placed.data.steps = [
      { id: ID(20), title: "Must not appear", status: "done", order: 0 },
    ]
    const available = {
      ...particle(2),
      title: "Available objective",
      canvasHidden: true,
    }
    const html = renderToStaticMarkup(
      createElement(ParticleLibrary, {
        particles: [placed, available],
        editable: true,
        canEdit: true,
        pending: false,
        error: null,
        onCreate: async () => true,
        onRetry: () => {},
        onPlace: () => {},
      })
    )
    expect(html.indexOf("Available objective")).toBeLessThan(
      html.indexOf("Placed activity")
    )
    expect(html).not.toContain("Must not appear")
    expect(html).toContain("border-dashed")
    expect(html).toContain("On canvas")
    expect(html).not.toContain('aria-label="Add Particle"')
    const placeholder = renderToStaticMarkup(
      createElement(ParticleLibraryTile, {
        id: ID(1),
        title: "Placed activity",
        subtitle: "Activity",
        visible: true,
        disabled: false,
        preview: createElement(() => {
          throw new Error("Placed preview mounted")
        }),
        drag: { kind: "particle", workspaceId: WORKSPACE, id: ID(1) },
        onPlace: () => {},
      })
    )
    expect(placeholder).not.toContain('draggable="true"')
    expect(placeholder).toContain(
      'aria-label="Remove Placed activity from canvas"'
    )
  })

  it("offers an accessible Add alternative and disables dragging for viewers", () => {
    const props = {
      id: ID(1),
      title: "Activity",
      subtitle: "Checklist",
      visible: false,
      preview: createElement("p", null, "Actual data"),
      drag: { kind: "particle" as const, workspaceId: WORKSPACE, id: ID(1) },
      onPlace: () => {},
    }
    const editable = renderToStaticMarkup(
      createElement(ParticleLibraryTile, { ...props, disabled: false })
    )
    expect(editable).toContain('draggable="true"')
    expect(editable).toContain('aria-label="Add Activity to canvas"')
    const readOnly = renderToStaticMarkup(
      createElement(ParticleLibraryTile, { ...props, disabled: true })
    )
    expect(readOnly).toContain('draggable="false"')
    expect(readOnly).toContain('disabled=""')
  })
})
