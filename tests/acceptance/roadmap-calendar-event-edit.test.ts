import React, { type ChangeEvent, type ComponentProps, type ReactNode, type SetStateAction } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RoadmapCalendarEventDrawer } from "@/components/roadmap/roadmap-calendar/components/roadmap-calendar-event-drawer"
import type { EventDraft } from "@/components/roadmap/roadmap-calendar/types"

const { changes } = vi.hoisted(() => ({
  changes: new Map<string, (value: string) => void>(),
}))

function dispatchChange<T extends Element>(change: (event: ChangeEvent<T>) => void, value: string) {
  const event = { currentTarget: { value } } as unknown as ChangeEvent<T>
  change(event)
  // React clears currentTarget after dispatch, before a queued/replayed update.
  Object.defineProperty(event, "currentTarget", { value: null })
}

// Capture the real editor's change handlers without requiring a browser/portal.
vi.mock("@/components/ui/input", () => ({
  Input: ({ id, onChange }: ComponentProps<"input">) => {
    if (id && onChange) changes.set(id, (value) => dispatchChange(onChange, value))
    return null
  },
}))
vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({ id, onChange }: ComponentProps<"textarea">) => {
    if (id && onChange) changes.set(id, (value) => dispatchChange(onChange, value))
    return null
  },
}))
vi.mock("@/components/ui/drawer", () => {
  const Container = ({ children }: { children?: ReactNode }) => children
  return Object.fromEntries([
    "Drawer", "DrawerContent", "DrawerDescription", "DrawerFooter",
    "DrawerHeader", "DrawerTitle",
  ].map((name) => [name, Container]))
})

function draft(): EventDraft {
  return {
    title: "Board meeting", description: "Review agenda", eventType: "meeting",
    startsAt: "2026-10-19T09:00", endsAt: "2026-10-19T10:00", allDay: false,
    status: "active", assignedRoles: ["admin"],
    recurrence: { frequency: "weekly", endDate: "2026-11-30" },
  }
}

function queueChange(id: string, value: string) {
  const updates: SetStateAction<EventDraft>[] = []
  renderToStaticMarkup(React.createElement(RoadmapCalendarEventDrawer, {
    open: true, onOpenChange: () => {}, editingEvent: null, draft: draft(),
    setDraft: (update) => { updates.push(update) }, isPending: false,
    onDelete: () => {}, onSave: () => {},
  }))
  const change = changes.get(id)
  if (!change) throw new Error("Missing editor field: " + id)
  change(value)
  expect(updates).toHaveLength(1)
  return (previous: EventDraft) => updates.reduce<EventDraft>(
    (state, update) => typeof update === "function" ? update(state) : update,
    previous,
  )
}

describe("roadmap event editor change event lifetime", () => {
  beforeEach(() => changes.clear())

  it.each([
    ["calendar-title", "title", "Updated meeting"],
    ["calendar-description", "description", "Updated agenda"],
    ["calendar-start", "startsAt", "2026-10-20T09:00"],
    ["calendar-end", "endsAt", "2026-10-20T10:00"],
  ] as const)("retains %s after dispatch and preserves newer draft changes", (id, field, value) => {
    const apply = queueChange(id, value)
    const previous = { ...draft(), allDay: true }
    expect(apply(previous)).toEqual({ ...previous, [field]: value })
    // React may replay an updater; it must not depend on a live event object.
    expect(apply(previous)).toEqual({ ...previous, [field]: value })
  })

  it.each(["2026-12-31", ""])("retains recurrence end date %j after dispatch", (value) => {
    const apply = queueChange("calendar-recurrence-end", value)
    const previous = { ...draft(), recurrence: { frequency: "weekly" as const, interval: 2 } }
    expect(apply(previous).recurrence).toEqual({
      ...previous.recurrence, endDate: value || null,
    })
  })

  it("does not restore recurrence if it was cleared before the update runs", () => {
    const apply = queueChange("calendar-recurrence-end", "2026-12-31")
    expect(apply({ ...draft(), recurrence: null }).recurrence).toBeNull()
  })
})
