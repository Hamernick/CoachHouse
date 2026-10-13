import { resolveCardDimensions, roundToSnap } from "./workspace-board-layout-config"
import type { WorkspaceCardId, WorkspaceNodeState } from "./workspace-board-types"

// Used only when creating a board. Saved coordinates and explicit auto-layout
// choices remain owned by their existing normalization/layout paths.
export function arrangeInitialWorkspaceNodes(nodes: WorkspaceNodeState[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const dimensions = (id: WorkspaceCardId) => {
    const node = byId.get(id)!
    return resolveCardDimensions(node.size, id)
  }
  const left = 120
  const top = 192
  const gap = 72
  const right = roundToSnap(left + Math.max(
    dimensions("organization-overview").width,
    dimensions("accelerator").width,
  ) + gap)
  const secondRow = roundToSnap(top + Math.max(
    dimensions("organization-overview").height,
    dimensions("programs").height,
  ) + gap)
  const positions: Partial<Record<WorkspaceCardId, { x: number; y: number }>> = {
    "organization-overview": { x: left, y: top },
    programs: { x: right, y: top },
    accelerator: { x: left, y: secondRow },
    roadmap: { x: right, y: secondRow },
    calendar: {
      x: left,
      y: roundToSnap(secondRow + dimensions("accelerator").height + gap),
    },
    atlas: {
      x: right,
      y: roundToSnap(secondRow + dimensions("roadmap").height + gap),
    },
  }
  return nodes.map((node) => ({ ...node, ...positions[node.id] }))
}
