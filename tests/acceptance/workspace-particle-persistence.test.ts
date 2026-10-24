import { describe, expect, it } from "vitest"
import {
  applyParticleBatch,
  readParticleGraph,
  type ParticleGraph,
} from "@/features/workspace-particles"
import {
  ParticleMutationError,
  prepareAuthorizedParticleMutation,
} from "@/features/workspace-particles"
import {
  buildDefaultBoardState,
  normalizeWorkspaceBoardState,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import { commitWorkspaceBoardState } from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-write"
import { reconcileWorkspaceBoardSaveResult } from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-persistence"
import {
  batch,
  graph,
  ID,
  NOW,
  particle,
  WORKSPACE,
} from "./fixtures/particle-fixtures"

const create = batch(100, [
  { kind: "put_particle", particle: particle(3), expectedRevision: null },
])

describe("Particle persistence through existing board writer", () => {
  it("preserves the older placement/image payload without converting or overwriting it", async () => {
    const legacy = {
      version: 1,
      items: [
        {
          id: "saved-placement",
          source: { kind: "image", id: "image-id" },
          x: 12,
          y: 24,
        },
      ],
      images: [{ id: "image-id", path: "private/fixture.png" }],
      connections: [],
    }
    const persisted = normalizeWorkspaceBoardState({
      ...buildDefaultBoardState(),
      particles: legacy,
    })
    expect(persisted.particles).toEqual(legacy)
    await commitWorkspaceBoardState({
      readSnapshot: async () => ({
        snapshot: { exists: true, revision: "1", state: persisted },
      }),
      buildState: () => ({
        ...buildDefaultBoardState(),
        particles: { items: [] },
      }),
      updateParticleGraph: () => graph(),
      writeSnapshot: async (_, next) => {
        expect(next.particles).toEqual(legacy)
        expect(next.particleGraph).toEqual(graph())
        return { status: "written" }
      },
    })
  })
  it.each([
    graph(),
    { schemaVersion: 99, privateFutureData: ["preserve"] },
    { invalid: true },
    null,
  ])(
    "preserves graph JSON during normalization and ordinary board writes: %j",
    async (stored) => {
      const persisted = normalizeWorkspaceBoardState({
        ...buildDefaultBoardState(),
        particleGraph: stored,
      })
      expect(persisted.particleGraph).toEqual(stored)
      const result = await commitWorkspaceBoardState({
        readSnapshot: async () => ({
          snapshot: { exists: true, revision: "1", state: persisted },
        }),
        buildState: () => ({
          ...buildDefaultBoardState(),
          particleGraph: graph([]),
        }),
        writeSnapshot: async (_, next) => {
          expect(next.particleGraph).toEqual(stored)
          return { status: "written" }
        },
      })
      expect(result).toMatchObject({ ok: true })
    }
  )
  it("does not permit whole-board graph injection into a board without one", async () => {
    await commitWorkspaceBoardState({
      readSnapshot: async () => ({
        snapshot: { exists: false, revision: null, state: null },
      }),
      buildState: () => ({
        ...buildDefaultBoardState(),
        particleGraph: graph(),
      }),
      writeSnapshot: async (_, next) => {
        expect(next).not.toHaveProperty("particleGraph")
        return { status: "written" }
      },
    })
  })
  it("reconciles the server-owned graph after an ordinary save", () => {
    const current = buildDefaultBoardState()
    const saved = { ...current, particleGraph: graph() }
    expect(
      reconcileWorkspaceBoardSaveResult({ current, persisted: saved })
        .particleGraph
    ).toEqual(saved.particleGraph)
  })
  it("requires edit permission and rejects an explicitly different organization", async () => {
    expect(
      await prepareAuthorizedParticleMutation({
        input: create,
        workspaceId: WORKSPACE,
        canEdit: false,
        now: NOW,
      })
    ).toMatchObject({ ok: false, code: "scope" })
    expect(
      await prepareAuthorizedParticleMutation({
        input: create,
        workspaceId: ID(888),
        canEdit: true,
        now: NOW,
      })
    ).toMatchObject({ ok: false, code: "scope" })
  })
  it("fails closed on future graph versions before any write", async () => {
    const prepared = await prepareAuthorizedParticleMutation({
      input: create,
      workspaceId: WORKSPACE,
      canEdit: true,
      now: NOW,
    })
    if (!prepared.ok) throw new Error(prepared.error)
    expect(() => prepared.value({ schemaVersion: 99 })).toThrow(
      ParticleMutationError
    )
  })
  it("retries against the newest graph and keeps unrelated board content", async () => {
    let storedGraph: ParticleGraph = graph()
    let persisted = { ...buildDefaultBoardState(), particleGraph: storedGraph }
    const originalTracker = persisted.tracker
    const prepared = await prepareAuthorizedParticleMutation({
      input: create,
      workspaceId: WORKSPACE,
      canEdit: true,
      now: NOW,
    })
    if (!prepared.ok) throw new Error(prepared.error)
    let writes = 0
    const result = await commitWorkspaceBoardState({
      readSnapshot: async () => ({
        snapshot: { exists: true, revision: String(writes), state: persisted },
      }),
      buildState: (current) => current ?? buildDefaultBoardState(),
      updateParticleGraph: (stored) => prepared.value(stored).graph,
      writeSnapshot: async (_, next) => {
        if (writes++ === 0) {
          const concurrent = await applyParticleBatch(
            storedGraph,
            batch(101, [
              {
                kind: "put_particle",
                particle: { ...particle(2), title: "Concurrent edit" },
                expectedRevision: 0,
              },
            ]),
            NOW
          )
          if (!concurrent.ok) throw new Error(concurrent.error)
          storedGraph = concurrent.value.graph
          persisted = { ...persisted, particleGraph: storedGraph }
          return { status: "conflict" }
        }
        expect(next.tracker).toBe(originalTracker)
        const graphResult = readParticleGraph(next.particleGraph, WORKSPACE)
        if (!graphResult.ok) throw new Error(graphResult.error)
        expect(graphResult.value.particles.map((item) => item.title)).toEqual([
          "Objective",
          "Concurrent edit",
          "Activity",
        ])
        return { status: "written" }
      },
    })
    expect(result).toMatchObject({ ok: true })
    expect(writes).toBe(2)
  })
})
