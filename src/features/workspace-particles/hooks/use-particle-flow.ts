"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import {
  applyNodeChanges,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react"
import type { ParticleNodeData } from "../components/particle-node"
import { useParticleAssignments } from "./use-particle-assignments"
import { membershipResponsibilityKey } from "../lib/particle-membership-responsibility"
import type { PlanningActor } from "../lib/particle-plan-authority"
import { useParticleDirtyState } from "./use-particle-dirty-state"
import { useParticleConnections } from "./use-particle-connections"
import { useParticleLayout } from "./use-particle-layout"
import { useParticleHistoryControls } from "./use-particle-history-controls"
import { useParticleCloseGuard } from "./use-particle-close-guard"
import { useParticleSelection } from "./use-particle-selection"
import { useParticleResize } from "./use-particle-resize"
import {
  visibleParticleIds,
  particleResizeChanges,
} from "../lib/particle-node-state"
import { useParticleCardActions } from "./use-particle-card-actions"
import { useParticleNodeProjection } from "./use-particle-node-projection"
import { useParticleCreate } from "./use-particle-create"
import { useParticleImageUpload } from "./use-particle-image-upload"
import { particleFlowStateChanges } from "../lib/particle-flow-changes"
import { particleConnectionsToFlow } from "../lib/particle-flow-adapters"
import { particlePlacementMeasurements } from "../lib/particle-placement-viewport"
import { particleCreationPosition, particlePlanMemberships } from "../lib/particle-creation-placement"
import { placeParticle } from "../lib/particle-placement"
import { createParticlePositionPersistence } from "../lib/position-persistence"
import type {
  Particle,
  ParticlePosition,
} from "../types"
import type { ParticleSession } from "./use-particle-session"

