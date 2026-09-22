import { resolveWorkspaceBoardParticleState } from "./workspace-board-particle-compatibility"
import {
  buildDefaultWorkspaceOntologyState,
  normalizeWorkspaceOntologyState,
} from "@/features/workspace-ontology"
import {
  WORKSPACE_CARD_IDS,
  type WorkspaceAutoLayoutMode,
  type WorkspaceBoardState,
  type WorkspaceBoardAcceleratorState,
  type WorkspaceBoardVisibilityState,
  type WorkspaceCardId,
  type WorkspaceConnectionState,
  type WorkspaceLayoutPreset,
  type WorkspaceNodeState,
} from "./workspace-board-types"
import { buildAutoLayoutNodesForMode } from "./workspace-board-auto-layout-modes"
import { WORKSPACE_EDGE_SPECS } from "./workspace-board-copy"
import { DEFAULT_HIDDEN_CARD_IDS } from "./workspace-board-layout-config"
import {
  buildPresetNodes,
  normalizeNodeCardSize,
} from "./workspace-board-preset-layout"
import { normalizeWorkspaceCardId } from "./workspace-board-card-id"
import { resolveWorkspaceBoardForwardCompatibleInput } from "./workspace-board-forward-compatibility"
import { normalizeWorkspaceBoardHiddenCardIdsForPayload } from "./workspace-board-hidden-card-normalization"
import {
  sanitizeWorkspaceBoardHiddenState,
  toggleWorkspaceBoardCardVisibility,
} from "./workspace-board-hidden-cards"
import {
  buildDefaultWorkspaceCommunicationsState,
  normalizeWorkspaceCommunicationsState,
} from "./workspace-board-layout-communications-state"
import {
  buildDefaultWorkspaceOnboardingFlowState,
  normalizeWorkspaceOnboardingFlowState,
} from "./workspace-board-onboarding-flow"
import {
  buildDefaultWorkspaceTrackerState,
  normalizeWorkspaceTrackerState,
} from "./workspace-board-layout-tracker-state"
import { normalizeWorkspaceBoardAcceleratorUiState } from "./workspace-board-visibility-reducer"

export { buildDefaultWorkspaceCommunicationsState } from "./workspace-board-layout-communications-state"
export { buildDefaultWorkspaceTrackerState } from "./workspace-board-layout-tracker-state"
export {
  buildPresetNodes,
  normalizeNodeCardSize,
} from "./workspace-board-preset-layout"
export {
  isWorkspaceCardAutoHeight,
  resolveCardDimensions,
  resolveWorkspaceCardCanvasShellClassName,
  resolveWorkspaceCardCanvasShellStyle,
  resolveWorkspaceCardHeightModeClassName,
  resolveWorkspaceCardNodeStyle,
} from "./workspace-board-layout-config"
export {
  sanitizeWorkspaceBoardHiddenState,
  toggleWorkspaceBoardCardVisibility,
} from "./workspace-board-hidden-cards"

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.round(value)
}

function isWorkspaceAutoLayoutMode(
  value: unknown
): value is WorkspaceAutoLayoutMode {
  return value === "dagre-tree" || value === "timeline"
}

function normalizeWorkspaceAutoLayoutMode(
  value: unknown
): WorkspaceAutoLayoutMode {
  if (value === "hub" || value === "dagre-tree") return "dagre-tree"
  if (value === "timeline") return "timeline"
  return "timeline"
}

export function buildDefaultWorkspaceConnections(): WorkspaceConnectionState[] {
  return WORKSPACE_EDGE_SPECS.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }))
}

const ORGANIZATION_ACCELERATOR_CONNECTION: WorkspaceConnectionState = {
  id: "edge-organization-to-accelerator",
  source: "organization-overview",
  target: "accelerator",
}

const ACTIVITY_FISCAL_SPONSORSHIP_CONNECTION: WorkspaceConnectionState = {
  id: "edge-activity-to-fiscal-sponsorship",
  source: "programs",
  target: "fiscal-sponsorship",
}

const LEGACY_ROADMAP_ACCELERATOR_CONNECTION_KEY = "roadmap->accelerator"
const LEGACY_ORGANIZATION_FISCAL_SPONSORSHIP_CONNECTION_KEY =
  "organization-overview->fiscal-sponsorship"

function getWorkspaceConnectionKey({
  source,
  target,
}: Pick<WorkspaceConnectionState, "source" | "target">) {
  return `${source}->${target}`
}

export function buildDefaultBoardState(
  preset: WorkspaceLayoutPreset = "balanced"
): WorkspaceBoardState {
  const autoLayoutMode: WorkspaceAutoLayoutMode = "timeline"
  const hiddenCardIds = [...DEFAULT_HIDDEN_CARD_IDS]
  const connections = buildDefaultWorkspaceConnections()
  return {
    version: 1,
    preset,
    autoLayoutMode,
    nodes: buildAutoLayoutNodesForMode({
      mode: autoLayoutMode,
      hiddenCardIds,
      connections,
    }),
    connections,
    communications: buildDefaultWorkspaceCommunicationsState(),
    tracker: buildDefaultWorkspaceTrackerState(),
    accelerator: buildDefaultWorkspaceAcceleratorState(),
    acceleratorUi: {
      stepOpen: false,
      lastStepId: null,
    },
    onboardingFlow: buildDefaultWorkspaceOnboardingFlowState(),
    hiddenCardIds,
    visibility: buildDefaultWorkspaceVisibilityState(),
    ontology: buildDefaultWorkspaceOntologyState(),
    updatedAt: new Date().toISOString(),
  }
}

