"use client"

import { useEffect } from "react"
import { useNodesState, type Node } from "reactflow"
import { PARTICLE_SIZES, particleSourceKey, particleDisplaySize } from "../lib"
import type { ParticlePlacement, ParticleSource } from "../types"

export type ParticleNodeData = {
  item: ParticlePlacement
  source: ParticleSource | undefined
  canEdit: boolean
}

export function useParticleNodes(
  items: ParticlePlacement[],
  sources: ParticleSource[],
  canEdit: boolean,
  enabled: boolean
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ParticleNodeData>([])
  useEffect(() => {
    setNodes((previous) => {
      if (!enabled) return []
      const byId = new Map(previous.map((node) => [node.id, node]))
      const sourcesByKey = new Map(
        sources.map((source) => [particleSourceKey(source.ref), source])
      )
      return items.map((item): Node<ParticleNodeData> => {
        const old = byId.get(item.id)
        return {
          ...old,
          id: item.id,
          type: "workspace-particle",
          position: old?.dragging ? old.position : { x: item.x, y: item.y },
          style: PARTICLE_SIZES[particleDisplaySize(item.source, item.size)],
          dragHandle: ".workspace-card-drag-handle",
          draggable: canEdit,
          connectable: canEdit,
          deletable: canEdit,
          data: {
            item,
            source: sourcesByKey.get(particleSourceKey(item.source)),
            canEdit,
          },
        }
      })
    })
  }, [items, sources, canEdit, enabled, setNodes])
  return { nodes, onNodesChange }
}
