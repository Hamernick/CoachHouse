"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type { Connection, Node, NodeChange, ReactFlowInstance } from "reactflow"
import { toast } from "sonner"
import type { RoadmapSection } from "@/lib/roadmap/types"
import {
  normalizeWorkspaceParticleState,
  PARTICLE_LIMIT,
  PARTICLE_IMAGE_MAX_BYTES,
  PARTICLE_SIZES,
  particleDisplaySize,
  activateExistingCanvasNode,
  particleSourceKey,
  removeParticle,
  resizeParticle,
} from "../lib"
import type {
  ParticleDriveDocument,
  ParticleImage,
  ParticleActivity,
  ParticleCalendarEvent,
  ParticleOrganization,
  ParticleProgram,
  ParticleReference,
  ParticleSize,
  ParticleSource,
  WorkspaceParticleState,
} from "../types"
import { buildPlanParticleSources } from "../lib/particle-plan-state"
import { useParticlePlanController } from "./use-particle-plan-controller"
import { useParticleSources } from "./use-particle-sources"
import { useParticleNodes } from "./use-particle-nodes"
import { particleMotionDuration } from "../lib/particle-motion"
import { hasParticlePositionChanges } from "../lib/particle-position-changes"

function useRefSetter<T>(ref: { current: T }) {
  return useCallback(
    (value: T) => {
      ref.current = value
    },
    [ref]
  )
}

function activateExistingSource({
  flow,
  source,
  point,
  onPlace,
  onReveal,
  announce,
}: {
  flow: ReactFlowInstance
  source: ParticleSource | undefined
  point?: { x: number; y: number }
  onPlace?: (node: Node) => boolean
  onReveal?: (
    canvasNodeId: string,
    center?: { x: number; y: number }
  ) => boolean
  announce: (message: string) => void
}) {
  if (!source?.canvasNodeId) return null
  const action = activateExistingCanvasNode({
    flow,
    source,
    point,
    onPlace,
    onReveal,
  })
  if (!action) return false
  announce(
    `${source.title} ${action === "moved" ? "moved on" : "shown on"} the canvas.`
  )
  return true
}

type WorkspaceParticlesControllerOptions = {
  state: WorkspaceParticleState | undefined
  sections: RoadmapSection[]
  organization?: ParticleOrganization
  activities?: ParticleActivity[]
  programs?: ParticleProgram[]
  calendarEvents?: ParticleCalendarEvent[]
  canEdit: boolean
  enabled: boolean
  pickDriveFiles: () => Promise<string[]>
  loadDriveDocuments?: () => Promise<ParticleDriveDocument[]>
  onChange: (next: WorkspaceParticleState) => void
  onPlaceCanvasNode?: (node: Node) => boolean
  onRevealCanvasNode?: (
    canvasNodeId: string,
    center?: { x: number; y: number }
  ) => boolean
}

