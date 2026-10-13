"use client"

import { WorkspaceConnectionHandle } from "@/components/workspace/workspace-connection-handle"

import type { Node as ReactFlowNode } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { memo, useEffect } from "react"
import { Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { PARTICLE_HANDLE_SIDES } from "../lib/particle-handle-geometry"
import { particleHandleId } from "../lib/particle-handle-ids"
import { getParticleHandles } from "../lib/particle-registry"
import type { Particle } from "../types"
import { ParticleCard } from "./particle-card"

export type ParticleNodeData = {
  particle: Particle
  editable: boolean
  onOpen: (id: string) => void
  onEdit: (particle: Particle) => void
  onRemove?: (id: string) => void
}
const HANDLE_CLASS =
  "transition-opacity duration-150 motion-reduce:transition-none group-hover/particle-node:opacity-100 group-focus-within/particle-node:opacity-100 [@media(hover:none)]:opacity-100"

export const ParticleNode = memo(function ParticleNode({
  id,
  data,
  selected,
}: NodeProps<ReactFlowNode<ParticleNodeData>>) {
  const { particle } = data
  const updateInternals = useUpdateNodeInternals()
  const handles = getParticleHandles(particle)
  useEffect(() => {
    updateInternals(id)
  }, [id, particle, updateInternals])
  return (
    <div
      className="group/particle-node workspace-card-drag-handle cursor-grab active:cursor-grabbing"
      {...getReactGrabOwnerProps({
        ownerId: `particle:${particle.id}`,
        component: "ParticleNode",
        source: "src/features/workspace-particles/components/particle-node.tsx",
        slot: "node",
      })}
    >
      <ParticleCard data={data} selected={selected} />
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
    </div>
  )
})
