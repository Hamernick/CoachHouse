import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  layoutNetworkRings,
  moveNetworkMembership,
  networkRings,
  NETWORK_UNGROUPED,
} from "@/features/workspace-people-network/lib"
import {
  WorkspacePeopleNetworkPanel,
  WorkspacePeopleNetworkSplit,
} from "@/features/workspace-people-network/client"
import type { WorkspacePeopleNetworkProps } from "@/features/workspace-people-network/types"

const groups = [
  { id: "a", label: "Partners", memberIds: ["p1", "p2", "missing"] },
  { id: "b", label: "Volunteers", memberIds: ["p2"] },
  { id: "c", label: "Advisors", memberIds: ["p3"] },
]

describe("People network", () => {
  it("uses saved memberships, keeps overlaps, excludes missing and filtered people", () => {
    const rings = networkRings(groups, ["p2", "p3", "p4"], 0)
    expect(rings.map((ring) => ring.memberIds)).toEqual([
      ["p2"],
      ["p2"],
      ["p4"],
    ])
    expect(rings.at(-1)?.id).toBe(NETWORK_UNGROUPED)
    expect(networkRings(groups, ["p1", "p2", "p3", "p4"], 99)[0].id).toBe("c")
  })

  it("pages one saved group at a time on compact layouts", () => {
    expect(networkRings(groups, ["p1", "p2", "p3"], 1, 1)[0].id).toBe("b")
    expect(networkRings(groups, ["p1", "p2", "p3"], 2, 1)[0].id).toBe("c")
  })

  it("shows ungrouped contacts even without saved groups", () => {
    expect(networkRings([], ["p1", "p1"], 0)).toEqual([
      { id: NETWORK_UNGROUPED, label: "Ungrouped", memberIds: ["p1"] },
    ])
  })

  it("keeps touch targets apart and provides all overflow contacts at narrow widths", () => {
    const dense = Array.from({ length: 100 }, (_, index) => `p${index}`)
    for (const size of [240, 320, 360]) {
      const layout = layoutNetworkRings(
        [0, 1, 2].map((n) => ({
          id: String(n),
          label: String(n),
          memberIds: dense,
        })),
        size
      )
      const points = layout.flatMap((ring) => ring.points)
      for (const [index, point] of points.entries()) {
        expect(point.x).toBeGreaterThanOrEqual(22)
        expect(point.x).toBeLessThanOrEqual(size - 22)
        expect(point.y).toBeGreaterThanOrEqual(22)
        expect(point.y).toBeLessThanOrEqual(size - 22)
        for (const ring of layout)
          expect(
            Math.abs(point.x - size / 2) >= 86 ||
              Math.abs(point.y - size / 2 - ring.radius) >= 44
          ).toBe(true)
        for (const other of points.slice(index + 1))
          expect(
            Math.hypot(point.x - other.x, point.y - other.y)
          ).toBeGreaterThanOrEqual(48)
      }
      for (const ring of layout)
        expect([...ring.visibleIds, ...ring.hiddenIds]).toEqual(dense)
    }
  })

  it("confirms destination before removing source", async () => {
    const calls: string[] = []
    const result = await moveNetworkMembership(
      { mode: "segments", personId: "p1", from: "a", to: "b" },
      {
        add: async (id, person) => {
          calls.push(`add:${id}:${person}`)
          return true
        },
        remove: async (id, person) => {
          calls.push(`remove:${id}:${person}`)
          return true
        },
      }
    )
    expect(result).toEqual({ ok: true })
    expect(calls).toEqual(["add:b:p1", "remove:a:p1"])
  })

  it("never removes the source when adding fails", async () => {
    const remove = vi.fn()
    const result = await moveNetworkMembership(
      { mode: "tags", personId: "p1", from: "a", to: "b" },
      { add: async () => false, remove }
    )
    expect(result.ok).toBe(false)
    expect(remove).not.toHaveBeenCalled()
  })

  it("reports partial failure honestly without undoing a confirmed membership", async () => {
    const result = await moveNetworkMembership(
      { mode: "tags", personId: "p1", from: "a", to: "b" },
      { add: async () => true, remove: async () => false }
    )
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining("Both memberships remain"),
    })
  })

  it("supports adding ungrouped contacts and removing only the source", async () => {
    const add = vi.fn(async () => true),
      remove = vi.fn(async () => true)
    await moveNetworkMembership(
      { mode: "segments", personId: "p1", from: null, to: "b" },
      { add, remove }
    )
    expect(remove).not.toHaveBeenCalled()
    await moveNetworkMembership(
      { mode: "segments", personId: "p1", from: "a", to: null },
      { add, remove }
    )
    expect(add).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledExactlyOnceWith("a", "p1")
    await moveNetworkMembership(
      { mode: "segments", personId: "p1", from: "b", to: "b" },
      { add, remove }
    )
    expect(remove).toHaveBeenCalledTimes(1)
  })

  const props: WorkspacePeopleNetworkProps = {
    people: [{ id: "p1", name: "Alex Example", category: "staff" }],
    segments: groups,
    tags: [],
    canEdit: false,
    placedPersonIds: new Set(),
    onEdit() {},
    onMove: async () => ({ ok: true }),
    onDragStart() {},
    onDragEnd() {},
    readDragPeople: () => [],
    hasDragPeople: () => false,
    onAddToCanvas: () => 0,
  }
  it("renders labeled contacts, grouping controls, and group pagination above the table", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspacePeopleNetworkPanel, props)
    )
    expect(html).toContain('aria-label="People network"')
    expect(html).toContain('aria-label="Open Alex Example"')
    expect(html).toContain('aria-label="Network grouping"')
    expect(html).toContain('aria-label="Next network groups"')
    expect(html).toContain('draggable="true"')
  })

  it("renders an accessible loading state and an honest empty state", () => {
    expect(
      renderToStaticMarkup(
        createElement(WorkspacePeopleNetworkPanel, { ...props, loading: true })
      )
    ).toContain('aria-label="Loading people network"')
    const empty = renderToStaticMarkup(
      createElement(WorkspacePeopleNetworkPanel, {
        ...props,
        people: [],
        segments: [],
      })
    )
    expect(empty).toContain('aria-label="Ungrouped: 0 people"')
    expect(empty).not.toContain('aria-label="Open Alex Example"')
  })
  it("renders a labeled keyboard-focusable horizontal divider between network and table", () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspacePeopleNetworkSplit, {
        ...props,
        children: createElement("div", null, "People table contents"),
      })
    )
    expect(markup).toContain('role="separator"')
    expect(markup).toContain('aria-orientation="horizontal"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('aria-label="Resize network and people table"')
    expect(markup).toContain("People table contents")
  })
})
