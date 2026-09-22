"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { useRouter } from "next/navigation"
import type { Connection, Node } from "reactflow"

import { pickGoogleDriveFiles } from "@/features/google-drive/client"
import type {
  ParticleActivity,
  ParticleCalendarEvent,
  ParticleOrganization,
  ParticleProgram,
  WorkspaceParticleState,
} from "@/features/workspace-particles"
import {
  partitionWorkspaceParticleNodeChanges,
  WorkspaceParticlesProvider,
  useWorkspaceParticlesController,
} from "@/features/workspace-particles/client"

import { WorkspaceCanvasSurfaceV2View } from "./workspace-canvas-surface-v2-view"
import type { WorkspaceCanvasSurfaceV2ViewProps } from "./workspace-canvas-surface-v2-view-types"
import { resolveCardDimensions } from "../../workspace-board-layout-config"
import type {
  WorkspaceBoardState,
  WorkspaceCardId,
} from "../../workspace-board-types"

const pickDriveFiles = () => pickGoogleDriveFiles(true)

function eventPoint(event: MouseEvent | ReactMouseEvent) {
  return { x: event.clientX, y: event.clientY }
}

export function WorkspaceCanvasParticlesSurface({
  particleBoardState,
  particleSources,
  onParticlesChange,
  onPersistWorkspaceCardPosition,
  onToggleWorkspaceCardVisibility,
  ...props
}: WorkspaceCanvasSurfaceV2ViewProps & {
  particleBoardState: WorkspaceBoardState
  particleSources: {
    organization: ParticleOrganization
    activities: ParticleActivity[]
    programs: ParticleProgram[]
    calendarEvents: ParticleCalendarEvent[]
  }
  onParticlesChange: (state: WorkspaceParticleState) => void
  onPersistWorkspaceCardPosition: (
    cardId: WorkspaceCardId,
    x: number,
    y: number
  ) => void
  onToggleWorkspaceCardVisibility: (cardId: WorkspaceCardId) => void
}) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => router.refresh()
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [router])
  const onWorkspaceNodesChange = props.onNodesChange
  const placeCanvasNode = useCallback(
    (node: Node) => {
      if (node.id !== "organization-overview" && node.id !== "programs")
        return false
      onWorkspaceNodesChange([
        {
          id: node.id,
          type: "position",
          position: node.position,
          dragging: false,
        },
      ])
      onPersistWorkspaceCardPosition(node.id, node.position.x, node.position.y)
      return true
    },
    [onPersistWorkspaceCardPosition, onWorkspaceNodesChange]
  )
  const revealCanvasNode = useCallback(
    (nodeId: string, center?: { x: number; y: number }) => {
      if (nodeId !== "organization-overview" && nodeId !== "programs")
        return false
      if (!particleBoardState.hiddenCardIds.includes(nodeId)) return false
      if (center) {
        const boardNode = particleBoardState.nodes.find(
          (node) => node.id === nodeId
        )
        const dimensions = resolveCardDimensions(
          boardNode?.size ?? "md",
          nodeId
        )
        onPersistWorkspaceCardPosition(
          nodeId,
          center.x - dimensions.width / 2,
          center.y - dimensions.height / 2
        )
      }
      onToggleWorkspaceCardVisibility(nodeId)
      return true
    },
    [
      onPersistWorkspaceCardPosition,
      onToggleWorkspaceCardVisibility,
      particleBoardState.hiddenCardIds,
      particleBoardState.nodes,
    ]
  )
  const particles = useWorkspaceParticlesController({
    state: particleBoardState.particles,
    sections: props.workspaceAcceleratorDrawerRoadmapSections,
    organization: particleSources.organization,
    activities: particleSources.activities,
    programs: particleSources.programs,
    calendarEvents: particleSources.calendarEvents,
    canEdit: props.allowEditing && !props.presentationMode,
    enabled: !props.tutorialActive,
    onChange: onParticlesChange,
    onPlaceCanvasNode: placeCanvasNode,
    onRevealCanvasNode: revealCanvasNode,
    pickDriveFiles,
  })
  const nodes = useMemo(
    () => [...props.nodes, ...particles.nodes],
    [props.nodes, particles.nodes]
  )
  const visibleIds = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes]
  )
  const edges = useMemo(
    () => [
      ...props.edges,
      ...particles.state.connections
        .filter(
          (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
        )
        .map((edge) => ({
          ...edge,
          type: "smoothstep",
          animated: false,
          style: { stroke: "var(--muted-foreground)", strokeWidth: 1.5 },
        })),
    ],
    [props.edges, particles.state.connections, visibleIds]
  )
  const touchesParticle = (connection: Pick<Connection, "source" | "target">) =>
    connection.source?.startsWith("particle-") ||
    connection.target?.startsWith("particle-")

  return (
    <WorkspaceParticlesProvider controller={particles}>
      <WorkspaceCanvasSurfaceV2View
        {...props}
        nodes={nodes}
        edges={edges}
        onInit={(instance) => {
          particles.setFlow(instance)
          props.onInit(instance)
        }}
        onNodesChange={(changes) => {
          const { particleChanges, workspaceChanges } =
            partitionWorkspaceParticleNodeChanges(changes)
          if (particleChanges.length) particles.onNodesChange(particleChanges)
          if (workspaceChanges.length) props.onNodesChange(workspaceChanges)
        }}
        onNodeDragStop={(event, node, moved) => {
          if (node.type === "workspace-particle") {
            particles.persistPositions(
              moved?.length ? moved : [node],
              eventPoint(event)
            )
          } else {
            props.onNodeDragStop(event, node, moved)
          }
        }}
        onSelectionDragStop={(event, moved) => {
          const particleNodes = moved.filter(
            (node) => node.type === "workspace-particle"
          )
          const workspaceNodes = moved.filter(
            (node) => node.type !== "workspace-particle"
          )
          if (particleNodes.length)
            particles.persistPositions(particleNodes, eventPoint(event))
          if (workspaceNodes.length)
            props.onSelectionDragStop(event, workspaceNodes)
        }}
        onConnect={(connection) => {
          if (touchesParticle(connection)) particles.connect(connection)
          else props.onConnect(connection)
        }}
        isValidConnection={(connection) =>
          touchesParticle(connection)
            ? particles.canEdit &&
              Boolean(
                connection.source &&
                connection.target &&
                connection.source !== connection.target &&
                visibleIds.has(connection.source) &&
                visibleIds.has(connection.target)
              )
            : props.isValidConnection(connection)
        }
        onEdgeDoubleClick={(event, edge) => {
          if (edge.id.startsWith("particle-edge:"))
            particles.disconnect(edge.id)
          else props.onEdgeDoubleClick(event, edge)
        }}
        onEdgeContextMenu={(event, edge) => {
          if (edge.id.startsWith("particle-edge:")) event.preventDefault()
          else props.onEdgeContextMenu(event, edge)
        }}
      />
    </WorkspaceParticlesProvider>
  )
}
