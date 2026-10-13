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
import { particleFlowStateChanges } from "../lib/particle-flow-changes"
import { particleRegistry } from "../lib/particle-registry"
import { particleConnectionsToFlow } from "../lib/particle-flow-adapters"
import { placeParticle } from "../lib/particle-placement"
import { createParticlePositionPersistence } from "../lib/position-persistence"
import type {
  Particle,
  ParticleGraph,
  ParticleResult,
  ParticlePosition,
  ParticleType,
} from "../types"
import {
  useParticleSession,
  type ParticleTransport,
} from "./use-particle-session"

export function useParticleFlow({
  workspaceId,
  stored,
  canEdit,
  transport,
  load,
  visibleToolIds = [],
}: {
  workspaceId: string
  stored: unknown
  canEdit: boolean
  visibleToolIds?: readonly string[]
  transport: ParticleTransport
  load: () => Promise<ParticleResult<ParticleGraph>>
}) {
  const session = useParticleSession({
    workspaceId,
    stored,
    canEdit,
    transport,
    load,
  })
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
  const layout = useParticleLayout({
    session,
    flow,
    flush: positions.flush,
    dirty,
    setNodes,
  })
  const connections = useParticleConnections({
    session,
    flow,
    flush: positions.flush,
    dirty,
    blocked: layout.busy,
    visibleToolIds,
  })
  const editable = sessionEditable && !layout.busy
  const movable =
    canEdit &&
    Boolean(graph) &&
    !session.error &&
    !layout.busy &&
    (!pending || positions.isSaving())
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value
  }, [])
  const select = useCallback(
    (
      id: string | null,
      options?: { restoreFocus?: boolean; preserveSelection?: boolean }
    ) => {
      if (id !== null && !graph?.particles.some((item) => item.id === id))
        return false
      if (id === null && selectedId === null) return true
      if (
        dirty.current &&
        id !== selectedId &&
        !window.confirm("Discard unsaved Particle changes?")
      )
        return false
      selectParticle(id)
      if (id)
        setNodes((current) =>
          current.map((node) => {
            const selected =
              node.id === id ||
              Boolean(options?.preserveSelection && node.selected)
            return node.selected === selected
              ? node
              : { ...node, selected: Boolean(selected) }
          })
        )
      if (id === null && selectedId && options?.restoreFocus !== false) {
        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              `.react-flow__node[data-id="${selectedId}"]`
            )
            ?.focus({ preventScroll: true })
        })
      }
      return true
    },
    [selectParticle, selectedId, graph]
  )
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
      return editParticle(placeParticle(current, visible, placement))
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
          return {
            id: particle.id,
            type: "workspace-particle",
            ariaLabel: `${particleRegistry[particle.type].label}: ${particle.title}`,
            position:
              old &&
              (old.dragging ||
                pending ||
                layout.busy ||
                positions.has(particle.id))
                ? old.position
                : particle.position,
            measured: old?.measured,
            dragging: old?.dragging,
            selected: old?.selected ?? particle.id === selectedId,
            data: {
              particle,
              editable: editable,
              onOpen: select,
              onEdit: edit,
              onRemove: (id: string) => void setPlacement(id, false),
            },
            style: {
              width: particle.width ?? particleRegistry[particle.type].width,
            },
            dragHandle: ".workspace-card-drag-handle",
            draggable: movable && !particle.locked,
            connectable: editable,
          }
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
    setPlacement,
  ])
  const ids = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes])
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const records = new Map(
        graph?.particles.map((particle) => [particle.id, particle])
      )
      const stateChanges = particleFlowStateChanges(changes)
      const accepted = stateChanges.filter((change) => {
        if (change.type === "remove") return false
        if (change.type !== "position") return true
        const particle = records.get(change.id)
        if (!movable || !particle || particle.locked) return false
        if (change.dragging !== undefined)
          positions.gesture(change.id, change.dragging)
        if (change.position) positions.record(particle, change.position)
        return true
      })
      setNodes((current) =>
        applyNodeChanges<Node<ParticleNodeData>>(accepted, current)
      )
      // Native arrow-key movement emits final position changes without drag-stop.
      if (
        accepted.some(
          (change) => change.type === "position" && change.dragging === false
        )
      )
        positions.schedule()
    },
    [movable, graph, positions]
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
  const create = useCallback(
    (type: ParticleType, title: string, prepared?: Particle) => {
      if (dirty.current && !window.confirm("Discard unsaved Particle changes?"))
        return Promise.resolve(false)
      const canvas = document
        .querySelector("[data-workspace-canvas-flow-frame]")
        ?.getBoundingClientRect()
      const position =
        canvas && flow.current
          ? flow.current.screenToFlowPosition({
              x: canvas.left + canvas.width / 2 - 140,
              y: canvas.top + Math.min(canvas.height * 0.2, 150),
            })
          : { x: 100, y: 100 }
      const count = graph?.particles.length ?? 0
      return add(
        type,
        title,
        {
          x: position.x + (count % 4) * 28,
          y: position.y + (count % 4) * 28,
        },
        prepared
      )
    },
    [add, graph]
  )
  return {
    ...session,
    visibleToolIds,
    libraryQuery,
    setLibraryQuery,
    editable,
    layout,
    connections,
    select,
    setDirty,
    setPlacement,
    nodes,
    edges: graph
      ? particleConnectionsToFlow(
          graph,
          layout.routes,
          visibleToolIds,
          connections.preview
        )
      : [],
    ids,
    onNodesChange,
    move,
    create,
    flow,
    selected: graph?.particles.find((item) => item.id === selectedId) ?? null,
  }
}
