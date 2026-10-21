import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useParticleSelection } from "@/features/workspace-particles/hooks/use-particle-selection"
import {
  createCalendarEntry,
  calendarPlanningOrder,
  calendarChronologicalOrder,
  replaceCalendarEntry,
  moveCalendarEntry,
  calendarLocalDateTime,
  calendarUtcDateTime,
  type CalendarParticle,
} from "@/features/workspace-particles/lib/particle-calendar"
import { particleCalendarEntrySchema } from "@/features/workspace-particles/lib/particle-schema"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { ParticleCalendarEditor } from "@/features/workspace-particles/components/particle-calendar-editor"
import { ParticleCalendarPreview } from "@/features/workspace-particles/components/particle-calendar-preview"
import { ParticleInspector } from "@/features/workspace-particles/components/particle-inspector"
import { ParticleCard } from "@/features/workspace-particles/components/particle-card"
import { batch, graph, particle, ID, NOW } from "./fixtures/particle-fixtures"

const clicks = vi.hoisted(() => new Map<string, () => void>())
vi.mock("@/components/ui/button", async (original) => {
  const actual = await original<typeof import("@/components/ui/button")>()
  return {
    ...actual,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      const label = props["aria-label"]
      const handler = props.onClick
      if (label && handler)
        clicks.set(label, () =>
          handler({} as Parameters<NonNullable<typeof handler>>[0])
        )
      return createElement(actual.Button, props)
    },
  }
})
beforeEach(() => clicks.clear())
afterEach(() => vi.unstubAllGlobals())

function calendar(count = 2): CalendarParticle {
  const value = particle(1, "calendar")
  if (value.type !== "calendar") throw new Error("Invalid fixture")
  return {
    ...value,
    data: {
      entries: Array.from({ length: count }, (_, index) => ({
        ...createCalendarEntry(ID(index + 10), index),
        title: `Entry ${index + 1}`,
      })),
    },
  }
}

describe("Calendar entry data", () => {
  it("creates an unsent draft with stable identity and never invents publication", () => {
    const entry = createCalendarEntry(ID(10), 0)
    expect(particleCalendarEntrySchema.safeParse(entry).success).toBe(true)
    expect(entry).toMatchObject({
      id: ID(10),
      status: "draft",
      publishedAt: null,
      scheduledAt: null,
    })
    expect(
      particleCalendarEntrySchema.safeParse({ ...entry, status: "published" })
        .success
    ).toBe(false)
    expect(
      particleCalendarEntrySchema.safeParse({
        ...entry,
        status: "published",
        publishedAt: NOW,
      }).success
    ).toBe(true)
    expect(
      particleCalendarEntrySchema.safeParse({ ...entry, channels: [] }).success
    ).toBe(false)
    expect(
      particleCalendarEntrySchema.safeParse({
        ...entry,
        externalUrl: "javascript:alert(1)",
      }).success
    ).toBe(false)
  })

  it("edits just the selected nested record without changing IDs or sibling content", () => {
    const original = calendar()
    const edited = replaceCalendarEntry(original, {
      ...original.data.entries[1],
      content: "New copy",
      channels: ["email", "linkedin"],
      activityId: ID(2),
    })
    expect(edited.data.entries[0]).toBe(original.data.entries[0])
    expect(edited.data.entries[1].id).toBe(ID(11))
    expect(edited.data.entries[1].content).toBe("New copy")
    expect(original.data.entries[1].content).toBe("")
  })

  it("keeps chronological previews distinct from editable planning order", () => {
    const original = calendar(3)
    original.data.entries[0].scheduledAt = "2026-11-02T15:00:00.000Z"
    original.data.entries[1].scheduledAt = "2026-11-01T15:00:00.000Z"
    const moved = moveCalendarEntry(original, ID(12), -1)
    expect(
      calendarPlanningOrder(moved.data.entries).map((entry) => entry.id)
    ).toEqual([ID(10), ID(12), ID(11)])
    expect(
      calendarChronologicalOrder(moved.data.entries).map((entry) => entry.id)
    ).toEqual([ID(11), ID(10), ID(12)])
    expect(original.data.entries.map((entry) => entry.order)).toEqual([0, 1, 2])
    expect(moveCalendarEntry(original, ID(10), -1)).toBe(original)
    expect(moveCalendarEntry(original, ID(999), 1)).toBe(original)
  })

  it.each(["2026-01-15T17:25:00.000Z", "2026-07-15T17:25:00.000Z"])(
    "round-trips %s through local input while storing UTC",
    (instant) => {
      expect(calendarUtcDateTime(calendarLocalDateTime(instant))).toBe(instant)
    }
  )
  it("rejects invalid dates instead of shifting the selected day", () => {
    expect(calendarUtcDateTime("")).toBeNull()
    expect(calendarUtcDateTime("not-a-date")).toBeUndefined()
    expect(calendarUtcDateTime("2026-02-30T10:00")).toBeUndefined()
    expect(calendarUtcDateTime("2026-01-10T25:00")).toBeUndefined()
  })

  it("persists entry edits and linked Activity in one existing batch and restores them with its inverse", async () => {
    const original = calendar()
    const edited = replaceCalendarEntry(original, {
      ...original.data.entries[0],
      content: "Saved copy",
      activityId: ID(2),
      scheduledAt: NOW,
      status: "scheduled",
    })
    const before = graph([original, particle(2)])
    const applied = await applyParticleBatch(
      before,
      batch(100, [
        { kind: "put_particle", particle: edited, expectedRevision: 0 },
      ]),
      NOW
    )
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const current = applied.value.graph.particles[0]
    expect(current.type === "calendar" && current.data.entries[0].content).toBe(
      "Saved copy"
    )
    expect(
      current.type === "calendar" && current.data.entries[0].publishedAt
    ).toBeNull()
    const undone = await applyParticleBatch(
      applied.value.graph,
      {
        ...batch(101, applied.value.inverse, applied.value.graph.revision),
        requireExactRevision: true,
      },
      NOW
    )
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(undone.value.graph.particles[0].data).toEqual(original.data)
  })

  it("rejects a linked record that is not an Activity", async () => {
    const original = calendar()
    const edited = replaceCalendarEntry(original, {
      ...original.data.entries[0],
      activityId: ID(2),
    })
    const result = await applyParticleBatch(
      graph([original, particle(2, "people")]),
      batch(102, [
        { kind: "put_particle", particle: edited, expectedRevision: 0 },
      ]),
      NOW
    )
    expect(result.ok).toBe(false)
  })
})

