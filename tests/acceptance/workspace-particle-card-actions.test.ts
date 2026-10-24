import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  duplicateParticle,
  particleCardOperation,
} from "@/features/workspace-particles/lib/particle-card-actions"
import { ParticleCard } from "@/features/workspace-particles/components/particle-card"
import { useParticleCardActions } from "@/features/workspace-particles/hooks/use-particle-card-actions"
import {
  useParticleSession,
  type ParticleTransport,
} from "@/features/workspace-particles/hooks/use-particle-session"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import {
  batch,
  edge,
  graph,
  particle,
  ID,
  NOW,
  WORKSPACE,
} from "./fixtures/particle-fixtures"

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }))

describe("Shared Particle card actions", () => {
  it.each([
    "objective",
    "activity",
    "calendar",
    "people",
    "decision",
    "metric",
    "workflow",
    "finance",
  ] as const)("duplicates %s without mutating the source", (type) => {
    const source = {
      ...particle(1, type),
      locked: true,
      revision: 5,
      title: "A".repeat(240),
    }
    const copy = duplicateParticle(source, () => ID(100), NOW)
    expect(particleSchema.safeParse(copy).success).toBe(true)
    expect(copy).toMatchObject({
      id: ID(100),
      revision: 0,
      locked: false,
      canvasHidden: false,
      positionMode: "manual",
    })
    expect(copy.title).toHaveLength(240)
    expect(copy.position).toEqual({
      x: source.position.x + 40,
      y: source.position.y + 40,
    })
    expect(copy.data).not.toBe(source.data)
    expect(source).toMatchObject({ id: ID(1), locked: true, revision: 5 })
  })

  it("gives nested checklist copies fresh identities while preserving external references", () => {
    const source = particle(1, "workflow")
    if (source.type !== "workflow") throw new Error("Fixture type")
    source.data.steps = [
      {
        id: ID(10),
        title: "Self",
        status: "backlog",
        order: 0,
        particleId: source.id,
      },
      {
        id: ID(11),
        title: "External",
        status: "done",
        order: 1,
        particleId: ID(2),
      },
    ]
    let id = 100
    const copy = duplicateParticle(source, () => ID(id++), NOW)
    if (copy.type !== "workflow") throw new Error("Copy type")
    expect(copy.data.steps.map((step) => step.id)).toEqual([ID(101), ID(102)])
    expect(copy.data.steps.map((step) => step.particleId)).toEqual([
      ID(100),
      ID(2),
    ])
    expect(source.data.steps[0].id).toBe(ID(10))
  })

  it("preserves connections during removal-to-library and restores visibility with Undo", async () => {
    const before = graph([particle(1), particle(2)], [edge(50, 1, 2)])
    const operation = particleCardOperation(
      before.particles[0],
      "remove",
      () => ID(100),
      NOW
    )!
    const saved = await applyParticleBatch(before, batch(100, [operation]), NOW)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.value.graph.particles[0].canvasHidden).toBe(true)
    expect(saved.value.graph.connections).toEqual(before.connections)
    const restored = await applyParticleBatch(
      saved.value.graph,
      batch(101, saved.value.inverse, saved.value.graph.revision),
      NOW
    )
    expect(restored.ok).toBe(true)
    if (restored.ok)
      expect(restored.value.graph.particles[0].canvasHidden).not.toBe(true)
  })

  it("persists sizes, restores type defaults, and prevents resizing locked cards", async () => {
    const source = particle(1, "calendar")
    const operation = particleCardOperation(
      source,
      "size_wide",
      () => ID(100),
      NOW
    )!
    const saved = await applyParticleBatch(
      graph([source]),
      batch(100, [operation]),
      NOW
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const resized = saved.value.graph.particles[0]
    expect(resized.width).toBe(440)
    const reset = particleCardOperation(
      resized,
      "size_default",
      () => ID(100),
      NOW
    )
    expect(
      reset?.kind === "put_particle" && reset.particle.width
    ).toBeUndefined()
    expect(
      particleCardOperation(
        { ...source, locked: true },
        "size_compact",
        () => ID(100),
        NOW
      )
    ).toBeNull()
  })

  it("leaves only one canvas chrome button and no chrome in library previews", () => {
    const data = {
      particle: particle(1, "objective"),
      editable: true,
      onOpen: vi.fn(),
      onEdit: vi.fn(),
      onAction: vi.fn(async () => true),
    }
    const canvas = renderToStaticMarkup(createElement(ParticleCard, { data }))
    expect(canvas.match(/<button\b/g)).toHaveLength(1)
    expect(canvas).toContain(`aria-label="Actions for ${data.particle.title}"`)
    expect(canvas).not.toContain("Open objective")
    expect(canvas).not.toContain("RemoveControl")
    expect(
      renderToStaticMarkup(
        createElement(ParticleCard, { data, controls: false })
      )
    ).not.toContain("Actions for")
  })

  it.each(["dirty", "layout", "read-only"])(
    "blocks mutation while %s",
    async (mode) => {
      const transport = vi.fn<ParticleTransport>()
      const flush = vi.fn(async () => true)
      let run: ReturnType<typeof useParticleCardActions> | undefined
      function Harness() {
        const session = useParticleSession({
          workspaceId: WORKSPACE,
          stored: graph(),
          canEdit: mode !== "read-only",
          transport,
          load: async () => ({ ok: true, value: graph() }),
        })
        run = useParticleCardActions({
          session,
          flush,
          dirty: { current: mode === "dirty" },
          blocked: mode === "layout",
        })
        return null
      }
      renderToStaticMarkup(createElement(Harness))
      if (!run) throw new Error("Not mounted")
      expect(await run(ID(1), "duplicate")).toBe(false)
      expect(transport).not.toHaveBeenCalled()
      expect(flush).not.toHaveBeenCalled()
    }
  )

  it("flushes positions before a single duplicate operation and keeps it undoable", async () => {
    let persisted = graph([particle(1), particle(2)], [edge(50, 1, 2)])
    const transport = vi.fn<ParticleTransport>(async (request) => {
      const applied = await applyParticleBatch(persisted, request, NOW)
      if (applied.ok) persisted = applied.value.graph
      return applied
    })
    let run: ReturnType<typeof useParticleCardActions> | undefined
    let session: ReturnType<typeof useParticleSession> | undefined
    const flush = vi.fn(async () => true)
    function Harness() {
      session = useParticleSession({
        workspaceId: WORKSPACE,
        stored: persisted,
        canEdit: true,
        transport,
        load: async () => ({ ok: true, value: persisted }),
      })
      run = useParticleCardActions({
        session,
        flush,
        dirty: { current: false },
        blocked: false,
      })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    if (!run || !session) throw new Error("Not mounted")
    const first = run(ID(1), "duplicate")
    expect(await run(ID(1), "duplicate")).toBe(false)
    expect(await first).toBe(true)
    expect(flush).toHaveBeenCalledOnce()
    expect(persisted.particles).toHaveLength(3)
    expect(persisted.connections).toHaveLength(1)
    expect(await session.travel("undo")).toBe(true)
    expect(persisted.particles).toHaveLength(2)
    expect(await session.travel("redo")).toBe(true)
    expect(persisted.particles).toHaveLength(3)
  })
})
