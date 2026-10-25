import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  useParticleSession,
  type ParticleTransport,
} from "@/features/workspace-particles/hooks/use-particle-session"
import { particleGraphSchema } from "@/features/workspace-particles/lib/particle-schema"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { buildParticlePreset, DEFAULT_PRESET_FIELDS, PARTICLE_PRESETS } from "@/features/workspace-particles/lib/particle-presets"
import type {
  ParticleCommit,
  ParticleResult,
} from "@/features/workspace-particles/types"
import { graph, particle, NOW, WORKSPACE } from "./fixtures/particle-fixtures"

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const observed = vi.hoisted(() => ({ updates: [] as unknown[] }))
// Observe the real hook's published state under a deferred transport. Keep the
// native React dispatcher; no production getters or test-only state are added.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()
  return {
    ...actual,
    useState(initial?: unknown) {
      const [value, setValue] = actual.useState(initial)
      return [
        value,
        (next: unknown) => {
          observed.updates.push(next)
          setValue(next)
        },
      ]
    },
  }
})
afterEach(() => {
  observed.updates.length = 0
  vi.clearAllMocks()
})
function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function projections() {
  return observed.updates.flatMap((value) => {
    const parsed = particleGraphSchema.safeParse(value)
    return parsed.success ? [parsed.data] : []
  })
}
function harness(initial = graph()) {
  const response = deferred<ParticleResult<ParticleCommit>>()
  const transport = vi.fn<ParticleTransport>(() => response.promise)
  let session: ReturnType<typeof useParticleSession> | undefined
  function Harness() {
    session = useParticleSession({
      workspaceId: WORKSPACE,
      stored: initial,
      canEdit: true,
      transport,
      load: async () => ({ ok: true, value: initial }),
    })
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  if (!session) throw new Error("Missing Particle session")
  return { session, transport, response, initial }
}

describe("optimistic Particle placement", () => {
  it("never confirms edited Notes using an older retained placement receipt", async () => {
    const f = harness()
    const preset = PARTICLE_PRESETS.find(item => item.id === "notes")
    if (!preset) throw new Error("Missing Notes preset")
    const draft = (body: string) => buildParticlePreset(preset, {
      id: particle(5).id, workspaceId: WORKSPACE, now: NOW,
      title: "Notes", description: "", fields: { ...DEFAULT_PRESET_FIELDS, body },
    })
    const original = draft("Earlier text"), edited = draft("Latest text")
    f.response.resolve({ ok: false, code: "unavailable", error: "Offline" })
    expect(await f.session.add(original.type, original.title, { x: 0, y: 0 }, original, { inspect: false })).toBe(false)
    expect(await f.session.add(edited.type, edited.title, { x: 0, y: 0 }, edited, { inspect: false })).toBe(false)
    expect(f.transport).toHaveBeenCalledOnce()
    const request = f.transport.mock.calls[0][0]
    f.transport.mockImplementationOnce(async batch => applyParticleBatch(f.initial, batch, NOW))
    expect(await f.session.retry()).toBe(true)
    expect(f.transport.mock.calls[1][0]).toEqual(request)
    expect(f.session.getCurrentGraph()?.particles.find(item => item.id === original.id)).toMatchObject({
      data: { widget: { source: { content: "Earlier text" } } },
    })
    // An existing ID is not proof that the latest local body reached the board.
    expect(await f.session.add(edited.type, edited.title, { x: 0, y: 0 }, edited)).toBe(false)
    expect(f.transport).toHaveBeenCalledTimes(2)
  })

  it("publishes the validated card before the server responds, keeping confirmed state separate", async () => {
    const { session, transport, response, initial } = harness()
    const prepared = particle(5)
    const saving = session.add(
      prepared.type,
      prepared.title,
      { x: 400, y: 120 },
      prepared,
      { inspect: false }
    )
    await expect.poll(() => transport.mock.calls.length).toBe(1)
    expect(
      projections()
        .at(-1)
        ?.particles.find((item) => item.id === prepared.id)?.position
    ).toEqual({ x: 400, y: 120 })
    expect(
      session
        .getCurrentGraph()
        ?.particles.some((item) => item.id === prepared.id)
    ).toBe(false)
    expect(await session.travel("undo")).toBe(false)
    response.resolve(
      await applyParticleBatch(initial, transport.mock.calls[0][0], NOW)
    )
    expect(await saving).toBe(true)
    expect(
      session
        .getCurrentGraph()
        ?.particles.some((item) => item.id === prepared.id)
    ).toBe(true)
    expect(observed.updates).toContain(null)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it("rolls back a rejected placement and retries the same stable batch/Particle IDs", async () => {
    const { session, transport, response, initial } = harness()
    const prepared = particle(5)
    const saving = session.add(
      prepared.type,
      prepared.title,
      { x: 400, y: 120 },
      prepared,
      { inspect: false }
    )
    await expect.poll(() => transport.mock.calls.length).toBe(1)
    const batchId = transport.mock.calls[0][0].id
    response.resolve({ ok: false, code: "unavailable", error: "Offline" })
    expect(await saving).toBe(false)
    expect(session.getCurrentGraph()).toEqual(initial)
    expect(observed.updates).toContain(null)
    expect(await session.retry()).toBe(false)
    expect(transport.mock.calls[1][0].id).toBe(batchId)
    expect(projections()).toHaveLength(2)
    expect(
      projections().map(
        (value) => value.particles.find((item) => item.id === prepared.id)?.id
      )
    ).toEqual([prepared.id, prepared.id])
    expect(session.getCurrentGraph()).toEqual(initial)
  })

  it("shows an existing library card at its dropped position without waiting for persistence", async () => {
    const hidden = { ...particle(2), canvasHidden: true }
    const { session, transport, response } = harness(
      graph([particle(1, "objective"), hidden])
    )
    const saving = session.edit(
      { ...hidden, canvasHidden: false, position: { x: 800, y: 100 } },
      { optimistic: true }
    )
    await expect.poll(() => transport.mock.calls.length).toBe(1)
    const projected = projections()
      .at(-1)
      ?.particles.find((item) => item.id === hidden.id)
    expect(projected?.canvasHidden).toBe(false)
    expect(projected?.position).toEqual({ x: 800, y: 100 })
    expect(
      session.getCurrentGraph()?.particles.find((item) => item.id === hidden.id)
        ?.canvasHidden
    ).toBe(true)
    response.resolve({
      ok: false,
      code: "conflict",
      error: "Changed elsewhere",
    })
    expect(await saving).toBe(false)
    expect(
      session.getCurrentGraph()?.particles.find((item) => item.id === hidden.id)
        ?.canvasHidden
    ).toBe(true)
  })

  it("leaves ordinary edits and history outside the placement projection", async () => {
    const { session, transport, response } = harness()
    const saving = session.edit({ ...particle(2), title: "Updated" })
    await expect.poll(() => transport.mock.calls.length).toBe(1)
    expect(projections()).toHaveLength(0)
    response.resolve({ ok: false, code: "unavailable", error: "Offline" })
    expect(await saving).toBe(false)
    expect(
      session
        .getCurrentGraph()
        ?.particles.find((item) => item.id === particle(2).id)?.title
    ).not.toBe("Updated")
  })
})
