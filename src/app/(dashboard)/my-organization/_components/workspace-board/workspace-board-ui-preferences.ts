import {
  normalizeWorkspaceDrawerTab,
  type WorkspaceDrawerTab,
} from "@/lib/workspace/routes"

export type WorkspaceBoardUiPreferenceScope = {
  orgId: string
  viewerId: string
}

export type WorkspaceCanvasViewportPreference = {
  x: number
  y: number
  zoom: number
}

export type WorkspaceCanvasPersonPlacementPreference = {
  personId: string
  x: number
  y: number
}

export type WorkspaceDataDrawerTabPreference = WorkspaceDrawerTab

export type WorkspaceBoardUiPreferences = {
  canvasViewport: WorkspaceCanvasViewportPreference | null
  canvasViewportLayoutVersion: number
  dataDrawerSnapPoint: number | string | null
  dataDrawerTab: WorkspaceDataDrawerTabPreference
  acceleratorIntroductionDismissed: boolean
  teamAccessCollapsed: boolean
  workspacePersonPlacements: WorkspaceCanvasPersonPlacementPreference[]
}

const WORKSPACE_BOARD_UI_PREFERENCES_VERSION = 1
const WORKSPACE_BOARD_UI_PREFERENCES_KEY_PREFIX =
  "coachhouse:workspace-board-ui"
export const WORKSPACE_CANVAS_VIEWPORT_LAYOUT_VERSION = 2
const WORKSPACE_CANVAS_MIN_ZOOM = 0.2
const WORKSPACE_CANVAS_MAX_ZOOM = 1.25
const WORKSPACE_CANVAS_MIN_POSITION = -50000
const WORKSPACE_CANVAS_MAX_POSITION = 50000
const WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT = "68px"
const WORKSPACE_DATA_DRAWER_LEGACY_COLLAPSED_SNAP_POINTS = new Set([
  "44px",
  "52px",
])
const WORKSPACE_DATA_DRAWER_LEGACY_COLLAPSED_MAX = 0.11
const WORKSPACE_DATA_DRAWER_MIN_NUMERIC_SNAP_POINT = 0.48
const WORKSPACE_DATA_DRAWER_MAX_SNAP_POINT = 1