function buildDefaultWorkspaceAcceleratorState(): WorkspaceBoardAcceleratorState {
  return {
    activeStepId: null,
    completedStepIds: [],
  }
}

function buildDefaultWorkspaceVisibilityState(): WorkspaceBoardVisibilityState {
  return {
    allCardsHiddenExplicitly: false,
  }
}

function normalizeWorkspaceAcceleratorState(
  value: unknown
): WorkspaceBoardAcceleratorState {
  if (!value || typeof value !== "object") {
    return buildDefaultWorkspaceAcceleratorState()
  }

  const record = value as Partial<WorkspaceBoardAcceleratorState>
  const activeStepId =
    typeof record.activeStepId === "string" &&
    record.activeStepId.trim().length > 0
      ? record.activeStepId
      : null
  const completedStepIds = Array.isArray(record.completedStepIds)
    ? record.completedStepIds.filter(
        (stepId): stepId is string =>
          typeof stepId === "string" && stepId.trim().length > 0
      )
    : []

  return {
    activeStepId,
    completedStepIds,
  }
}

function normalizeWorkspaceVisibilityState(
  value: unknown
): WorkspaceBoardVisibilityState {
  if (!value || typeof value !== "object") {
    return buildDefaultWorkspaceVisibilityState()
  }

  const record = value as Partial<WorkspaceBoardVisibilityState>
  return {
    allCardsHiddenExplicitly: record.allCardsHiddenExplicitly === true,
  }
}

function normalizeNodeState(
  value: unknown,
  fallbackMode: WorkspaceAutoLayoutMode,
  hiddenCardIds?: WorkspaceCardId[],
  connections?: WorkspaceConnectionState[]
): WorkspaceNodeState[] {
  const fallbackMap = new Map(
    buildAutoLayoutNodesForMode({
      mode: fallbackMode,
      hiddenCardIds,
      connections,
    }).map((node) => [node.id, node])
  )
  if (!Array.isArray(value)) {
    return buildAutoLayoutNodesForMode({
      mode: fallbackMode,
      hiddenCardIds,
      connections,
    })
  }

  const next: WorkspaceNodeState[] = []
  const seenNodeIds = new Set<WorkspaceCardId>()
  for (const rawNode of value) {
    if (!rawNode || typeof rawNode !== "object") continue
    const nodeRecord = rawNode as Partial<WorkspaceNodeState>
    const normalizedNodeId = normalizeWorkspaceCardId(nodeRecord.id)
    if (!normalizedNodeId || seenNodeIds.has(normalizedNodeId)) continue
    const fallback = fallbackMap.get(normalizedNodeId)
    if (!fallback) continue
    const normalizedX = normalizeNumber(nodeRecord.x, fallback.x)
    const normalizedY = normalizeNumber(nodeRecord.y, fallback.y)
    seenNodeIds.add(normalizedNodeId)
    next.push({
      id: normalizedNodeId,
      x: normalizedX,
      y: normalizedY,
      size: normalizeNodeCardSize(
        normalizedNodeId,
        nodeRecord.size,
        fallback.size
      ),
      positionMode:
        nodeRecord.positionMode === "managed" ||
        nodeRecord.positionMode === "manual"
          ? nodeRecord.positionMode
          : normalizedX === fallback.x && normalizedY === fallback.y
            ? "managed"
            : "manual",
    })
  }

  const present = new Set(next.map((node) => node.id))
  for (const id of WORKSPACE_CARD_IDS) {
    if (present.has(id)) continue
    const fallback = fallbackMap.get(id)
    if (!fallback) continue
    next.push(fallback)
  }

  return next
}

