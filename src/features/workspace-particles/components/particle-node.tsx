"use client"

import { particleInspectionProps } from "./particle-surface"

import { WorkspaceConnectionHandle } from "@/components/workspace/workspace-connection-handle"

import type { Node as ReactFlowNode } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { protectWorkspaceControlDrag } from "@/lib/workspace-canvas/control-drag-boundary"
import { memo, useEffect, useMemo, useState } from "react"
import { Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react"

import { PARTICLE_HANDLE_SIDES } from "../lib/particle-handle-geometry"
import { particleHandleId } from "../lib/particle-handle-ids"
import { getParticleHandles } from "../lib/particle-registry"
import type { Particle } from "../types"
import type { ParticleCardAction } from "../lib/particle-card-actions"
import { ParticleResizeControl } from "./particle-resize-control"
import { ParticleCard } from "./particle-card"
import { ParticleMenuProvider } from "./particle-menu-overlay"

export type ParticleNodeData = {
  onUploadImage?: (id: string, files: File[]) => Promise<boolean>
  resize?: {
    begin: (id: string, size: { width: number; height: number }) => boolean
    preview: (id: string, size: { width: number; height: number }) => void
    finish: (
      id: string,
      size: { width: number; height: number },
      cancel?: boolean
    ) => Promise<void>
  }
  particle: Particle
  editable: boolean
  onOpen: (id: string, options?: { calendarEntryId?: string; view?: "details" | "share" }) => void
  onEdit: (particle: Particle) => void
  onAction?: (id: string, action: ParticleCardAction) => Promise<boolean>
}
const HANDLE_CLASS =
  "transition-opacity duration-150 motion-reduce:transition-none group-hover/particle-node:opacity-100 group-focus-within/particle-node:opacity-100 [@media(hover:none)]:opacity-100"

// React Flow owns position/drag props. Keep that high-frequency state outside
// the card contents and handles, which only depend on these three values.
export const ParticleNode = memo(function ParticleNode({
  id,
  data,
  selected,
}: NodeProps<ReactFlowNode<ParticleNodeData>>) {
  return <ParticleNodeContent id={id} data={data} selected={selected} />
})

const ParticleNodeContent = memo(function ParticleNodeContent({
  id,
  data,
  selected,
}: Pick<
  NodeProps<ReactFlowNode<ParticleNodeData>>,
  "id" | "data" | "selected"
>) {
  const { particle } = data
  const [menuOpen, setMenuOpen] = useState(false)
  const menuState = useMemo(() => ({ open: menuOpen, setOpen: setMenuOpen }), [menuOpen])
  const updateInternals = useUpdateNodeInternals()
  const handles = getParticleHandles(particle)
  useEffect(() => {
    updateInternals(id)
  }, [id, particle, updateInternals])
  return (
    <ParticleMenuProvider value={menuState}><div

      className="group/particle-node workspace-card-drag-handle relative h-full cursor-grab active:cursor-grabbing"
      onMouseDownCapture={protectWorkspaceControlDrag}
      onTouchStartCapture={protectWorkspaceControlDrag}
      onContextMenu={(event) => {
        if (!data.editable || (event.target instanceof Element && event.target.closest('input, textarea, button, a, [contenteditable="true"], [role="menu"], [role="dialog"]'))) return
        event.preventDefault()
        event.stopPropagation()
        setMenuOpen(true)
      }}
      data-particle-size={particle.size}
      {...particleInspectionProps(particle)}

    >
      <ParticleCard data={data} selected={selected} />
      {selected && <ParticleResizeControl id={id} data={data} />}
      {PARTICLE_HANDLE_SIDES.map((side) => (
        <WorkspaceConnectionHandle
          key={`in-${side}`}
          id={particleHandleId("in", side)}
          type="target"
          position={side}
          isConnectable={data.editable}
          aria-label="Connect to this Particle"
          title="Connect to this Particle"
          className={cn(HANDLE_CLASS, selected ? "opacity-100" : "opacity-0")}
        />
      ))}
      {PARTICLE_HANDLE_SIDES.flatMap((side) =>
        handles.outputs.map((handle, index) => (
          <WorkspaceConnectionHandle
            key={`${handle}-${side}`}
            id={particleHandleId(handle, side)}
            type="source"
            position={side}
            isConnectable={data.editable}
            aria-label={
              handle.startsWith("outcome:") && particle.type === "decision"
                ? `Connect outcome: ${particle.data.outcomes.find((item) => `outcome:${item.id}` === handle)?.label ?? handle}`
                : "Connect dependency"
            }
            title={
              handle.startsWith("outcome:") && particle.type === "decision"
                ? particle.data.outcomes.find(
                    (item) => `outcome:${item.id}` === handle
                  )?.label
                : "Connect dependency"
            }
            style={{
              [side === Position.Left || side === Position.Right
                ? "top"
                : "left"]:
                `${((index + 1) / (handles.outputs.length + 1)) * 100}%`,
            }}
            className={cn(HANDLE_CLASS, selected ? "opacity-100" : "opacity-0")}
          />
        ))
      )}
    </div></ParticleMenuProvider>
  )
})
