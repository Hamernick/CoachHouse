"use client"

import { useMemo, type DragEvent } from "react"
import {
  PARTICLE_DRAG_MIME,
  readParticleDrag,
  workspaceToolIdSchema,
  type useParticleFlow,
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
    dragOver(event: DragEvent<HTMLDivElement>) {
      if (!event.dataTransfer.types.includes(PARTICLE_DRAG_MIME)) return false
      event.preventDefault()
      event.dataTransfer.dropEffect = canPlace ? "move" : "none"
      return true
    },
    drop(event: DragEvent<HTMLDivElement>) {
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
  }
}