describe("Calendar presentation", () => {
  it("keeps same-calendar entry navigation within the draft and guards leaving it", () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal("window", { confirm })
    const selectParticle = vi.fn()
    let select: ReturnType<typeof useParticleSelection>["select"] | undefined
    function SelectionHarness() {
      select = useParticleSelection({
        graph: graph([calendar(), particle(2)]),
        selectedId: ID(1),
        selectParticle,
        setNodes: vi.fn(),
        dirty: { current: true },
      }).select
      return null
    }
    renderToStaticMarkup(createElement(SelectionHarness))
    if (!select) throw new Error("Selection not mounted")
    expect(select(ID(1), { calendarEntryId: ID(11) })).toBe(true)
    expect(selectParticle).toHaveBeenCalledExactlyOnceWith(ID(1))
    expect(confirm).not.toHaveBeenCalled()
    expect(select(ID(2))).toBe(false)
    expect(selectParticle).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledOnce()
  })
  it("opens the clicked entry rather than just its parent Particle", () => {
    const value = calendar()
    const onOpen = vi.fn()
    const html = renderToStaticMarkup(
      createElement(ParticleCard, {
        data: { particle: value, editable: true, onEdit: vi.fn(), onOpen },
      })
    )
    expect(html).toContain("0 published")
    clicks.get("Open Entry 2, Email, Draft")?.()
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(value.id, {
      calendarEntryId: ID(11),
    })
  })
  it("limits the preview to four chronological entries and distinguishes automatic delivery", () => {
    const value = calendar(9)
    delete value.size // Legacy cards retain their existing preview.
    value.data.entries[7].scheduledAt = NOW
    value.data.entries[7].delivery = "automatic"
    const html = renderToStaticMarkup(
      createElement(ParticleCalendarPreview, {
        particle: value,
        editable: true,
        onEdit: vi.fn(),
        onOpen: vi.fn(),
      })
    )
    expect(html.indexOf("Entry 8")).toBeLessThan(html.indexOf("Entry 1"))
    expect(clicks.size).toBe(4)
    expect(html).toContain("Auto")
    expect(html).toContain("5 more entries")
  })
  it("shows the requested entry fields inside the existing inspector", () => {
    const value = calendar()
    value.data.entries[1].content = "Specific entry draft"
    const html = renderToStaticMarkup(
      createElement(ParticleInspector, {
        particle: value,
        editable: true,
        pending: false,
        onSave: vi.fn(async () => true),
        onClose: vi.fn(),
        onDirtyChange: vi.fn(),
        calendarEntryRequest: { id: ID(11), key: 1 },
        activities: [{ id: ID(2), title: "Community dinner" }],
      })
    )
    expect(html).toContain("Specific entry draft")
    for (const label of [
      "Entry title",
      "Channels",
      "Content type",
      "Delivery",
      "Entry status",
      "Linked Activity",
      "Scheduled for",
      "Call to action",
      "External URL",
      "Save changes",
    ])
      expect(html).toContain(label)
    expect(html).toContain("Saving entries does not send or publish content")
  })
  it("paginates long lists and keeps read-only mutation controls disabled", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleCalendarEditor, {
        particle: calendar(20),
        disabled: true,
        onChange: vi.fn(),
      })
    )
    expect(html).toContain("Page 1 of 3")
    expect(html).toContain("Entry 8")
    expect(html).not.toContain("Entry 9")
    expect(
      html.match(
        /<button[^>]* disabled=""[^>]*>[^<]*<svg[^>]*[\s\S]*?Add entry/
      )?.[0]
    ).toBeTruthy()
  })
})
