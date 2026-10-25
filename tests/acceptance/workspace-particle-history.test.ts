import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  useParticleSession,
  type ParticleTransport,
} from "@/features/workspace-particles/hooks/use-particle-session"
import { ParticleHistoryActions } from "@/features/workspace-particles/components/particle-history-actions"
import { useParticleHistoryControls } from "@/features/workspace-particles/hooks/use-particle-history-controls"
import {
  createParticleHistory,
  particleHistoryShortcut,
} from "@/features/workspace-particles/lib/particle-history"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import type {
  ParticleBatch,
  ParticleGraph,
  ParticleOperation,
} from "@/features/workspace-particles/types"
import {
  graph,
  particle,
  edge,
  batch,
  ID,
  NOW,
  WORKSPACE,
} from "./fixtures/particle-fixtures"

function harness(initial = graph()) {
  let current = initial
  let id = 100
  const history = createParticleHistory(WORKSPACE)
  history.observe(current)
  const apply = async (request: ParticleBatch, direction?: "undo" | "redo") => {
    const result = await applyParticleBatch(current, request, NOW)
    if (!result.ok) throw new Error(result.error)
    current = result.value.graph
    history.committed(request, result.value, direction)
  }
  return {
    history,
    graph: () => current,
    state: () => history.snapshot(current),
    async commit(operations: ParticleOperation[]) {
      await apply({
        ...batch(++id, operations, current.revision),
        requireExactRevision: true,
      })
    },
    async travel(direction: "undo" | "redo") {
      const request = history.prepare(direction, current, ID(++id))
      if (!request) return false
      expect(request.requireExactRevision).toBe(true)
      await apply(request, direction)
      return true
    },
    external(next: ParticleGraph) {
      current = next
      history.observe(next)
    },
  }
}

