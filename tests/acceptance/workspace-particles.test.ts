import { describe, expect, it } from "vitest"
import {
  createParticle,
  getParticleProgress,
  particleRegistry,
  particleSchema,
  readParticleGraph,
  validateParticleGraph,
  type ParticleType,
} from "@/features/workspace-particles"
import {
  edge,
  graph,
  ID,
  NOW,
  particle,
  WORKSPACE,
} from "./fixtures/particle-fixtures"

describe("Particle domain contracts", () => {
  it.each(Object.keys(particleRegistry) as ParticleType[])(
    "validates %s defaults without fabricated results",
    (type) => {
      expect(
        particleSchema.safeParse(
          createParticle(type, { id: ID(1), workspaceId: WORKSPACE, now: NOW })
        ).success
      ).toBe(true)
    }
  )
  it("rejects a mismatched payload, unknown fields, and nonfinite geometry", () => {
    const item = particle(1)
    expect(particleSchema.safeParse({ ...item, type: "finance" }).success).toBe(
      false
    )
    expect(
      particleSchema.safeParse({ ...item, execute: "arbitrary" }).success
    ).toBe(false)
    expect(
      particleSchema.safeParse({ ...item, position: { x: Infinity, y: 0 } })
        .success
    ).toBe(false)
  })
  it("requires actual publication evidence and unique nested IDs", () => {
    const item = particle(1, "calendar")
    const entry = {
      id: ID(5),
      title: "Email",
      channels: ["email"],
      contentType: "email",
      delivery: "automatic",
      scheduledAt: NOW,
      publishedAt: null,
      content: "Draft",
      cta: "",
      status: "scheduled",
      order: 0,
    }
    expect(
      particleSchema.safeParse({ ...item, data: { entries: [entry] } }).success
    ).toBe(true)
    expect(
      particleSchema.safeParse({
        ...item,
        data: { entries: [{ ...entry, status: "published" }] },
      }).success
    ).toBe(false)
    expect(
      particleSchema.safeParse({ ...item, data: { entries: [entry, entry] } })
        .success
    ).toBe(false)
  })
  it("derives progress and leaves decision criteria unchanged", () => {
    const item = particleSchema.parse({
      ...particle(1, "decision"),
      data: {
        criteria: [{ id: ID(10), title: "Venue", status: "backlog", order: 0 }],
        outcomes: [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ],
        selectedOutcome: "yes",
      },
    })
    expect(getParticleProgress(item)).toEqual({
      completed: 0,
      total: 1,
      percent: 0,
    })
    expect(getParticleProgress(particle(2))).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
    })
    expect(
      particleSchema.safeParse({
        ...item,
        data: { ...item.data, selectedOutcome: "invented" },
      }).success
    ).toBe(false)
  })
  it("rejects dangling, cross-workspace and duplicate identities", () => {
    expect(validateParticleGraph(graph(undefined, [edge(10, 1, 8)]))).toMatch(
      /missing/
    )
    expect(validateParticleGraph(graph([particle(1), particle(1)]))).toMatch(
      /unique/
    )
    expect(
      validateParticleGraph(graph([{ ...particle(1), workspaceId: ID(888) }]))
    ).toMatch(/workspace/)
  })
  it("rejects mixed hierarchy cycles but allows explicit feedback", () => {
    expect(
      validateParticleGraph(
        graph(undefined, [
          edge(10, 1, 2),
          edge(11, 2, 1, { relationship: "sequence" }),
        ])
      )
    ).toMatch(/cycle/)
    expect(
      validateParticleGraph(
        graph(undefined, [
          edge(10, 1, 2),
          edge(11, 2, 1, { relationship: "feedback" }),
        ])
      )
    ).toBeNull()
  })
  it("checks decision handle semantics and references", () => {
    const plan = graph(
      [particle(1, "decision"), particle(2)],
      [
        edge(10, 1, 2, {
          relationship: "decision_outcome",
          outcome: "yes",
          sourceHandle: "outcome:yes",
        }),
      ]
    )
    expect(validateParticleGraph(plan)).toBeNull()
    expect(
      validateParticleGraph({
        ...plan,
        connections: [{ ...plan.connections[0], outcome: "no" }],
      })
    ).toMatch(/outcome/)
    expect(
      validateParticleGraph({
        ...plan,
        connections: [{ ...plan.connections[0], relationship: "sequence" }],
      })
    ).toMatch(/outcome/)
  })
  it("fails closed for corrupt/future graphs without returning an empty replacement", () => {
    expect(readParticleGraph(undefined, WORKSPACE)).toMatchObject({
      ok: true,
      value: { particles: [] },
    })
    expect(
      readParticleGraph({ ...graph(), schemaVersion: 2 }, WORKSPACE)
    ).toMatchObject({ ok: false, code: "unsupported" })
    expect(readParticleGraph(null, WORKSPACE)).toMatchObject({ ok: false })
    expect(readParticleGraph(graph(), ID(777))).toMatchObject({
      ok: false,
      code: "scope",
    })
  })
})
