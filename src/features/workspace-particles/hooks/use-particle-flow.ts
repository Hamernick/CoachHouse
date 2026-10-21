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
import { useParticleConnections } from "./use-particle-connections"
import { useParticleLayout } from "./use-particle-layout"
import { useParticleHistoryControls } from "./use-particle-history-controls"
import { useParticleCloseGuard } from "./use-particle-close-guard"
import { useParticleSelection } from "./use-particle-selection"
import { useParticleResize } from "./use-particle-resize"
import {
  reconcileParticleNode,
  visibleParticleIds,
  particleResizeChanges,
} from "../lib/particle-node-state"
import { useParticleCardActions } from "./use-particle-card-actions"
import { useParticleCreate } from "./use-particle-create"
import { useParticleImageUpload } from "./use-particle-image-upload"
import { particleFlowStateChanges } from "../lib/particle-flow-changes"
import { particleConnectionsToFlow } from "../lib/particle-flow-adapters"
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
}: {
  workspaceId: string
  session: ParticleSession
  canEdit: boolean
  visibleToolIds?: readonly string[]
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
  const dirty = useRef(false)
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
  const editable = sessionEditable && !layout.busy && !history.busy
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
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value
  }, [])
  const getSelectedIds = useCallback(() => flow.current?.getNodes().filter((node) => node.selected).map((node) => node.id) ?? [], [])
  const { select, calendarEntryRequest, inspectorView, shareParticleIds } = useParticleSelection({
    graph,
    selectedId,
    selectParticle,
    setNodes,
    dirty,
    getSelectedIds,
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
      let placement = position
      if (visible && !placement) {
        const canvas = document
          .querySelector("[data-workspace-canvas-flow-frame]")
          ?.getBoundingClientRect()
        if (canvas && flow.current)
          placement = flow.current.screenToFlowPosition({
            x: canvas.left + canvas.width / 2 - 140,
            y: canvas.top + 80,
          })
      }
      return editParticle(placeParticle(current, visible, placement), {
        optimistic: true,
      })
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
  useEffect(() => {
    setNodes((previous) =>
      (graph?.particles ?? [])
        .filter((particle) => !particle.canvasHidden)
        .map((particle) => {
          const old = previous.find((node) => node.id === particle.id)
          return reconcileParticleNode({
            old,
            particle,
            selectedId,
            movable,
            resizing: isResizing(particle.id),
            keepPosition: Boolean(
              old?.dragging ||
              pending ||
              layout.busy ||
              positions.has(particle.id)
            ),
            data: {
              particle,
              editable,
              onOpen: select,
              onEdit: edit,
              onAction: cardAction,
              onUploadImage: images.uploadToPlaceholder,
              resize: resizeControls,
            },
          })
        })
    )
  }, [
    graph,
    editable,
    movable,
    pending,
    select,
    edit,
    selectedId,
    positions,
    positionVersion,
    layout.busy,
    cardAction,
    resizeControls,
    images.uploadToPlaceholder,
    isResizing,
  ])
  const records = useMemo(
    () => new Map(graph?.particles.map((particle) => [particle.id, particle])),
    [graph]
  )
  const ids = useMemo(() => visibleParticleIds(graph), [graph])
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const stateChanges = particleFlowStateChanges(changes)
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
          particleResizeChanges(accepted, records),
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
    [movable, records, positions, isResizing]
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
    count: graph?.particles.length ?? 0,
    dirty,
    flow,
  })
  // Canvas positions change every frame; controls only need domain/edit state.
  const controls = useMemo(
    () => ({
      ...session,
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
      select,
      setDirty,
      setPlacement,
      create,
      flow,
      selected: graph?.particles.find((item) => item.id === selectedId) ?? null,
    }),
    [
      session,
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
