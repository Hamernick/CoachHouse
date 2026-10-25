"use client"

import { useMemo, type DragEvent, type ClipboardEvent } from "react"
import {
  PARTICLE_DRAG_MIME,
  readParticleDrag,
  workspaceToolIdSchema,
  type useParticleFlow,
  type ParticleLibraryDragRequest,
  resolveLibraryImageParticle,
} from "@/features/workspace-particles/client"
import type { WorkspaceCanvasSurfaceV2ViewProps } from "./workspace-canvas-surface-v2-view-types"
import { buildWorkspaceToolLibrary } from "./workspace-tool-library"

type Input = Pick<
  WorkspaceCanvasSurfaceV2ViewProps,
  | "nodes"
  | "hiddenToolIds"
  | "onPlaceWorkspaceTool"
  | "libraryCardData"
  | "allowEditing"
  | "tutorialActive"
> & { particles: ReturnType<typeof useParticleFlow>; workspaceId: string }

export function useWorkspaceParticleLibrary({
  nodes,
  particles,
  workspaceId,
  hiddenToolIds,
  onPlaceWorkspaceTool,
  libraryCardData,
  allowEditing,
  tutorialActive,
}: Input) {
  const canPlace = allowEditing && !tutorialActive
  const tools = useMemo(
    () =>
      buildWorkspaceToolLibrary({
        workspaceId,
        cardData: libraryCardData,
        hiddenIds: hiddenToolIds,
        onPlace: (id, visible) => {
          if (canPlace) {
            const canvas = document
              .querySelector("[data-workspace-canvas-flow-frame]")
              ?.getBoundingClientRect()
            const position =
              visible && canvas && particles.flow.current
                ? particles.flow.current.screenToFlowPosition({
                    x: canvas.left + canvas.width / 2 - 140,
                    y: canvas.top + 80,
                  })
                : undefined
            onPlaceWorkspaceTool(id, visible, position)
          }
        },
      }),
    [
      workspaceId,
      libraryCardData,
      hiddenToolIds,
      onPlaceWorkspaceTool,
      canPlace,
      particles.flow,
    ]
  )
  const libraryNodes = useMemo(
    () =>
      nodes.map((node) => {
        const parsed = workspaceToolIdSchema.safeParse(node.id)
        if (!parsed.success || !("cardId" in node.data)) return node
        const id = parsed.data
        return {
          ...node,
          data: {
            ...node.data,
            onReturnToLibrary: canPlace
              ? () => onPlaceWorkspaceTool(id, false)
              : undefined,
          },
        }
      }),
    [nodes, canPlace, onPlaceWorkspaceTool]
  )
  return {
    tools,
    nodes: libraryNodes,
    async placeDragged(
      request: ParticleLibraryDragRequest,
      screenPosition: { x: number; y: number }
    ) {
      if (!canPlace || !particles.editable || !particles.flow.current)
        return false
      const position =
        particles.flow.current.screenToFlowPosition(screenPosition)
      if (request.kind === "preset") {
        if (request.particle.workspaceId !== workspaceId) return false
        const prepared = await resolveLibraryImageParticle(request.particle)
        return particles.controls.create(
          prepared.type,
          prepared.title,
          prepared,
          { position, inspect: false }
        )
      }
      if (request.drag.workspaceId !== workspaceId) return false
      if (request.drag.kind === "tool") {
        onPlaceWorkspaceTool(request.drag.id, true, position)
        return true
      }
      return particles.setPlacement(request.drag.id, true, position)
    },
    dragOver(event: DragEvent<HTMLDivElement>) {
      if (event.dataTransfer.types.includes("Files")) {
        event.preventDefault()
        event.dataTransfer.dropEffect =
          canPlace && particles.editable && !particles.images.pending
            ? "copy"
            : "none"
        return true
      }
      if (!event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) return false
      event.preventDefault()
      event.dataTransfer.dropEffect = canPlace ? "move" : "none"
      return true
    },
    drop(event: DragEvent<HTMLDivElement>) {
      if (event.dataTransfer.files.length) {
        event.preventDefault()
        event.stopPropagation()
        if (canPlace && particles.editable && particles.flow.current)
          void particles.images.upload(
            Array.from(event.dataTransfer.files),
            particles.flow.current.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            })
          )
        return true
      }
      if (!event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) return false
      event.preventDefault()
      event.stopPropagation()
      if (!canPlace || !particles.flow.current) return true
      const payload = readParticleDrag(
        event.dataTransfer.getData(PARTICLE_DRAG_MIME),
        workspaceId
      )
      if (!payload) return true
      const position = particles.flow.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      if (payload.kind === "tool")
        onPlaceWorkspaceTool(payload.id, true, position)
      else void particles.setPlacement(payload.id, true, position)
      return true
    },
    paste(event: ClipboardEvent<HTMLDivElement>) {
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input, textarea, [contenteditable=true], [role=textbox]"
        )
      )
        return
      const files = Array.from(event.clipboardData.files)
      if (!files.length) return
      event.preventDefault()
      if (canPlace && particles.editable) void particles.images.upload(files)
    },
  }
}