function normalizeConnectionState(value: unknown): WorkspaceConnectionState[] {
  const fallback = buildDefaultWorkspaceConnections()
  if (!Array.isArray(value)) {
    return fallback
  }

  const dedupe = new Set<string>()
  const next: WorkspaceConnectionState[] = []
  let sawLegacyRoadmapAcceleratorConnection = false
  let sawLegacyOrganizationFiscalSponsorshipConnection = false

  for (const rawConnection of value) {
    if (!rawConnection || typeof rawConnection !== "object") continue
    const connectionRecord = rawConnection as Partial<WorkspaceConnectionState>
    const normalizedSource = normalizeWorkspaceCardId(connectionRecord.source)
    const normalizedTarget = normalizeWorkspaceCardId(connectionRecord.target)
    if (!normalizedSource || !normalizedTarget) continue
    if (normalizedSource === normalizedTarget) continue

    const key = getWorkspaceConnectionKey({
      source: normalizedSource,
      target: normalizedTarget,
    })
    if (key === LEGACY_ROADMAP_ACCELERATOR_CONNECTION_KEY) {
      sawLegacyRoadmapAcceleratorConnection = true
      continue
    }
    if (key === LEGACY_ORGANIZATION_FISCAL_SPONSORSHIP_CONNECTION_KEY) {
      sawLegacyOrganizationFiscalSponsorshipConnection = true
      continue
    }
    if (dedupe.has(key)) continue
    dedupe.add(key)

    next.push({
      id:
        typeof connectionRecord.id === "string" &&
        connectionRecord.id.trim().length > 0
          ? connectionRecord.id
          : `edge-${normalizedSource}-to-${normalizedTarget}`,
      source: normalizedSource,
      target: normalizedTarget,
    })
  }

  if (sawLegacyRoadmapAcceleratorConnection) {
    const organizationAcceleratorKey = getWorkspaceConnectionKey(
      ORGANIZATION_ACCELERATOR_CONNECTION
    )
    if (!dedupe.has(organizationAcceleratorKey)) {
      next.push(ORGANIZATION_ACCELERATOR_CONNECTION)
    }
  }
  if (sawLegacyOrganizationFiscalSponsorshipConnection) {
    const activityFiscalSponsorshipKey = getWorkspaceConnectionKey(
      ACTIVITY_FISCAL_SPONSORSHIP_CONNECTION
    )
    if (!dedupe.has(activityFiscalSponsorshipKey)) {
      next.push(ACTIVITY_FISCAL_SPONSORSHIP_CONNECTION)
    }
  }

  return next.length > 0 ? next : fallback
}

export function normalizeWorkspaceBoardState(
  value: unknown
): WorkspaceBoardState {
  if (!value || typeof value !== "object") {
    return buildDefaultBoardState()
  }

  const record = value as Partial<WorkspaceBoardState>
  const preset: WorkspaceLayoutPreset =
    record.preset === "calendar-focused" ||
    record.preset === "communications-focused" ||
    record.preset === "balanced"
      ? record.preset
      : "balanced"
  const autoLayoutMode = normalizeWorkspaceAutoLayoutMode(record.autoLayoutMode)
  const forwardCompatibleInput = resolveWorkspaceBoardForwardCompatibleInput({
    connections: record.connections,
    forwardCompatibility: record.forwardCompatibility,
    hiddenCardIds: record.hiddenCardIds,
    nodes: record.nodes,
  })
  const particleState = resolveWorkspaceBoardParticleState(
    record.particles,
    forwardCompatibleInput.forwardCompatibility
  )
  const normalizedAccelerator = normalizeWorkspaceAcceleratorState(
    record.accelerator
  )
  const normalizedHiddenCardIds =
    normalizeWorkspaceBoardHiddenCardIdsForPayload(
      forwardCompatibleInput.hiddenCardIds,
      forwardCompatibleInput.nodes
    )
  const normalizedConnections = normalizeConnectionState(
    forwardCompatibleInput.connections
  )

  return {
    version: 1,
    preset,
    autoLayoutMode,
    nodes: normalizeNodeState(
      forwardCompatibleInput.nodes,
      autoLayoutMode,
      normalizedHiddenCardIds,
      normalizedConnections
    ),
    connections: normalizedConnections,
    communications: normalizeWorkspaceCommunicationsState(
      record.communications
    ),
    tracker: normalizeWorkspaceTrackerState(record.tracker),
    accelerator: normalizedAccelerator,
    acceleratorUi: normalizeWorkspaceBoardAcceleratorUiState(
      record.acceleratorUi,
      normalizedAccelerator.activeStepId
    ),
    onboardingFlow: normalizeWorkspaceOnboardingFlowState(
      record.onboardingFlow
    ),
    hiddenCardIds: normalizedHiddenCardIds,
    visibility: normalizeWorkspaceVisibilityState(record.visibility),
    ...(particleState.particles ? { particles: particleState.particles } : {}),
    ontology: record.ontology
      ? normalizeWorkspaceOntologyState(record.ontology)
      : undefined,
    ...(particleState.forwardCompatibility
      ? { forwardCompatibility: particleState.forwardCompatibility }
      : {}),
    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt.trim().length > 0
        ? record.updatedAt
        : new Date().toISOString(),
  }
}

export function applyAutoLayout(
  nodes: WorkspaceNodeState[],
  modeOrPreset: WorkspaceLayoutPreset | WorkspaceAutoLayoutMode,
  {
    hiddenCardIds,
    connections,
  }: {
    hiddenCardIds?: WorkspaceCardId[]
    connections?: WorkspaceConnectionState[]
  } = {}
): Promise<WorkspaceNodeState[]> {
  if (isWorkspaceAutoLayoutMode(modeOrPreset)) {
    return Promise.resolve(
      buildAutoLayoutNodesForMode({
        mode: modeOrPreset,
        existingNodes: nodes,
        hiddenCardIds,
        connections,
      })
    )
  }
  return Promise.resolve(buildPresetNodes(modeOrPreset, nodes))
}
