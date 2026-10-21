import { particleComposerSearchQuery, parseParticleCreateCommand } from "@/features/workspace-particles/lib/particle-command"
import {
  changeTimer,
  timerRemaining,
  type TimerWidget,
} from "@/features/workspace-particles/lib/particle-timer"
import { ParticleWidgetFields } from "@/features/workspace-particles/components/particle-widget-fields"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  PARTICLE_PRESETS,
  DEFAULT_PRESET_FIELDS,
  buildParticlePreset,
  filterParticlePresets,
  particlePresetQuery,
  type ParticlePreset,
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
import { useParticlePresetPlacement } from "@/features/workspace-particles/hooks/use-particle-preset-placement"
import { EMPTY_EVENT_DRAFT, eventDraftInput, eventDraftError, particleCreationContentDiffers } from "@/features/workspace-particles/lib/particle-event"
import { ParticleEventCard } from "@/features/workspace-particles/components/particle-event-card"
import { WORKSPACE_SURFACE_MOTION } from "@/lib/workspace-canvas/surface-motion"
import { WORKSPACE_WINDOW_MOTION } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window-motion"
import { ID, NOW, WORKSPACE, batch, graph } from "./fixtures/particle-fixtures"

function preset(id: string) {
  // Legacy fixtures stay readable/editable after their creation entries retire.
  const legacy: ParticlePreset[] = [
    { id: "timer", label: "Timer", hint: "", type: "activity", fields: [{ key: "minutes", label: "Minutes", input: "number" }] },
    { id: "split", label: "Split a bill", hint: "", type: "activity", fields: [] },
    { id: "sum", label: "Calculate", hint: "", type: "activity", fields: [] },
    { id: "list", label: "Checklist", hint: "", type: "workflow", fields: [] },
    { id: "message", label: "Say hi", hint: "", type: "calendar", fields: [] },
    { id: "color", label: "Color", hint: "", type: "activity", fields: [] },
  ]
  const result = [...PARTICLE_PRESETS, ...legacy].find((item) => item.id === id)
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
  it("exposes the reduced catalog without duplicate IDs", () => {
    expect(PARTICLE_PRESETS).toHaveLength(12)
    expect(new Set(PARTICLE_PRESETS.map((item) => item.id)).size).toBe(12)
    expect(filterParticlePresets("does not exist")).toEqual([])
  })
  it.each(["timer", "workflow", "split", "sum", "list", "message", "color"])(
    "removes %s from creation, search and explicit commands",
    (id) => {
      expect(PARTICLE_PRESETS.some((preset) => preset.id === id)).toBe(false)
      expect(filterParticlePresets(id).some((preset) => preset.id === id)).toBe(false)
      expect(parseParticleCreateCommand(`create ${id} Test`).ok).toBe(false)
    }
  )
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
  it("renders an interactive Event card with one Add action and no covering Configure overlay", () => {
    const onAdd = vi.fn(async () => true), onSelect = vi.fn()
    const html = renderToStaticMarkup(createElement(ParticlePresetGallery, {
      query: "event", workspaceId: WORKSPACE, disabled: false, onAdd, onSelect,
    }))
    for (const label of ["Event title", "Event date", "Event time", "Event place", "Event attendees"])
      expect(html).toContain(`aria-label="${label}"`)
    expect(html.match(/aria-label="Add event to canvas and calendar"/g)).toHaveLength(1)
    expect(html).not.toContain('aria-label="Configure Event"')
    expect(html).not.toContain('aria-label="Add Event to canvas"')
    expect(html).toContain("to clear")
    expect(onAdd).not.toHaveBeenCalled(); expect(onSelect).not.toHaveBeenCalled()
  })

  it("uses the same Event card to display entered details without an Add action on the canvas", () => {
    const html = renderToStaticMarkup(createElement(ParticleEventCard, {
      title: "Dinner", event: { kind: "event", startsAt: "2026-10-16T20:00:00Z", location: "Community table", attendees: ["Priya"] },
    }))
    expect(html).toContain("Dinner"); expect(html).toContain("Community table"); expect(html).toContain("Priya")
    expect(html).not.toContain('aria-label="Add event to canvas and calendar"')
    expect(html).not.toContain('<input')
  })

  it("carries explicit Event title, local time, place and names through both placement paths", async () => {
    const draft = { ...EMPTY_EVENT_DRAFT, title: " Dinner ", date: "2026-10-16", time: "20:00", location: "Community table", guests: "Priya, Sam, Priya" }
    const parsed = eventDraftInput(draft)
    let placement: ReturnType<typeof useParticlePresetPlacement> | undefined
    const onAdd = vi.fn(async () => true)
    function Harness() { placement = useParticlePresetPlacement(WORKSPACE, onAdd); return null }
    renderToStaticMarkup(createElement(Harness))
    const dragged = placement!.prepare(preset("event"), parsed.fields, parsed.title)
    expect(dragged).toMatchObject({ title: "Dinner", size: "large", data: { widget: {
      kind: "event", startsAt: new Date("2026-10-16T20:00").toISOString(), location: "Community table", attendees: ["Priya", "Sam"],
    } } })
    await placement!.add(preset("event"), parsed.fields, parsed.title)
    expect(onAdd).toHaveBeenCalledWith(dragged)
  })

  it("validates incomplete/invalid Event dates without pretending to parse natural-language titles", () => {
    expect(eventDraftError(EMPTY_EVENT_DRAFT)).toContain("title")
    expect(eventDraftError({ ...EMPTY_EVENT_DRAFT, title: "Dinner Friday 8pm", date: "2026-10-16" })).toContain("date and time")
    expect(eventDraftError({ ...EMPTY_EVENT_DRAFT, title: "Dinner", date: "2026-02-30", time: "20:00" })).toContain("unavailable")
    expect(eventDraftError({ ...EMPTY_EVENT_DRAFT, title: "Dinner Friday 8pm" })).toContain("calendar")
    expect(eventDraftError({ ...EMPTY_EVENT_DRAFT, title: "Dinner", date: "2026-10-16", time: "20:00", guests: Array.from({ length: 51 }, (_, n) => `Person ${n}`).join(",") })).toContain("50")
  })

  it("disables Event fields when the library is read only", () => {
    const html = renderToStaticMarkup(createElement(ParticlePresetGallery, {
      query: "event", workspaceId: WORKSPACE, disabled: true, onSelect: vi.fn(), onAdd: vi.fn(async () => true),
    }))
    for (const input of html.matchAll(/<input\b[^>]*>/g)) expect(input[0]).toContain('disabled=""')
  })

  it("requires valid inline Event draft data before placing", () => {
    const html = renderToStaticMarkup(createElement(ParticlePresetGallery, {
      query: "event", workspaceId: WORKSPACE, disabled: false, onSelect: vi.fn(), onAdd: vi.fn(async () => true),
    }))
    expect([...html.matchAll(/<button\b[^>]*>/g)].find(match => match[0].includes('aria-label="Add event to canvas and calendar"'))?.[0]).toContain('disabled=""')
    expect(html).not.toContain('aria-label="Configure Event"')
    expect(html).toContain('data-draggable="false"')
  })

  it("does not treat an older Event receipt as confirmation of changed title/place/people", () => {
    const a = buildParticlePreset(preset("event"), { ...input(), title: "Dinner", fields: { ...DEFAULT_PRESET_FIELDS, location: "Table A", guests: "Priya" } })
    expect(particleCreationContentDiffers(a, a)).toBe(false)
    for (const change of [{ location: "Table B" }, { guests: "Sam" }, { when: "2026-10-16T20:00" }]) {
      const b = buildParticlePreset(preset("event"), { ...input(), title: "Dinner", fields: { ...DEFAULT_PRESET_FIELDS, location: "Table A", guests: "Priya", ...change } })
      expect(particleCreationContentDiffers(b, a)).toBe(true)
    }
    expect(particleCreationContentDiffers({ ...a, title: "Lunch" }, a)).toBe(true)
  })

  it("exposes an inline Notes draft without the configure-card overlay or adding on render", () => {
    const onSelect = vi.fn(), onAdd = vi.fn(async () => true)
    const html = renderToStaticMarkup(createElement(ParticlePresetGallery, {
      query: "notes", workspaceId: WORKSPACE, disabled: false, onSelect, onAdd,
    }))
    expect(html).toContain('<textarea')
    expect(html).toContain('aria-label="Draft notes"')
    expect(html).toContain('placeholder="Write a note…"')
    expect(html).toMatch(/maxlength="20000"/i)
    expect(html).not.toContain('aria-label="Configure Notes"')
    expect(html).not.toContain('aria-label="Open Notes"')
    expect(onSelect).not.toHaveBeenCalled(); expect(onAdd).not.toHaveBeenCalled()
  })

  it("keeps inline notes disabled when the library is read only", () => {
    const html = renderToStaticMarkup(createElement(ParticlePresetGallery, {
      query: "notes", workspaceId: WORKSPACE, disabled: true, onSelect: vi.fn(),
    }))
    expect(html.match(/<textarea\b[^>]*>/)?.[0]).toContain('disabled=""')
  })

  it("carries the latest multiline note into drag preparation and Add without changing retry identity", async () => {
    let placement: ReturnType<typeof useParticlePresetPlacement> | undefined
    const onAdd = vi.fn(async () => true)
    function Harness() { placement = useParticlePresetPlacement(WORKSPACE, onAdd); return null }
    renderToStaticMarkup(createElement(Harness))
    const initial = placement!.prepare(preset("notes"), { body: "First draft" })
    const body = "Meeting notes\n\nKeep leading zeros: 001 — café"
    const dragged = placement!.prepare(preset("notes"), { body })
    expect(dragged.id).toBe(initial.id)
    expect(dragged).toMatchObject({ data: { widget: { kind: "notes", source: { kind: "workspace", content: body } } } })
    await placement!.add(preset("notes"), { body })
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: dragged.id, data: expect.objectContaining({ widget: expect.objectContaining({ source: { kind: "workspace", content: body } }) }) }))
  })

  it("retains typed note content and identity after a failed Add", async () => {
    let placement: ReturnType<typeof useParticlePresetPlacement> | undefined
    const onAdd = vi.fn(async () => false)
    function Harness() { placement = useParticlePresetPlacement(WORKSPACE, onAdd); return null }
    renderToStaticMarkup(createElement(Harness))
    await placement!.add(preset("notes"), { body: "Keep this draft" })
    await placement!.add(preset("notes"), { body: "Keep this draft" })
    expect(onAdd.mock.calls[0]).toEqual(onAdd.mock.calls[1])
  })

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
        query: "poll",
        workspaceId: WORKSPACE,
        disabled: false,
        onSelect,
      })
    )
    expect(html).toContain('aria-label="Configure Poll"')
    expect(html).toContain('data-particle-frame="true"')
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

