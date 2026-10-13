import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  PARTICLE_PRESETS,
  DEFAULT_PRESET_FIELDS,
  buildParticlePreset,
  filterParticlePresets,
  particlePresetQuery,
} from "@/features/workspace-particles/lib/particle-presets"
import { calculateParticleExpression } from "@/features/workspace-particles/lib/particle-calculation"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import {
  applyParticleBatch,
  getParticleProgress,
} from "@/features/workspace-particles"
import { ParticlePresetEditor } from "@/features/workspace-particles/components/particle-preset-editor"
import { ParticlePresetGallery } from "@/features/workspace-particles/components/particle-preset-gallery"
import { ParticleWidgetPreview } from "@/features/workspace-particles/components/particle-widget-preview"
import { WORKSPACE_SURFACE_MOTION } from "@/lib/workspace-canvas/surface-motion"
import { WORKSPACE_WINDOW_MOTION } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window-motion"
import { ID, NOW, WORKSPACE, batch, graph } from "./fixtures/particle-fixtures"

function preset(id: string) {
  const result = PARTICLE_PRESETS.find((item) => item.id === id)
  if (!result) throw new Error(id)
  return result
}
const input = (id = 100) => ({
  id: ID(id),
  workspaceId: WORKSPACE,
  now: NOW,
  title: "My draft",
  description: "Working draft",
  fields: {
    ...DEFAULT_PRESET_FIELDS,
    expression: "120 / 4",
    lines: "Invite people\nBook a room",
    body: "Hello!",
  },
})

describe("Particle preset drafts", () => {
  it.each(PARTICLE_PRESETS)(
    "validates the $id preset through existing Particle contracts",
    (definition) => {
      const particle = buildParticlePreset(definition, input())
      expect(particleSchema.safeParse(particle).success).toBe(true)
      expect(particle.type).toBe(definition.type)
      expect(particle.workspaceId).toBe(WORKSPACE)
      expect(particle.title).toBe("My draft")
    }
  )
  it("exposes all eight upstream categories and all eight domain types without duplicate IDs", () => {
    expect(PARTICLE_PRESETS).toHaveLength(16)
    expect(new Set(PARTICLE_PRESETS.map((item) => item.id)).size).toBe(16)
    expect(filterParticlePresets("timer").map((item) => item.id)).toEqual([
      "timer",
    ])
    expect(filterParticlePresets("does not exist")).toEqual([])
  })
  it.each([
    ["/", ""],
    ["/commands", ""],
    ["/particles", ""],
    ["/timer", "timer"],
    ["create activity Test", null],
  ])("interprets %s as a catalog request", (text, query) => {
    expect(particlePresetQuery(text)).toBe(query)
  })
  it("saves Say hi as an unsent calendar entry and a checklist as real steps", () => {
    const message = buildParticlePreset(preset("message"), input())
    expect(message).toMatchObject({
      type: "calendar",
      data: {
        entries: [
          {
            content: "Hello!",
            status: "draft",
            publishedAt: null,
            scheduledAt: null,
          },
        ],
      },
    })
    const checklist = buildParticlePreset(preset("list"), input())
    expect(getParticleProgress(checklist)).toMatchObject({
      completed: 0,
      total: 2,
      percent: 0,
    })
  })
  it("models polls as declared outcomes without claiming public votes", () => {
    expect(buildParticlePreset(preset("poll"), input())).toMatchObject({
      type: "decision",
      data: {
        selectedOutcome: null,
        outcomes: [
          { id: "option-1", label: "Yes" },
          { id: "option-2", label: "Not yet" },
        ],
      },
    })
    expect(() =>
      buildParticlePreset(preset("poll"), {
        ...input(),
        fields: { ...input().fields, options: "Only one" },
      })
    ).toThrow()
  })
  it("validates widget inputs rather than accepting invalid live values", () => {
    for (const [id, fields] of [
      ["timer", { ...input().fields, minutes: "-1" }],
      ["split", { ...input().fields, people: "0" }],
      ["color", { ...input().fields, hex: "url(javascript:test)" }],
      ["sum", { ...input().fields, expression: "fetch('test')" }],
    ] as const)
      expect(() =>
        buildParticlePreset(preset(id), { ...input(), fields })
      ).toThrow()
  })
  it("persists a prepared draft through the existing atomic transaction with replay protection", async () => {
    const draft = buildParticlePreset(preset("timer"), input())
    const command = batch(90, [
      { kind: "put_particle", particle: draft, expectedRevision: null },
    ])
    const created = await applyParticleBatch(graph(), command, NOW)
    expect(created.ok).toBe(true)
    if (!created.ok) throw new Error(created.error)
    const saved = created.value.graph.particles.find(
      (item) => item.id === draft.id
    )
    expect(saved).toMatchObject({
      data: { widget: { kind: "timer", seconds: 1500, endsAt: null } },
    })
    const replay = await applyParticleBatch(created.value.graph, command, NOW)
    expect(
      replay.ok &&
        replay.value.graph.particles.filter((item) => item.id === draft.id)
    ).toHaveLength(1)
  })
})