export function useWorkspaceParticlesController({
  state: input,
  sections,
  organization,
  activities,
  programs,
  calendarEvents,
  canEdit,
  enabled,
  onChange,
  onPlaceCanvasNode,
  onRevealCanvasNode,
  pickDriveFiles,
  loadDriveDocuments,
}: WorkspaceParticlesControllerOptions) {
  const state = useMemo(() => normalizeWorkspaceParticleState(input), [input])
  const stateRef = useRef(state)
  stateRef.current = state
  const flow = useRef<ReactFlowInstance | null>(null)
  const canvas = useRef<HTMLElement | null>(null)
  const setFlow = useRefSetter(flow)
  const setCanvas = useRefSetter(canvas)
  const {
    sources: originalSources,
    driveStatus,
    refreshDrive,
    updateRoadmapSection,
  } = useParticleSources(
    sections,
    state.images,
    organization,
    activities,
    programs,
    calendarEvents,
    loadDriveDocuments
  )
  const sources = useMemo(
    () => [...originalSources, ...buildPlanParticleSources(state.plans ?? [])],
    [originalSources, state.plans]
  )
  const [uploading, setUploading] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const { nodes, onNodesChange } = useParticleNodes(
    state.items,
    sources,
    canEdit,
    enabled
  )
  const commit = useCallback(
    (next: WorkspaceParticleState) => {
      if (!canEdit || !enabled) return
      const normalized = normalizeWorkspaceParticleState({
        ...next,
        updatedAt: new Date().toISOString(),
      })
      stateRef.current = normalized
      onChange(normalized)
    },
    [canEdit, enabled, onChange]
  )
  const planner = useParticlePlanController(
    stateRef,
    commit,
    canEdit && enabled,
    flow
  )
  const add = useCallback(
    (
      ref: ParticleReference,
      point?: { x: number; y: number },
      image?: ParticleImage
    ) => {
      if (!canEdit || !enabled || !flow.current || !canvas.current) return false
      const source = sources.find(
        (entry) => particleSourceKey(entry.ref) === particleSourceKey(ref)
      )
      if (!image && !source?.available) return false
      const existingResult = activateExistingSource({
        flow: flow.current,
        source,
        point,
        onPlace: onPlaceCanvasNode,
        onReveal: onRevealCanvasNode,
        announce: setAnnouncement,
      })
      if (existingResult !== null) return existingResult
      const current = stateRef.current
      const existing = current.items.find(
        (item) => particleSourceKey(item.source) === particleSourceKey(ref)
      )
      if (existing) {
        void flow.current.fitView({
          nodes: [{ id: existing.id }],
          maxZoom: 1,
          duration: particleMotionDuration(250),
        })
        setAnnouncement(
          `${source?.title ?? image?.title ?? "Item"} is already on the canvas.`
        )
        return false
      }
      if (current.items.length >= PARTICLE_LIMIT) {
        toast.error("This canvas has reached its 100-particle limit.")
        return false
      }
      const bounds = canvas.current.getBoundingClientRect()
      const screenPoint = point ?? {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height * 0.3,
      }
      const position = flow.current.screenToFlowPosition(screenPoint)
      const size = particleDisplaySize(ref, "mini")
      const dimensions = PARTICLE_SIZES[size]
      const item = {
        id: `particle-${crypto.randomUUID()}`,
        source: ref,
        x: position.x - dimensions.width / 2,
        y: position.y - dimensions.height / 2,
        size,
      }
      commit({
        ...current,
        images: image ? [...current.images, image] : current.images,
        items: [...current.items, item],
      })
      setAnnouncement(
        `${source?.title ?? image?.title ?? "Item"} added to canvas.`
      )
      return true
    },
    [canEdit, enabled, sources, commit, onPlaceCanvasNode, onRevealCanvasNode]
  )
  const remove = useCallback(
    (id: string) => {
      commit(removeParticle(stateRef.current, id))
      setAnnouncement("Removed from canvas. The original is still available.")
    },
    [commit]
  )
  const resize = useCallback(
    (id: string, size: ParticleSize) => {
      commit({
        ...stateRef.current,
        items: stateRef.current.items.map((item) =>
          item.id === id ? resizeParticle(item, size) : item
        ),
      })
    },
    [commit]
  )
  const persistPositions = useCallback(
    (moved: Node[], point?: { x: number; y: number }) => {
      if (!canEdit) return
      const movedIds = new Map(
        moved
          .filter((node) => node.type === "workspace-particle")
          .map((node) => [node.id, node.position])
      )
      if (movedIds.size === 0) return
      const targets = point
        ? Array.from(
            document.querySelectorAll<HTMLElement>(
              "[data-particle-return-target]"
            )
          )
        : []
      const returned =
        point &&
        targets.some((target) => {
          const rect = target.getBoundingClientRect()
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top &&
            point.y <= rect.bottom
          )
        })
      if (returned) {
        commit(
          Array.from(movedIds.keys()).reduce(removeParticle, stateRef.current)
        )
        setAnnouncement("Returned to Particles. Original content is unchanged.")
      } else {
        if (!hasParticlePositionChanges(stateRef.current.items, movedIds))
          return
        commit({
          ...stateRef.current,
          items: stateRef.current.items.map((item) => {
            const position = movedIds.get(item.id)
            return position ? { ...item, x: position.x, y: position.y } : item
          }),
        })
      }
    },
    [canEdit, commit]
  )
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const ids = new Set(stateRef.current.items.map((item) => item.id))
      const own = changes.filter(
        (change) => "id" in change && ids.has(change.id)
      )
      onNodesChange(
        own.filter(
          (change) =>
            canEdit || change.type === "dimensions" || change.type === "select"
        )
      )
      const removed = own.filter((change) => change.type === "remove")
      const positioned = new Map(
        own.flatMap((change) =>
          change.type === "position" &&
          change.position &&
          change.dragging !== true
            ? [[change.id, change.position] as const]
            : []
        )
      )
      if (
        canEdit &&
        hasParticlePositionChanges(stateRef.current.items, positioned)
      ) {
        commit({
          ...stateRef.current,
          items: stateRef.current.items.map((item) => {
            const position = positioned.get(item.id)
            return position ? { ...item, ...position } : item
          }),
        })
      }
      if (canEdit && removed.length)
        commit(
          removed.reduce(
            (next, change) =>
              "id" in change ? removeParticle(next, change.id) : next,
            stateRef.current
          )
        )
    },
    [canEdit, commit, onNodesChange]
  )
  const connect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        connection.source === connection.target
      )
        return
      commit({
        ...stateRef.current,
        connections: [
          ...stateRef.current.connections,
          {
            id: "pending",
            source: connection.source,
            target: connection.target,
          },
        ],
      })
    },
    [commit]
  )
  const disconnect = useCallback(
    (id: string) => {
      commit({
        ...stateRef.current,
        connections: stateRef.current.connections.filter(
          (edge) => edge.id !== id
        ),
      })
    },
    [commit]
  )
  const uploadImage = useCallback(
    async (file: File) => {
      if (!canEdit || uploading) return
      if (
        stateRef.current.images.length >= PARTICLE_LIMIT ||
        stateRef.current.items.length >= PARTICLE_LIMIT
      ) {
        toast.error("This workspace has reached its image or particle limit.")
        return
      }
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > PARTICLE_IMAGE_MAX_BYTES
      ) {
        toast.error("Choose a PNG, JPG, or WebP image up to 4 MB.")
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.set("file", file)
        const response = await fetch("/api/workspace/particles/images", {
          method: "POST",
          body: form,
        })
        const result = await response.json()
        if (!response.ok || !result.image)
          throw new Error(result.error ?? "Image upload failed.")
        const image = result.image as ParticleImage
        if (!add({ kind: "image", id: image.id }, undefined, image)) {
          commit({
            ...stateRef.current,
            images: [...stateRef.current.images, image],
          })
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Image upload failed. Try again."
        )
      } finally {
        setUploading(false)
      }
    },
    [canEdit, uploading, add, commit]
  )
  return {
    ...planner,
    state,
    nodes,
    sources,
    canEdit: canEdit && enabled,
    flow,
    canvas,
    setFlow,
    setCanvas,
    driveStatus,
    refreshDrive,
    updateRoadmapSection,
    pickDriveFiles,
    add,
    remove,
    resize,
    persistPositions,
    onNodesChange: handleNodesChange,
    connect,
    disconnect,
    uploadImage,
    uploading,
    announcement,
  }
}

export type WorkspaceParticlesController = ReturnType<
  typeof useWorkspaceParticlesController
>
