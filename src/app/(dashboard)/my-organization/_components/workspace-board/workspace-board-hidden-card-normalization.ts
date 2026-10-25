import { WORKSPACE_OPTIONAL_DEFAULT_HIDDEN_CARD_IDS } from "@/lib/workspace-card-policy"

import {
  WORKSPACE_CARD_IDS,
  type WorkspaceCardId,
  type WorkspaceNodeState,
} from "./workspace-board-types"
import { normalizeWorkspaceCardId } from "./workspace-board-card-id"
import { normalizeWorkspaceHiddenCardIds } from "./workspace-board-hidden-cards"

export function normalizeWorkspaceBoardHiddenCardIdsForPayload(
  hiddenCardIds: unknown,
  nodes: unknown,
  organizationHiddenExplicitly = false
): WorkspaceCardId[] {
  const normalizedHiddenCardIds = normalizeWorkspaceHiddenCardIds(
    hiddenCardIds,
    { enforceFixedVisibleCards: !organizationHiddenExplicitly }
  )
  const optionalDefaultCardIds =
    WORKSPACE_OPTIONAL_DEFAULT_HIDDEN_CARD_IDS as readonly WorkspaceCardId[]

  if (!Array.isArray(nodes)) {
    return WORKSPACE_CARD_IDS.filter(
      (cardId) =>
        normalizedHiddenCardIds.includes(cardId) ||
        optionalDefaultCardIds.includes(cardId)
    )
  }

  const payloadNodeIds = new Set<WorkspaceCardId>()
  for (const rawNode of nodes) {
    if (!rawNode || typeof rawNode !== "object") continue
    const normalizedNodeId = normalizeWorkspaceCardId(
      (rawNode as Partial<WorkspaceNodeState>).id
    )
    if (!normalizedNodeId) continue
    payloadNodeIds.add(normalizedNodeId)
  }

  const missingOptionalDefaultCardIds = optionalDefaultCardIds.filter(
    (cardId) => !payloadNodeIds.has(cardId)
  )
  if (missingOptionalDefaultCardIds.length === 0) {
    return normalizedHiddenCardIds
  }

  return WORKSPACE_CARD_IDS.filter(
    (cardId) =>
      normalizedHiddenCardIds.includes(cardId) ||
      missingOptionalDefaultCardIds.includes(cardId)
  )
}
