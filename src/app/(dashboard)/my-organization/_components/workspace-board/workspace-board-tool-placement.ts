import {
  workspaceToolIdSchema,
  type WorkspaceToolId,
} from "@/features/workspace-particles"
import type { ParticlePosition } from "@/features/workspace-particles"
import type { WorkspaceBoardState } from "./workspace-board-types"

export type PlaceWorkspaceTool = (
  id: WorkspaceToolId,
  visible: boolean,
  position?: ParticlePosition
) => void

/** Explicit library placement does not cascade through the tree or run layout. */
export function placeWorkspaceTool(
  state: WorkspaceBoardState,
  id: WorkspaceToolId,
  visible: boolean,
  position?: ParticlePosition
): WorkspaceBoardState {
  if (
    !workspaceToolIdSchema.safeParse(id).success ||
    !state.nodes.some((node) => node.id === id)
  )
    return state
  if (
    position &&
    (!Number.isFinite(position.x) || !Number.isFinite(position.y))
  )
    return state
  const hiddenCardIds = visible
    ? state.hiddenCardIds.filter((item) => item !== id)
    : [...new Set([...state.hiddenCardIds, id])]
  return {
    ...state,
    hiddenCardIds,
    visibility: {
      ...state.visibility,
      ...(id === "organization-overview"
        ? { organizationHiddenExplicitly: !visible }
        : {}),
      allCardsHiddenExplicitly: state.nodes.every((node) =>
        hiddenCardIds.includes(node.id)
      ),
    },
    nodes:
      visible && position
        ? state.nodes.map((node) =>
            node.id === id ? { ...node, ...position } : node
          )
        : state.nodes,
  }
}