describe("safe preset calculations", () => {
  it.each([
    ["2 + 3 * 4", 14],
    ["(2 + 3) * 4", 20],
    ["-5 + .5", -4.5],
    ["120 / 4", 30],
  ])("evaluates %s", (expression, expected) =>
    expect(calculateParticleExpression(expression)).toBe(expected)
  )
  it.each([
    "1 / 0",
    "process.exit()",
    "2 ** 10",
    "1..2",
    "1 2",
    "(",
    "",
    "Math.random()",
  ])("rejects %s", (expression) =>
    expect(() => calculateParticleExpression(expression)).toThrow()
  )
})

describe("preset presentation", () => {
  it("opens a draft editor with one explicit top-right add action and no save on render", () => {
    const onAdd = vi.fn(async () => true)
    const html = renderToStaticMarkup(
      createElement(ParticlePresetEditor, {
        preset: preset("timer"),
        workspaceId: WORKSPACE,
        disabled: false,
        pending: false,
        error: null,
        onRetry: () => {},
        onBack: () => {},
        onAdd,
      })
    )
    expect(html).toContain('aria-label="Add to canvas"')
    expect(html.indexOf('aria-label="Add to canvas"')).toBeLessThan(
      html.indexOf("Minutes")
    )
    expect(html).toContain("25:00")
    expect(onAdd).not.toHaveBeenCalled()
  })
  it("uses the same actual card preview for presets and keeps selection separate from placement", () => {
    const onSelect = vi.fn()
    const html = renderToStaticMarkup(
      createElement(ParticlePresetGallery, {
        query: "timer",
        workspaceId: WORKSPACE,
        disabled: false,
        onSelect,
      })
    )
    expect(html).toContain('aria-label="Configure Timer"')
    expect(html).toContain("25:00")
    expect(html).not.toContain('aria-label="Add to canvas"')
    expect(onSelect).not.toHaveBeenCalled()
  })
  it("keeps errors visible with an enabled retry action", () => {
    const html = renderToStaticMarkup(
      createElement(ParticlePresetEditor, {
        preset: preset("timer"),
        workspaceId: WORKSPACE,
        disabled: true,
        pending: false,
        error: "Save failed",
        onRetry: () => {},
        onBack: () => {},
        onAdd: async () => false,
      })
    )
    expect(html).toContain("Save failed")
    expect(html).toContain("Retry save")
  })
  it("displays persisted calculation data and shares window motion timing", () => {
    const particle = buildParticlePreset(preset("sum"), input())
    const html = renderToStaticMarkup(
      createElement(ParticleWidgetPreview, {
        particle,
        editable: false,
        onEdit: () => {},
        onOpen: () => {},
      })
    )
    expect(html).toContain("120 / 4")
    expect(html).toContain(">30<")
    expect(WORKSPACE_WINDOW_MOTION.enterOpacity).toBe(
      WORKSPACE_SURFACE_MOTION.enterOpacity
    )
  })
})