describe("usable preset controls", () => {
  it("pauses and resumes against wall clock time without losing remaining seconds", () => {
    const initial: TimerWidget = { kind: "timer", seconds: 90, endsAt: null }
    const running = changeTimer(initial, "start", 1000)
    const paused = changeTimer(running, "pause", 11000)
    expect(timerRemaining(paused, 900000)).toBe(80)
    const resumed = changeTimer(paused, "start", 20000)
    expect(timerRemaining(resumed, 35000)).toBe(65)
    expect(timerRemaining(resumed, 200000)).toBe(0)
    expect(changeTimer(resumed, "reset", 200000)).toMatchObject({
      seconds: 90,
      remainingSeconds: 90,
      endsAt: null,
    })
  })
  it("persists a paused timer through the existing schema", () => {
    const timer = buildParticlePreset(preset("timer"), input())
    if (timer.type !== "activity" || timer.data.widget?.kind !== "timer")
      throw new Error("Expected timer")
    const widget = changeTimer(
      changeTimer(timer.data.widget, "start", 0),
      "pause",
      10000
    )
    const restored = particleSchema.parse({
      ...timer,
      data: { ...timer.data, widget },
    })
    expect(restored).toMatchObject({
      data: { widget: { remainingSeconds: 1490, endsAt: null } },
    })
  })
  it("does not submit the add form when using the timer preview", () => {
    const html = renderToStaticMarkup(
      createElement(ParticlePresetEditor, {
        preset: preset("timer"),
        workspaceId: WORKSPACE,
        disabled: false,
        pending: false,
        error: null,
        onRetry: vi.fn(),
        onBack: vi.fn(),
        onAdd: vi.fn(),
      })
    )
    expect(html).not.toContain('inert=""')
    expect(html).not.toContain('pointer-events-none"')
    const buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(
      (match) => match[1]
    )
    expect(
      buttons.filter((attrs) => attrs.includes('type="submit"'))
    ).toHaveLength(1)
    expect(
      buttons.find((attrs) => attrs.includes('aria-label="Reset timer"'))
    ).toContain('type="button"')
    expect(html).toContain('viewBox="0 0 18 18"')
  })
  it.each(["timer", "split", "color", "sum", "event"])(
    "exposes configuration for placed %s widgets",
    (id) => {
      const particle = buildParticlePreset(preset(id), input())
      const html = renderToStaticMarkup(
        createElement(ParticleWidgetFields, {
          particle,
          disabled: false,
          onChange: vi.fn(),
        })
      )
      expect(html).toContain("<input")
      expect(html).toContain("<label")
    }
  )
  it("rejects invalid expressions and stale calculated results", () => {
    const sum = buildParticlePreset(preset("sum"), input())
    if (sum.type !== "activity" || sum.data.widget?.kind !== "calculate")
      throw new Error("Expected calculation")
    expect(
      particleSchema.safeParse({
        ...sum,
        data: {
          ...sum.data,
          widget: { ...sum.data.widget, expression: "1 / 0" },
        },
      }).success
    ).toBe(false)
    expect(
      particleSchema.safeParse({
        ...sum,
        data: { ...sum.data, widget: { ...sum.data.widget, result: 999 } },
      }).success
    ).toBe(false)
  })
})

describe("dock Particle search", () => {
  it.each([
    ["timer", "timer"],
    ["  fiscal sponsorship  ", "fiscal sponsorship"],
    ["/timer", "timer"],
    ["/commands", ""],
    ["", ""],
    ["create activity Meet donors", null],
    ["create unknown", null],
  ])(
    "routes %s without accidentally creating a Particle",
    (input, expected) => {
      expect(particleComposerSearchQuery(input!)).toBe(expected)
    }
  )
})

it("offers a header plus without a status badge or automatic creation", () => {
  const onAdd = vi.fn(async () => true)
  const html = renderToStaticMarkup(
    createElement(ParticlePresetGallery, {
      query: "notes",
      workspaceId: WORKSPACE,
      disabled: false,
      onSelect: vi.fn(),
      onAdd,
    })
  )
  expect(html).toContain('aria-label="Add Notes to canvas"')
  expect(html).not.toContain("Backlog")
  expect(html).not.toContain('data-react-grab-owner-slot="type"')
  expect(onAdd).not.toHaveBeenCalled()
  expect(html.match(/data-particle-frame="true"/g)).toHaveLength(1)
  expect(html.match(/data-particle-stack-back/g)).toHaveLength(2)
})
