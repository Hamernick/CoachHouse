"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import type { WorkspaceCanvasPersonNodeData } from "./workspace-canvas-person-node-model"
import type { Node, ReactFlowInstance } from "@xyflow/react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"

import {
  patchWorkspaceBoardUiPreferences,
  type WorkspaceBoardUiPreferenceScope,
} from "../../workspace-board-ui-preferences"
import { useStoredWorkspacePersonPlacements } from "./use-stored-workspace-person-placements"
import type {
  WorkspaceCanvasPeopleAddRequest,
  WorkspaceCanvasPersonDropRequest,
} from "./workspace-canvas-people-dnd"
import { canMutateWorkspaceCanvasPeople } from "./workspace-canvas-people-rollout"
import {
  normalizeWorkspaceCanvasPersonIds,
  resolveWorkspacePeopleRelationshipGraphPersonIds,
} from "./workspace-canvas-person-relationship-engine"
import { buildWorkspaceCanvasPersonRelationshipEdges } from "./workspace-canvas-person-relationship-edges"
import {
  buildWorkspacePeopleRelationshipPlacementLayout,
  resolveWorkspacePeopleRelationshipCanvasCenter,
  resolveWorkspacePeopleRelationshipFocusPersonId,
  shiftWorkspacePeopleRelationshipPlacementsAwayFromWorkspaceCards,
} from "./workspace-canvas-person-relationship-layout"
import {
  buildWorkspacePeopleDropPlacements,
  getWorkspaceCanvasPersonNodeId,
  isWorkspaceCanvasPersonNodeData,
  type WorkspaceCanvasPersonPlacement,
} from "./workspace-canvas-person-node-model"
import type { WorkspaceCanvasPersonFitRequest } from "./workspace-canvas-person-fit-request"
export {
  useWorkspaceCanvasPersonFitRequest,
  type WorkspaceCanvasPersonFitRequest,
} from "./workspace-canvas-person-fit-request"

const WORKSPACE_PEOPLE_BULK_RELAYOUT_THRESHOLD = 4