const DEFAULT_WORKSPACE_BOARD_UI_PREFERENCES: WorkspaceBoardUiPreferences = {
  canvasViewport: null,
  canvasViewportLayoutVersion: 0,
  dataDrawerSnapPoint: null,
  dataDrawerTab: "organization",
  acceleratorIntroductionDismissed: false,
  teamAccessCollapsed: false,
  workspacePersonPlacements: [],
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function normalizeStorageKeyPart(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? encodeURIComponent(trimmed) : "unknown"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function buildWorkspaceBoardUiPreferencesStorageKey({
  orgId,
  viewerId,
}: WorkspaceBoardUiPreferenceScope) {
  return [
    WORKSPACE_BOARD_UI_PREFERENCES_KEY_PREFIX,
    `v${WORKSPACE_BOARD_UI_PREFERENCES_VERSION}`,
    normalizeStorageKeyPart(orgId),
    normalizeStorageKeyPart(viewerId),
  ].join(":")
}

export function normalizeWorkspaceCanvasViewportPreference(
  value: unknown
): WorkspaceCanvasViewportPreference | null {
  if (!isRecord(value)) return null

  const x = normalizeFiniteNumber(value.x)
  const y = normalizeFiniteNumber(value.y)
  const zoom = normalizeFiniteNumber(value.zoom)
  if (x === null || y === null || zoom === null) return null

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    zoom:
      Math.round(
        clampNumber(
          zoom,
          WORKSPACE_CANVAS_MIN_ZOOM,
          WORKSPACE_CANVAS_MAX_ZOOM
        ) * 1000
      ) / 1000,
  }
}

export function normalizeWorkspaceCanvasPersonPlacementsPreference(
  value: unknown
): WorkspaceCanvasPersonPlacementPreference[] {
  if (!Array.isArray(value)) return []

  const nextByPersonId = new Map<
    string,
    WorkspaceCanvasPersonPlacementPreference
  >()

  for (const item of value) {
    if (!isRecord(item)) continue

    const personId =
      typeof item.personId === "string" ? item.personId.trim() : ""
    const x = normalizeFiniteNumber(item.x)
    const y = normalizeFiniteNumber(item.y)
    if (!personId || x === null || y === null) continue

    nextByPersonId.delete(personId)
    nextByPersonId.set(personId, {
      personId,
      x: Math.round(
        clampNumber(
          x,
          WORKSPACE_CANVAS_MIN_POSITION,
          WORKSPACE_CANVAS_MAX_POSITION
        )
      ),
      y: Math.round(
        clampNumber(
          y,
          WORKSPACE_CANVAS_MIN_POSITION,
          WORKSPACE_CANVAS_MAX_POSITION
        )
      ),
    })
  }

  return Array.from(nextByPersonId.values())
}

export function normalizeWorkspaceDataDrawerSnapPointPreference(
  value: unknown
) {
  if (
    value === WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT ||
    WORKSPACE_DATA_DRAWER_LEGACY_COLLAPSED_SNAP_POINTS.has(String(value))
  ) {
    return WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
  }

  const snapPoint = normalizeFiniteNumber(value)
  if (snapPoint === null) return null
  if (snapPoint <= WORKSPACE_DATA_DRAWER_LEGACY_COLLAPSED_MAX) {
    return WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
  }

  return (
    Math.round(
      clampNumber(
        snapPoint,
        WORKSPACE_DATA_DRAWER_MIN_NUMERIC_SNAP_POINT,
        WORKSPACE_DATA_DRAWER_MAX_SNAP_POINT
      ) * 1000
    ) / 1000
  )
}

export function normalizeWorkspaceDataDrawerTabPreference(
  value: unknown
): WorkspaceDataDrawerTabPreference {
  return normalizeWorkspaceDrawerTab(value) ?? "organization"
}

export function normalizeWorkspaceBoardUiPreferences(
  value: unknown
): WorkspaceBoardUiPreferences {
  if (!isRecord(value)) {
    return DEFAULT_WORKSPACE_BOARD_UI_PREFERENCES
  }

  return {
    canvasViewport: normalizeWorkspaceCanvasViewportPreference(
      value.canvasViewport
    ),
    canvasViewportLayoutVersion: Math.max(
      0,
      Math.round(normalizeFiniteNumber(value.canvasViewportLayoutVersion) ?? 0)
    ),
    dataDrawerSnapPoint: normalizeWorkspaceDataDrawerSnapPointPreference(
      value.dataDrawerSnapPoint
    ),
    dataDrawerTab: normalizeWorkspaceDataDrawerTabPreference(
      value.dataDrawerTab
    ),
    acceleratorIntroductionDismissed: value.acceleratorIntroductionDismissed === true,
    teamAccessCollapsed: value.teamAccessCollapsed === true,
    workspacePersonPlacements:
      normalizeWorkspaceCanvasPersonPlacementsPreference(
        value.workspacePersonPlacements
      ),
  }
}

export function readWorkspaceBoardUiPreferences(
  scope: WorkspaceBoardUiPreferenceScope
): WorkspaceBoardUiPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE_BOARD_UI_PREFERENCES
  }

  try {
    const raw = window.localStorage.getItem(
      buildWorkspaceBoardUiPreferencesStorageKey(scope)
    )
    return normalizeWorkspaceBoardUiPreferences(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_WORKSPACE_BOARD_UI_PREFERENCES
  }
}

export function writeWorkspaceBoardUiPreferences(
  scope: WorkspaceBoardUiPreferenceScope,
  preferences: WorkspaceBoardUiPreferences
) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      buildWorkspaceBoardUiPreferencesStorageKey(scope),
      JSON.stringify(normalizeWorkspaceBoardUiPreferences(preferences))
    )
  } catch {
    // Ignore private-mode or quota failures; the current session still works.
  }
}

export function patchWorkspaceBoardUiPreferences(
  scope: WorkspaceBoardUiPreferenceScope,
  patch: Partial<WorkspaceBoardUiPreferences>
) {
  const nextPreferences = normalizeWorkspaceBoardUiPreferences({
    ...readWorkspaceBoardUiPreferences(scope),
    ...patch,
  })
  writeWorkspaceBoardUiPreferences(scope, nextPreferences)
  return nextPreferences
}
