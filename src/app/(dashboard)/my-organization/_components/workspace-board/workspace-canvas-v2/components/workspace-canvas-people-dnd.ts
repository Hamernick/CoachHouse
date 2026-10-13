export const WORKSPACE_PERSON_DRAG_TYPE = "application/x-workspace-person-id"
export const WORKSPACE_CANVAS_PERSON_DRAG_TYPE =
  "application/x-workspace-canvas-person-id"
export const WORKSPACE_CANVAS_PEOPLE_DRAG_TYPE =
  "application/x-workspace-canvas-person-ids"

export type WorkspaceCanvasPersonDropRequest = {
  personId: string
  clientX: number
  clientY: number
}

export type WorkspaceCanvasPeopleAddRequest = {
  intent?: "drop"
  personIds: string[]
  clientX: number
  clientY: number
}

export type WorkspacePeopleCanvasActions = {
  add: (personIds: string[]) => number
  remove: (personId: string) => void
}

function normalizeWorkspaceCanvasPersonIds(personIds: string[]) {
  return Array.from(
    new Set(personIds.map((personId) => personId.trim()).filter(Boolean))
  )
}

export function writeWorkspaceCanvasPersonDragPayload(
  dataTransfer: DataTransfer,
  personIds: string[]
) {
  const normalizedPersonIds = normalizeWorkspaceCanvasPersonIds(personIds)
  const primaryPersonId = normalizedPersonIds[0]
  if (!primaryPersonId) return

  dataTransfer.setData(WORKSPACE_PERSON_DRAG_TYPE, primaryPersonId)
  dataTransfer.setData(WORKSPACE_CANVAS_PERSON_DRAG_TYPE, primaryPersonId)
  dataTransfer.setData(
    WORKSPACE_CANVAS_PEOPLE_DRAG_TYPE,
    JSON.stringify(normalizedPersonIds)
  )
}

export function hasWorkspaceCanvasPersonDragPayload(
  dataTransfer: DataTransfer | null
) {
  return Boolean(
    dataTransfer?.types.includes(WORKSPACE_CANVAS_PEOPLE_DRAG_TYPE) ||
    dataTransfer?.types.includes(WORKSPACE_CANVAS_PERSON_DRAG_TYPE)
  )
}

export function readWorkspaceCanvasPersonDragPayload(
  dataTransfer: DataTransfer | null
) {
  const personIds = dataTransfer?.getData(WORKSPACE_CANVAS_PEOPLE_DRAG_TYPE)
  if (personIds) {
    try {
      const parsed = JSON.parse(personIds)
      if (Array.isArray(parsed)) {
        return normalizeWorkspaceCanvasPersonIds(
          parsed.filter(
            (personId): personId is string => typeof personId === "string"
          )
        )
      }
    } catch {
      // Fall through to the single-person payload for older drag sources.
    }
  }

  const personId = dataTransfer?.getData(WORKSPACE_CANVAS_PERSON_DRAG_TYPE)
  return personId?.trim() ? normalizeWorkspaceCanvasPersonIds([personId]) : []
}
