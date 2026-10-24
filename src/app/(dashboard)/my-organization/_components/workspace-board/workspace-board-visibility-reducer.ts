import {
  normalizeWorkspaceHiddenCardIds,
  sanitizeWorkspaceBoardHiddenState,
  toggleWorkspaceBoardCardVisibility,
} from "./workspace-board-hidden-cards"
import type {
  WorkspaceBoardAcceleratorUiState,
  WorkspaceBoardState,
  WorkspaceCardId,
} from "./workspace-board-types"

export type WorkspaceBoardVisibilityAction =
  | {
      type: "dock_toggle_card"
      cardId: WorkspaceCardId
    }
  | {
      type: "context_hide_card"
      cardId: WorkspaceCardId
    }
  | {
      type: "accelerator_step_open"
      stepId: string | null
    }
  | {
      type: "accelerator_step_close"
      source: "dock" | "card" | "unknown"
    }
  | {
      type: "accelerator_step_sync"
      stepId: string | null
    }
  | {
      type: "hydrate_legacy_visibility"
    }

export function normalizeWorkspaceBoardAcceleratorUiState(
  value: unknown,
  fallbackActiveStepId: string | null
): WorkspaceBoardAcceleratorUiState {
  if (!value || typeof value !== "object") {
    return {
      stepOpen: false,
      lastStepId: fallbackActiveStepId,
    }
  }

  const record = value as Partial<WorkspaceBoardAcceleratorUiState>
  return {
    stepOpen: record.stepOpen === true,
    lastStepId:
      typeof record.lastStepId === "string" &&
      record.lastStepId.trim().length > 0
        ? record.lastStepId
        : fallbackActiveStepId,
  }
}

function withAcceleratorUiState(
  state: WorkspaceBoardState
): WorkspaceBoardState & { acceleratorUi: WorkspaceBoardAcceleratorUiState } {
  const existing = state.acceleratorUi
  const normalized = normalizeWorkspaceBoardAcceleratorUiState(
    state.acceleratorUi,
    state.accelerator.activeStepId
  )
  if (
    existing &&
    existing.stepOpen === normalized.stepOpen &&
    existing.lastStepId === normalized.lastStepId
  ) {
    return state as WorkspaceBoardState & {
      acceleratorUi: WorkspaceBoardAcceleratorUiState
    }
  }

  return {
    ...state,
    acceleratorUi: normalized,
  }
}

function closeAcceleratorStepNode(
  state: WorkspaceBoardState & {
    acceleratorUi: WorkspaceBoardAcceleratorUiState
  }
): WorkspaceBoardState {
  if (!state.acceleratorUi.stepOpen) return state
  return {
    ...state,
    acceleratorUi: {
      ...state.acceleratorUi,
      stepOpen: false,
    },
  }
}

function ensureHiddenCardsNormalized(
  state: WorkspaceBoardState
): WorkspaceBoardState {
  const normalizedHiddenCardIds = normalizeWorkspaceHiddenCardIds(
    state.hiddenCardIds,
    {
      enforceFixedVisibleCards: !state.visibility?.organizationHiddenExplicitly,
    }
  )
  if (
    normalizedHiddenCardIds.length === state.hiddenCardIds.length &&
    normalizedHiddenCardIds.every(
      (cardId, index) => cardId === state.hiddenCardIds[index]
    )
  ) {
    return state
  }
  return {
    ...state,
    hiddenCardIds: normalizedHiddenCardIds,
  }
}

function toggleDockCardVisibility(
  state: WorkspaceBoardState,
  cardId: WorkspaceCardId
): WorkspaceBoardState {
  if (cardId === "organization-overview") return state

  const hiddenSet = new Set(
    normalizeWorkspaceHiddenCardIds(state.hiddenCardIds, {
      enforceFixedVisibleCards: !state.visibility?.organizationHiddenExplicitly,
    })
  )
  if (hiddenSet.has(cardId)) {
    hiddenSet.delete(cardId)
  } else {
    hiddenSet.add(cardId)
  }

  const nextHiddenCardIds = normalizeWorkspaceHiddenCardIds(
    Array.from(hiddenSet),
    {
      enforceFixedVisibleCards: !state.visibility?.organizationHiddenExplicitly,
    }
  )
  const nextVisibility = {
    ...state.visibility,
    allCardsHiddenExplicitly: false,
  }

  if (
    nextHiddenCardIds.length === state.hiddenCardIds.length &&
    nextHiddenCardIds.every(
      (nextCardId, index) => nextCardId === state.hiddenCardIds[index]
    ) &&
    (state.visibility?.allCardsHiddenExplicitly ?? false) ===
      nextVisibility.allCardsHiddenExplicitly
  ) {
    return state
  }

  return {
    ...state,
    hiddenCardIds: nextHiddenCardIds,
    visibility: nextVisibility,
  }
}

export function reduceWorkspaceBoardVisibility(
  state: WorkspaceBoardState,
  action: WorkspaceBoardVisibilityAction
): WorkspaceBoardState {
  const stateWithUi = withAcceleratorUiState(state)

  if (action.type === "hydrate_legacy_visibility") {
    return sanitizeWorkspaceBoardHiddenState(
      ensureHiddenCardsNormalized(stateWithUi)
    )
  }

  if (action.type === "accelerator_step_open") {
    const nextStepId =
      typeof action.stepId === "string" && action.stepId.trim().length > 0
        ? action.stepId
        : stateWithUi.acceleratorUi.lastStepId
    if (
      stateWithUi.acceleratorUi.stepOpen &&
      stateWithUi.acceleratorUi.lastStepId === nextStepId
    ) {
      return stateWithUi
    }
    const nextState: WorkspaceBoardState = {
      ...stateWithUi,
      acceleratorUi: {
        stepOpen: true,
        lastStepId: nextStepId,
      },
    }
    return nextState
  }

  if (action.type === "accelerator_step_close") {
    return closeAcceleratorStepNode(stateWithUi)
  }

  if (action.type === "accelerator_step_sync") {
    const nextStepId =
      typeof action.stepId === "string" && action.stepId.trim().length > 0
        ? action.stepId
        : null
    if (stateWithUi.acceleratorUi.lastStepId === nextStepId) return stateWithUi
    return {
      ...stateWithUi,
      acceleratorUi: {
        ...stateWithUi.acceleratorUi,
        lastStepId: nextStepId,
      },
    }
  }

  if (action.type === "context_hide_card") {
    if (stateWithUi.hiddenCardIds.includes(action.cardId)) return stateWithUi
    const next = toggleWorkspaceBoardCardVisibility(stateWithUi, action.cardId)
    if (action.cardId !== "accelerator") return next
    return closeAcceleratorStepNode(withAcceleratorUiState(next))
  }

  if (action.type === "dock_toggle_card") {
    const nextState = toggleDockCardVisibility(stateWithUi, action.cardId)
    if (!nextState.hiddenCardIds.includes("accelerator")) return nextState
    return closeAcceleratorStepNode(withAcceleratorUiState(nextState))
  }

  return stateWithUi
}