export function useParticleFlow({
  workspaceId,
  session,
  canEdit,
  visibleToolIds = [],
  planningAccess,
}: {
  workspaceId: string
  session: ParticleSession
  canEdit: boolean
  visibleToolIds?: readonly string[]
  planningAccess?: PlanningActor & { workspaceId: string; error: string | null }
}) {
  const {
    select: selectParticle,
    selectedId,
    edit: editParticle,
    graph,
    editable: sessionEditable,
    pending,
    commit,
    getCurrentGraph,
    add,
  } = session
  const [libraryQuery, setLibraryQuery] = useState("")
  const [nodes, setNodes] = useState<Node<ParticleNodeData>[]>([])
  const currentNodes = useRef(nodes)
  currentNodes.current = nodes
  const flow = useRef<ReactFlowInstance | null>(null)
  const [positionVersion, reconcilePositions] = useReducer(
    (value: number) => value + 1,
    0
  )
  const latestCommit = useRef({ commit, workspaceId, getCurrentGraph })
  latestCommit.current = { commit, workspaceId, getCurrentGraph }
  const positions = useMemo(
    () =>
      createParticlePositionPersistence({
        commit: (operation) =>
          latestCommit.current.workspaceId === workspaceId
            ? latestCommit.current.commit([operation])
            : Promise.resolve(false),
        settled: reconcilePositions,
        getRevision: (id) =>
          latestCommit.current
            .getCurrentGraph()
            ?.particles.find((item) => item.id === id)?.revision,
      }),
    [workspaceId]
  )
  useEffect(() => () => positions.cancel(), [positions])
  const { dirty, setDirty, assignmentDirtyChange, isAssignmentDirty, assignmentVersion } = useParticleDirtyState()
  const { assignment, memberships } = useParticleAssignments(session, planningAccess?.workspaceId === workspaceId && !planningAccess.error ? planningAccess : undefined, canEdit, assignmentDirtyChange)
  const [resizeBusy, setResizeBusy] = useState(false)
  const flushBeforeLayout = useCallback(
    () => (resizeBusy ? Promise.resolve(false) : positions.flush()),
    [resizeBusy, positions]
  )
  const layout = useParticleLayout({
    session,
    flow,
    flush: flushBeforeLayout,
    dirty,
    setNodes,
  })
  const connections = useParticleConnections({
    session,
    flow,
    flush: positions.flush,
    dirty,
    blocked: layout.busy || resizeBusy,
    visibleToolIds,
  })
  const history = useParticleHistoryControls({
    session,
    flush: positions.flush,
    dirty,
    blocked: layout.busy || resizeBusy,
  })
  const editable = canEdit && sessionEditable && !layout.busy && !history.busy
  const images = useParticleImageUpload({
    session,
    dirty,
    blocked: layout.busy || history.busy || resizeBusy,
    flush: positions.flush,
    flow,
  })
  const cardAction = useParticleCardActions({
    session,
    flush: positions.flush,
    dirty,
    blocked: layout.busy || history.busy,
  })
  const deleteObjective = useCallback((id: string) => {
    if (!getCurrentGraph()?.particles.some(item => item.id === id && item.type === "objective")) return Promise.resolve(false)
    return cardAction(id, "delete")
  }, [getCurrentGraph, cardAction])
  const resize = useParticleResize({
    session,
    dirty,
    blocked: layout.busy || history.busy,
    setNodes,
    action: cardAction,
  })
  const isResizing = resize.isActive
  useEffect(() => setResizeBusy(resize.busy), [resize.busy])
  const resizeControls = useMemo(
    () => ({
      begin: resize.begin,
      preview: resize.preview,
      finish: resize.finish,
    }),
    [resize.begin, resize.preview, resize.finish]
  )
  const movable =
    canEdit &&
    Boolean(graph) &&
    !session.error &&
    !layout.busy &&
    !history.busy &&
    (!pending || positions.isSaving())
  const getSelectedIds = useCallback(() => flow.current?.getNodes().filter((node) => node.selected).map((node) => node.id) ?? [], [])
  const { expandedId, expand, collapse, select, focusCanvas, walkthrough, calendarEntryRequest, inspectorView, shareParticleIds } = useParticleSelection({
    graph,
    selectedId,
    selectParticle,
    setNodes,
    dirty,
    getSelectedIds,
    flow,
    expansionBlocked: layout.busy || history.busy || resizeBusy,
  })
  const closeGuard = useParticleCloseGuard({
    dirty,
    close: (restoreFocus) => select(null, { restoreFocus }),
    selectionId: selectedId,
    discardBlocked: inspectorView === "share",
  })
  const edit = useCallback(
    (particle: Particle) => {
      void editParticle(particle)
    },
    [editParticle]
  )
  const setPlacement = useCallback(
    async (id: string, visible: boolean, position?: ParticlePosition) => {
      const particle = graph?.particles.find((item) => item.id === id)
      if (!editable || !particle) return false
      if (id === selectedId && !visible && !select(null)) return false
      if (!(await positions.flush())) return false
      const current = getCurrentGraph()?.particles.find(
        (item) => item.id === id
      )
      if (!current) return false
      const snapshot = getCurrentGraph()
      const context = snapshot && particlePlanMemberships(snapshot).find(({ plan }) => plan.particleIds.includes(current.id))
      const managed = visible && !position && current.positionMode === "managed" && !current.locked && snapshot
      const placed = managed ? { ...current, canvasHidden: false, position: particleCreationPosition(snapshot, current, context || undefined, particlePlacementMeasurements(flow.current)) } : placeParticle(current, visible, position)
      return editParticle(placed, { optimistic: true })
    },
    [
      editable,
      graph,
      selectedId,
      select,
      positions,
      editParticle,
      getCurrentGraph,
    ]
  )
  const assignmentContext = walkthrough.reference ? membershipResponsibilityKey(walkthrough.reference) : undefined
  const nodeData = useMemo(() => ({ assignment, onExpand: expand, onCollapse: collapse, editable,
    onOpen: select, onEdit: edit, onAction: cardAction, onUploadImage: images.uploadToPlaceholder, resize: resizeControls }),
  [assignment, expand, collapse, editable, select, edit, cardAction, images.uploadToPlaceholder, resizeControls])
  useParticleNodeProjection({ graph, previous: currentNodes, setNodes, selectedId, expandedId, movable, pending,
    layoutBusy: layout.busy, positionVersion, positionPending: positions.has, isResizing, isAssignmentDirty,
    memberships, assignmentContext, assignmentVersion, walkthroughId: walkthrough.currentId, data: nodeData })
  const records = useMemo(
    () => new Map(graph?.particles.map((particle) => [particle.id, particle])),
    [graph]
  )
  const ids = useMemo(() => visibleParticleIds(graph), [graph])
  const walkthroughId = walkthrough.currentId
  const cancelWalkthrough = walkthrough.cancel
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const stateChanges = particleFlowStateChanges(changes)
      if (expandedId && changes.some(change => (change.type === "position" && change.dragging) || (change.type === "dimensions" && change.resizing))) collapse(false)
      if (stateChanges.some(change => change.type === "select" && change.selected && change.id !== walkthroughId)) cancelWalkthrough()
      const accepted = stateChanges.filter((change) => {
        if (change.type === "remove") return false
        if (change.type !== "position") return true
        if (isResizing(change.id)) return false
        const particle = records.get(change.id)
        if (!movable || !particle || particle.locked) return false
        if (change.dragging !== undefined)
          positions.gesture(change.id, change.dragging)
        if (change.position) positions.record(particle, change.position)
        return true
      })
      setNodes((current) =>
        applyNodeChanges<Node<ParticleNodeData>>(
          particleResizeChanges(accepted, records, new Set(memberships.keys())),
          current
        )
      )
      // Native arrow-key movement emits final position changes without drag-stop.
      if (
        accepted.some(
          (change) => change.type === "position" && change.dragging === false
        )
      )
        positions.schedule()
    },
    [movable, records, memberships, positions, isResizing, walkthroughId, cancelWalkthrough, expandedId, collapse]
  )
  const move = useCallback(
    async (moved: Node[]) => {
      if (!movable) return false
      for (const node of moved) {
        const particle = graph?.particles.find((item) => item.id === node.id)
        if (particle) {
          positions.gesture(node.id, false)
          positions.record(particle, node.position)
        }
      }
      return positions.flush()
    },
    [movable, graph, positions]
  )
  const create = useParticleCreate({
    add,
    getCurrentGraph,
    dirty,
    flow,
  })
  // Canvas positions change every frame; controls only need domain/edit state.
  const canvasSelectedId = nodes.find(node => node.selected)?.id ?? null
  const controls = useMemo(
    () => ({
      ...session,
      planningAccess,
      assignmentOnCanvas: true,
      canEdit,
      images,
      visibleToolIds,
      libraryQuery,
      setLibraryQuery,
      editable,
      layout,
      connections,
      history,
      calendarEntryRequest,
      closeGuard,
      inspectorView,
      shareParticleIds,
      focusCanvas,
      walkthrough,
      canvasSelectedId,
      expandedId, expand, collapse,
      deleteObjective,
      select,
      setDirty,
      setPlacement,
      create,
      flow,
      selected: graph?.particles.find((item) => item.id === selectedId) ?? null,
    }),
    [
      session,
      planningAccess,
      canEdit,
      images,
      visibleToolIds,
      libraryQuery,
      editable,
      layout,
      connections,
      history,
      calendarEntryRequest,
      closeGuard,
      inspectorView,
      shareParticleIds,
      focusCanvas,
      walkthrough,
      canvasSelectedId,
      expandedId, expand, collapse,
      deleteObjective,
      select,
      setDirty,
      setPlacement,
      create,
      graph,
      selectedId,
    ]
  )
  const edges = useMemo(
    () =>
      graph
        ? particleConnectionsToFlow(
            graph,
            layout.routes,
            visibleToolIds,
            connections.preview
          )
        : [],
    [graph, layout.routes, visibleToolIds, connections.preview]
  )
  return { ...controls, controls, nodes, edges, ids, onNodesChange, move }
}