export function useWorkspaceCanvasPeoplePlacementController({
  allowPeopleCanvasInteraction,
  enabled,
  tutorialActive,
  people,
  presentationMode,
  flowInstanceRef,
  uiPreferencesScope,
}: {
  allowPeopleCanvasInteraction: boolean
  enabled: boolean
  tutorialActive: boolean
  people: OrgPersonWithImage[]
  presentationMode: boolean
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
}) {
  const workspacePersonById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people]
  )
  const [workspacePersonPlacements, setWorkspacePersonPlacements] =
    useStoredWorkspacePersonPlacements({ enabled, uiPreferencesScope })
  const [fitRequest, setFitRequest] =
    useState<WorkspaceCanvasPersonFitRequest>(null)
  const fitRequestKeyRef = useRef(0)
  const placedWorkspacePersonIds = useMemo(
    () =>
      new Set(workspacePersonPlacements.map((placement) => placement.personId)),
    [workspacePersonPlacements]
  )
  const canMutatePeople = canMutateWorkspaceCanvasPeople({
    enabled,
    interactionEnabled: allowPeopleCanvasInteraction,
    tutorialActive,
  })

  useEffect(() => {
    if (!enabled) setFitRequest(null)
  }, [enabled])

  const commitWorkspacePersonPlacements = useCallback(
    (
      updater: (
        current: WorkspaceCanvasPersonPlacement[]
      ) => WorkspaceCanvasPersonPlacement[]
    ) => {
      if (!enabled) return
      setWorkspacePersonPlacements((current) => {
        const next = updater(current)
        if (next === current) return current

        patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
          workspacePersonPlacements: next,
        })
        return next
      })
    },
    [enabled, setWorkspacePersonPlacements, uiPreferencesScope]
  )

  useEffect(() => {
    commitWorkspacePersonPlacements((current) => {
      const next = current.filter((placement) =>
        workspacePersonById.has(placement.personId)
      )
      return next.length === current.length ? current : next
    })
  }, [commitWorkspacePersonPlacements, workspacePersonById])

  const handleRemoveWorkspacePersonPlacement = useCallback(
    (personId: string) => {
      if (!enabled) return
      commitWorkspacePersonPlacements((current) =>
        current.filter((placement) => placement.personId !== personId)
      )
    },
    [commitWorkspacePersonPlacements, enabled]
  )
  const clearWorkspacePersonFitRequest = useCallback(() => {
    setFitRequest(null)
  }, [])
  const requestWorkspacePersonFit = useCallback((personIds: string[]) => {
    const nodeIds = Array.from(
      new Set(personIds.map((personId) => personId.trim()).filter(Boolean))
    ).map((personId) => getWorkspaceCanvasPersonNodeId(personId))
    if (nodeIds.length === 0) return

    fitRequestKeyRef.current += 1
    setFitRequest({
      nodeIds,
      requestKey: fitRequestKeyRef.current,
    })
  }, [])

  const placeWorkspacePeopleAtPoint = useCallback(
    (personIds: string[], clientX: number, clientY: number) => {
      const flowInstance = flowInstanceRef.current
      if (!canMutatePeople || !flowInstance) return 0
      const requestedIds = normalizeWorkspaceCanvasPersonIds(personIds).filter(
        (personId) => workspacePersonById.has(personId)
      )
      if (requestedIds.length === 0) return 0

      const nextPlacements = buildWorkspacePeopleDropPlacements(
        requestedIds,
        flowInstance.screenToFlowPosition({ x: clientX, y: clientY })
      )
      setFitRequest(null)
      commitWorkspacePersonPlacements((current) => {
        const nextByPersonId = new Map(
          current.map((placement) => [placement.personId, placement])
        )
        for (const placement of nextPlacements) {
          nextByPersonId.set(placement.personId, placement)
        }
        return Array.from(nextByPersonId.values())
      })
      return nextPlacements.length
    },
    [canMutatePeople, commitWorkspacePersonPlacements, flowInstanceRef, workspacePersonById]
  )

  const handleWorkspacePersonDropToCanvas = useCallback(
    ({ personId, clientX, clientY }: WorkspaceCanvasPersonDropRequest) =>
      placeWorkspacePeopleAtPoint([personId], clientX, clientY) > 0,
    [placeWorkspacePeopleAtPoint]
  )

  const handleAddWorkspacePeopleToCanvas = useCallback(
    ({ personIds, clientX, clientY, intent }: WorkspaceCanvasPeopleAddRequest) => {
      if (!canMutatePeople || personIds.length === 0) {
        return 0
      }

      const flowInstance = flowInstanceRef.current
      if (!flowInstance) return 0

      const requestedPersonIds = normalizeWorkspaceCanvasPersonIds(
        personIds
      ).filter((personId) => workspacePersonById.has(personId))
      if (requestedPersonIds.length === 0) return 0

      if (intent === "drop") {
        return placeWorkspacePeopleAtPoint(requestedPersonIds, clientX, clientY)
      }
      if (requestedPersonIds.length === 1) {
        const personId = requestedPersonIds[0]!
        if (!placedWorkspacePersonIds.has(personId)) {
          placeWorkspacePeopleAtPoint([personId], clientX, clientY)
        }
        requestWorkspacePersonFit([personId])
        return 1
      }

      const relationshipPersonIds =
        resolveWorkspacePeopleRelationshipGraphPersonIds({
          personIds: requestedPersonIds,
          peopleById: workspacePersonById,
        })
      const unplacedPersonIds = relationshipPersonIds.filter(
        (personId) => !placedWorkspacePersonIds.has(personId)
      )
      const shouldRelayoutRequestedPeople =
        requestedPersonIds.length >= WORKSPACE_PEOPLE_BULK_RELAYOUT_THRESHOLD

      if (unplacedPersonIds.length === 0 && !shouldRelayoutRequestedPeople) {
        requestWorkspacePersonFit(relationshipPersonIds)
        return requestedPersonIds.length
      }

      const fallbackCenter = flowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      })
      const layoutPersonIds = shouldRelayoutRequestedPeople
        ? relationshipPersonIds
        : unplacedPersonIds
      const layoutExistingPlacements = shouldRelayoutRequestedPeople
        ? []
        : workspacePersonPlacements
      const focusPersonId = resolveWorkspacePeopleRelationshipFocusPersonId({
        personIds: layoutPersonIds,
        peopleById: workspacePersonById,
        existingPlacements: layoutExistingPlacements,
      })
      const graphNodes = flowInstance.getNodes()
      const center = resolveWorkspacePeopleRelationshipCanvasCenter({
        nodes: graphNodes,
        fallbackCenter,
        focusPersonId,
        existingPlacements: layoutExistingPlacements,
        personCount: relationshipPersonIds.length,
      })
      const nextPlacements =
        shiftWorkspacePeopleRelationshipPlacementsAwayFromWorkspaceCards({
          placements: buildWorkspacePeopleRelationshipPlacementLayout({
            personIds: layoutPersonIds,
            peopleById: workspacePersonById,
            existingPlacements: layoutExistingPlacements,
            center,
          }),
          nodes: graphNodes,
        })
      if (nextPlacements.length === 0) return 0

      commitWorkspacePersonPlacements((current) => {
        const nextByPersonId = new Map(
          current.map((placement) => [placement.personId, placement])
        )
        for (const placement of nextPlacements) {
          nextByPersonId.set(placement.personId, placement)
        }
        return Array.from(nextByPersonId.values())
      })
      requestWorkspacePersonFit(relationshipPersonIds)

      return requestedPersonIds.length
    },
    [
      canMutatePeople,
      commitWorkspacePersonPlacements,
      flowInstanceRef,
      placedWorkspacePersonIds,
      placeWorkspacePeopleAtPoint,
      requestWorkspacePersonFit,
      workspacePersonById,
      workspacePersonPlacements,
    ]
  )

  const handleWorkspacePersonNodeDragStop = useCallback(
    (node: Node) => {
      if (
        !enabled ||
        node.type !== "workspace-person" ||
        !isWorkspaceCanvasPersonNodeData(node.data)
      ) {
        return false
      }

      const personId = node.data.person.id
      commitWorkspacePersonPlacements((current) =>
        current.map((placement) =>
          placement.personId === personId
            ? {
                ...placement,
                x: Math.round(node.position.x),
                y: Math.round(node.position.y),
              }
            : placement
        )
      )
      return true
    },
    [commitWorkspacePersonPlacements, enabled]
  )
  const handleWorkspacePersonNodesDragStop = useCallback(
    (nodes: Node[]) => {
      if (!enabled) return false
      const personNodePositions = nodes
        .filter(
          (node): node is Node<WorkspaceCanvasPersonNodeData> =>
            node.type === "workspace-person" &&
            isWorkspaceCanvasPersonNodeData(node.data)
        )
        .map((node) => ({
          personId: node.data.person.id,
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        }))
      if (personNodePositions.length === 0) return false

      commitWorkspacePersonPlacements((current) => {
        let changed = false
        const nextByPersonId = new Map(
          current.map((placement) => [placement.personId, placement])
        )

        for (const position of personNodePositions) {
          const existing = nextByPersonId.get(position.personId)
          if (!existing) continue
          if (existing.x === position.x && existing.y === position.y) continue

          changed = true
          nextByPersonId.set(position.personId, {
            ...existing,
            x: position.x,
            y: position.y,
          })
        }

        return changed ? Array.from(nextByPersonId.values()) : current
      })
      return true
    },
    [commitWorkspacePersonPlacements, enabled]
  )

  const personRelationshipEdges = useMemo(
    () =>
      buildWorkspaceCanvasPersonRelationshipEdges({
        placements: workspacePersonPlacements,
        peopleById: workspacePersonById,
        presentationMode,
      }),
    [presentationMode, workspacePersonById, workspacePersonPlacements]
  )

  return {
    workspacePersonById,
    workspacePersonPlacements,
    placedWorkspacePersonIds,
    personRelationshipEdges,
    workspacePersonFitRequest: enabled ? fitRequest : null,
    clearWorkspacePersonFitRequest,
    handleRemoveWorkspacePersonPlacement,
    handleWorkspacePersonDropToCanvas,
    handleAddWorkspacePeopleToCanvas,
    handleWorkspacePersonNodeDragStop,
    handleWorkspacePersonNodesDragStop,
  }
}
