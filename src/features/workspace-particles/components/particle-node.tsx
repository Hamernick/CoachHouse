"use client"

import type { MembershipResponsibility } from "../lib/particle-membership-responsibility"
import type { ParticleResponsibility } from "../lib/particle-responsibility"
import { ParticleAssignmentRail } from "./particle-assignment-rail"
import { particleAssignmentHeight } from "../lib/particle-assignment-geometry"
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
import { ParticleInspectionActions } from "./particle-inspection-actions"
import { ParticleCard } from "./particle-card"
import { ParticleMenuProvider } from "./particle-menu-overlay"

export type ParticleNodeData = {
  objectiveProgress?: import("../lib/particle-progress").ObjectiveProgress
  memberships?: MembershipResponsibility[]
  assignmentContext?: string
  assignment?: { retry?: (id: string, scope: MembershipResponsibility | undefined, value: ParticleResponsibility) => Promise<boolean>; saveMembership?: (id: string, scope: MembershipResponsibility, value: ParticleResponsibility) => Promise<boolean>; save: (particle: Particle) => Promise<boolean>; onDirtyChange: (id: string, dirty: boolean) => void }
  /** Personal animation reservation; never part of the persisted Particle. */
  inspectionTransition?: { width: number; height: number }
  expanded?: boolean
  onExpand?: (id: string) => boolean
  onCollapse?: () => void
  exiting?: boolean
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
  const railHeight = particleAssignmentHeight(particle, Boolean(data.memberships))
  const [menuOpen, setMenuOpen] = useState(false)
  const menuState = useMemo(() => ({ open: menuOpen, setOpen: setMenuOpen }), [menuOpen])
  const updateInternals = useUpdateNodeInternals()
  const handles = getParticleHandles(particle)
  // React Flow observes card dimensions. Only changed handle IDs/order need
  // explicit measurement; position saves must not remeasure every card.
  const handleSignature = handles.outputs.join("|")
  useEffect(() => {
    updateInternals(id)
  }, [id, handleSignature, railHeight, updateInternals])
  useEffect(() => {
    if (data.expanded) document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"] [data-particle-collapse]`)?.focus({ preventScroll: true })
  }, [data.expanded, id])
  return (
    <ParticleMenuProvider value={menuState}><div className="h-full" inert={data.exiting} aria-hidden={data.exiting || undefined}><div
      style={railHeight ? { height: `calc(100% - ${railHeight}px)` } : undefined}

      className="group/particle-node workspace-card-drag-handle relative h-full cursor-grab active:cursor-grabbing motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      inert={data.exiting}
      aria-hidden={data.exiting || undefined}
      onMouseDownCapture={protectWorkspaceControlDrag}
      onTouchStartCapture={protectWorkspaceControlDrag}
      onContextMenu={(event) => {
        if (!data.editable || (event.target instanceof Element && event.target.closest('input, textarea, button, a, [contenteditable="true"], [role="menu"], [role="dialog"]'))) return
        event.preventDefault()
        event.stopPropagation()
        setMenuOpen(true)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && data.expanded && !event.defaultPrevented && !(event.target instanceof Element && event.target.closest('[role="menu"], [role="dialog"], input, textarea, select'))) {
          event.preventDefault()
          event.stopPropagation()
          data.onCollapse?.()
        }
      }}
      data-particle-expanded={data.expanded || undefined}
      data-particle-size={particle.size ?? "medium"}
      {...particleInspectionProps(particle)}

    >
      <ParticleCard data={data.expanded ? { ...data, editable: false } : data} selected={selected} headerAction={data.onExpand && <ParticleInspectionActions data={data} />} />
      {selected && !data.expanded && <ParticleResizeControl id={id} data={data} />}
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
    </div>{railHeight > 0 && <ParticleAssignmentRail data={data} />}</div></ParticleMenuProvider>
  )
})
