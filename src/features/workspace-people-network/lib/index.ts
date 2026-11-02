import type { NetworkGroup, NetworkMove, NetworkMoveResult } from "../types"

export const NETWORK_UNGROUPED = "__ungrouped__"
export const NETWORK_GROUPS_PER_PAGE = 2

// Ungrouped means absent from ALL saved groups, including groups on other pages.
export function networkRings(
  groups: NetworkGroup[],
  personIds: string[],
  page: number,
  pageSize = NETWORK_GROUPS_PER_PAGE
) {
  const valid = new Set(personIds)
  const assigned = new Set(groups.flatMap((group) => group.memberIds))
  const start =
    Math.max(
      0,
      Math.min(page, Math.max(0, Math.ceil(groups.length / pageSize) - 1))
    ) * pageSize
  return [
    ...groups.slice(start, start + pageSize).map((group) => ({
      ...group,
      memberIds: [...new Set(group.memberIds)].filter((id) => valid.has(id)),
    })),
    {
      id: NETWORK_UNGROUPED,
      label: "Ungrouped",
      memberIds: [...valid].filter((id) => !assigned.has(id)),
    },
  ]
}

export function layoutNetworkRings(rings: NetworkGroup[], size: number) {
  const center = size / 2
  const occupied: { x: number; y: number }[] = []
  const labelRadii = rings.map(
    (_, index) => ((index + 1) * (center - 30)) / rings.length
  )
  return rings.map((ring, index) => {
    const radius = ((index + 1) * (center - 30)) / rings.length
    const points: { x: number; y: number }[] = []
    // Reserve the bottom arc for the group label. Keep full 44px hit targets apart.
    const count = Math.max(1, Math.floor((2 * Math.PI * radius) / 58))
    for (let slot = 0; slot < count; slot++) {
      const angle = ((130 + (slot * 280) / count) * Math.PI) / 180
      const point = {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
      }
      if (
        radius >= 36 &&
        labelRadii.every(
          (labelRadius) =>
            Math.abs(point.x - center) >= 86 ||
            Math.abs(point.y - center - labelRadius) >= 44
        ) &&
        occupied.every(
          (other) => Math.hypot(point.x - other.x, point.y - other.y) >= 48
        )
      ) {
        points.push(point)
        occupied.push(point)
      }
    }
    const overflow = ring.memberIds.length > points.length
    const visibleCount = Math.max(0, points.length - (overflow ? 1 : 0))
    return {
      ...ring,
      radius,
      points,
      visibleIds: ring.memberIds.slice(0, visibleCount),
      hiddenIds: ring.memberIds.slice(visibleCount),
      overflowPoint: overflow ? points[points.length - 1] : undefined,
    }
  })
}

// Save the destination before removing the source. A partial failure retains
// membership and is reported explicitly; other group memberships are untouched.
export async function moveNetworkMembership(
  move: NetworkMove,
  actions: {
    add: (id: string, personId: string) => Promise<boolean>
    remove: (id: string, personId: string) => Promise<boolean>
  }
): Promise<NetworkMoveResult> {
  if (move.from === move.to) return { ok: true }
  if (move.to && !(await actions.add(move.to, move.personId)))
    return {
      ok: false,
      message: "Could not add this person. Their previous group is unchanged.",
    }
  if (move.from && !(await actions.remove(move.from, move.personId)))
    return {
      ok: false,
      message: move.to
        ? "Added to the new group, but could not leave the previous group. Both memberships remain."
        : "Could not remove this person from the group.",
    }
  return { ok: true }
}