describe("confirmed Particle history", () => {
  it("undoes and redoes multiple edits to the same record with fresh revision preconditions", async () => {
    const h = harness()
    const title = h.graph().particles[0].title
    for (const value of ["First", "Second", "Third"]) {
      const item = h.graph().particles[0]
      await h.commit([
        {
          kind: "put_particle",
          particle: { ...item, title: value },
          expectedRevision: item.revision,
        },
      ])
    }
    for (const value of ["Second", "First", title]) {
      expect(await h.travel("undo")).toBe(true)
      expect(h.graph().particles[0].title).toBe(value)
    }
    expect(await h.travel("undo")).toBe(false)
    for (const value of ["First", "Second", "Third"]) {
      expect(await h.travel("redo")).toBe(true)
      expect(h.graph().particles[0].title).toBe(value)
    }
    expect(await h.travel("redo")).toBe(false)
  })

  it("restores group movement and layout as separate atomic steps", async () => {
    const h = harness()
    for (const mode of ["manual", "managed"] as const) {
      await h.commit([
        {
          kind: "move_particles",
          mode,
          positions: h.graph().particles.map((item) => ({
            id: item.id,
            expectedRevision: item.revision,
            position: { x: mode === "manual" ? 100 : 500, y: 20 },
          })),
        },
      ])
    }
    expect(h.state().undoLabel).toBe("layout")
    await h.travel("undo")
    expect(
      h
        .graph()
        .particles.every(
          (item) => item.position.x === 100 && item.positionMode === "manual"
        )
    ).toBe(true)
    expect(h.state().undoLabel).toBe("move")
    await h.travel("undo")
    expect(h.graph().particles.map((item) => item.position)).toEqual(
      graph().particles.map((item) => item.position)
    )
    await h.travel("redo")
    await h.travel("redo")
    expect(
      h
        .graph()
        .particles.every(
          (item) => item.position.x === 500 && item.positionMode === "managed"
        )
    ).toBe(true)
  })

  it("undoes root creation, linking and deletion, then restores them through redo", async () => {
    const h = harness(graph([]))
    await h.commit([
      {
        kind: "put_particle",
        particle: particle(1, "objective"),
        expectedRevision: null,
      },
      { kind: "set_root", id: ID(1), expectedId: null },
    ])
    await h.commit([
      { kind: "put_particle", particle: particle(2), expectedRevision: null },
      {
        kind: "put_connection",
        connection: edge(3, 1, 2),
        expectedRevision: null,
      },
    ])
    await h.commit([
      {
        kind: "remove_particle",
        id: ID(1),
        expectedRevision: h.graph().particles[0].revision,
      },
    ])
    expect(h.graph().connections).toHaveLength(0)
    await h.travel("undo")
    expect(h.graph().rootId).toBe(ID(1))
    expect(h.graph().connections).toHaveLength(1)
    await h.travel("undo")
    expect(h.graph().particles).toHaveLength(1)
    await h.travel("undo")
    expect(h.graph().particles).toHaveLength(0)
    expect(h.graph().rootId).toBeNull()
    await h.travel("redo")
    await h.travel("redo")
    expect(h.graph().connections).toHaveLength(1)
    await h.travel("redo")
    expect(h.graph().rootId).toBeNull()
    expect(h.graph().connections).toHaveLength(0)
  })

  it("clears redo after a new confirmed edit, but not after preparing an unconfirmed request", async () => {
    const h = harness()
    const item = h.graph().particles[0]
    await h.commit([
      {
        kind: "put_particle",
        particle: { ...item, title: "Edited" },
        expectedRevision: item.revision,
      },
    ])
    const before = h.state()
    h.history.prepare("undo", h.graph(), ID(800))
    expect(h.state()).toEqual(before)
    await h.travel("undo")
    expect(h.state().redoLabel).toBe("edit")
    const restored = h.graph().particles[0]
    await h.commit([
      {
        kind: "put_particle",
        particle: { ...restored, canvasHidden: true },
        expectedRevision: restored.revision,
      },
    ])
    expect(h.state().redoLabel).toBeNull()
    await h.travel("undo")
    expect(h.graph().particles[0].canvasHidden).toBeFalsy()
  })

  it("invalidates both directions on an external revision or different workspace", async () => {
    const h = harness()
    await h.commit([
      { kind: "put_particle", particle: particle(3), expectedRevision: null },
    ])
    h.external({ ...h.graph(), revision: h.graph().revision + 1 })
    expect(h.state()).toEqual({ undoLabel: null, redoLabel: null })
    await h.commit([
      { kind: "put_particle", particle: particle(4), expectedRevision: null },
    ])
    h.history.observe({ ...h.graph(), workspaceId: ID(888) })
    expect(h.state().undoLabel).toBeNull()
  })

  it("clears uncertain replay history instead of inventing an inverse", async () => {
    const h = harness()
    await h.commit([
      { kind: "put_particle", particle: particle(3), expectedRevision: null },
    ])
    const request = h.history.prepare("undo", h.graph(), ID(810))!
    const result = await applyParticleBatch(h.graph(), request, NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const replay = await applyParticleBatch(result.value.graph, request, NOW)
    expect(replay.ok).toBe(true)
    if (!replay.ok) return
    h.history.committed(request, replay.value, "undo")
    expect(h.history.snapshot(replay.value.graph)).toEqual({
      undoLabel: null,
      redoLabel: null,
    })
  })

  it("caps the reachable history at 50 confirmed changes", async () => {
    const h = harness()
    for (let index = 0; index < 55; index++) {
      const item = h.graph().particles[0]
      await h.commit([
        {
          kind: "put_particle",
          particle: { ...item, title: String(index) },
          expectedRevision: item.revision,
        },
      ])
    }
    for (let index = 0; index < 50; index++)
      expect(await h.travel("undo")).toBe(true)
    expect(await h.travel("undo")).toBe(false)
    expect(h.graph().particles[0].title).toBe("4")
  })
})

it("records session edits and retries a failed undo with the same operation identity", async () => {
  let persisted = graph()
  let fail = false
  const transport = vi.fn<ParticleTransport>(async (request) => {
    if (fail) return { ok: false, code: "unavailable", error: "Offline" }
    const applied = await applyParticleBatch(persisted, request, NOW)
    if (applied.ok) persisted = applied.value.graph
    return applied
  })
  let session: ReturnType<typeof useParticleSession> | undefined
  function SessionHarness() {
    session = useParticleSession({
      workspaceId: WORKSPACE,
      stored: persisted,
      canEdit: true,
      transport,
      load: async () => ({ ok: true, value: persisted }),
    })
    return null
  }
  renderToStaticMarkup(createElement(SessionHarness))
  if (!session) throw new Error("Session not mounted")
  const mounted = session
  expect(
    await mounted.edit({ ...persisted.particles[0], title: "Saved title" })
  ).toBe(true)
  fail = true
  expect(await mounted.travel("undo")).toBe(false)
  const failed = transport.mock.calls.at(-1)?.[0]
  expect(await mounted.travel("undo")).toBe(false)
  expect(transport).toHaveBeenCalledTimes(2)
  fail = false
  expect(await mounted.retry()).toBe(true)
  expect(transport.mock.calls.at(-1)?.[0]).toEqual(failed)
  expect(persisted.particles[0].title).not.toBe("Saved title")
  expect(await mounted.travel("redo")).toBe(true)
  expect(persisted.particles[0].title).toBe("Saved title")
})

it("labels shared history actions and disables unavailable actions", () => {
  const history = {
    busy: false,
    message: null,
    undoLabel: "move",
    redoLabel: null,
    undo: vi.fn(async () => true),
    redo: vi.fn(async () => true),
    onKeyDown: vi.fn(() => false),
  }
  const html = renderToStaticMarkup(
    createElement(ParticleHistoryActions, { history, disabled: false })
  )
  expect(html).toContain("Undo")
  expect(html).toContain("move")
  expect(html.match(/<button[^>]* disabled=""/g)).toHaveLength(1)
  const busy = renderToStaticMarkup(
    createElement(ParticleHistoryActions, {
      history: { ...history, busy: true },
      disabled: false,
    })
  )
  expect(busy.match(/<button[^>]* disabled=""/g)).toHaveLength(2)
})

it.each(["dirty", "layout", "drag", "read-only"])(
  "does not submit history changes during %s",
  async (blocked) => {
    const transport = vi.fn<ParticleTransport>()
    const flush = vi.fn(async () => blocked !== "drag")
    let undo: (() => Promise<boolean>) | undefined
    function ControlsHarness() {
      const session = useParticleSession({
        workspaceId: WORKSPACE,
        stored: graph(),
        canEdit: blocked !== "read-only",
        transport,
        load: async () => ({ ok: true, value: graph() }),
      })
      undo = useParticleHistoryControls({
        session,
        flush,
        dirty: { current: blocked === "dirty" },
        blocked: blocked === "layout",
      }).undo
      return null
    }
    renderToStaticMarkup(createElement(ControlsHarness))
    if (!undo) throw new Error("Controls not mounted")
    expect(await undo()).toBe(false)
    expect(transport).not.toHaveBeenCalled()
    expect(flush).toHaveBeenCalledTimes(blocked === "drag" ? 1 : 0)
  }
)

it("recognizes canvas undo/redo without repeats, composition or other modifier combinations", () => {
  const event = {
    key: "z",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
  }
  expect(particleHistoryShortcut(event)).toBe("undo")
  expect(
    particleHistoryShortcut({ ...event, ctrlKey: false, metaKey: true })
  ).toBe("undo")
  expect(particleHistoryShortcut({ ...event, shiftKey: true })).toBe("redo")
  expect(particleHistoryShortcut({ ...event, key: "y" })).toBe("redo")
  for (const flag of ["altKey", "repeat", "isComposing", "defaultPrevented"]) {
    expect(particleHistoryShortcut({ ...event, [flag]: true })).toBeNull()
  }
  expect(particleHistoryShortcut({ ...event, ctrlKey: false })).toBeNull()
  expect(particleHistoryShortcut({ ...event, key: "a" })).toBeNull()
})
