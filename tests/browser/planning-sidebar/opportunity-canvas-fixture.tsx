import { useEffect, useMemo, useRef, useState } from "react"
import { ReactFlow, applyNodeChanges } from "@xyflow/react"
import { WorkspaceOpportunityPreview } from "@/features/workspace-finance/components/workspace-opportunity-preview"
import { protectWorkspaceControlDrag } from "@/lib/workspace-canvas/control-drag-boundary"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { reconcileParticleNode } from "@/features/workspace-particles/lib/particle-node-state"
import { createParticlePositionPersistence } from "@/features/workspace-particles/lib/position-persistence"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import "@xyflow/react/dist/style.css"

const workspaceId = "00000000-0000-4000-8000-000000000001"
const storageKey = "opportunity-canvas-graph"
function OpportunityNode() {
  return <div className="workspace-card-drag-handle bg-card p-4" onMouseDownCapture={protectWorkspaceControlDrag} onTouchStartCapture={protectWorkspaceControlDrag}>
    <WorkspaceOpportunityPreview organizationId={workspaceId} opportunityId={workspaceId} />
  </div>
}
const nodeTypes = { "workspace-particle": OpportunityNode }

export function OpportunityCanvasFixture() {
  const stored = useMemo(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved) as ReturnType<typeof emptyParticleGraph>
    const graph = emptyParticleGraph(workspaceId)
    const particle = createParticle("activity", { id: crypto.randomUUID(), workspaceId, title: "Workshop partnership", now: new Date().toISOString() })
    if (particle.type !== "activity") throw new Error("Expected activity")
    particle.position = { x: 70, y: 80 }
    particle.size = "large"
    particle.data.widget = { kind: "opportunity", organizationId: workspaceId, opportunityId: workspaceId }
    graph.particles.push(particle)
    return graph
  }, [])
  const graph = useRef(stored)
  const [nodes, setNodes] = useState(() => stored.particles.map(particle => reconcileParticleNode({
    particle, selectedId: null, movable: true, resizing: false, keepPosition: false,
    data: { particle, editable: true, onOpen: () => {}, onEdit: () => {} },
  })))
  const [positions] = useState(() => createParticlePositionPersistence({
    commit: async operation => {
      const result = await applyParticleBatch(graph.current, { id: crypto.randomUUID(), workspaceId, baseRevision: graph.current.revision, operations: [operation] }, new Date().toISOString())
      if (!result.ok) return false
      graph.current = result.value.graph
      localStorage.setItem(storageKey, JSON.stringify(graph.current))
      return true
    },
    settled: () => {},
    getRevision: id => graph.current.particles.find(item => item.id === id)?.revision,
  }))
  useEffect(() => () => positions.cancel(), [positions])
  return <div style={{ width: "100vw", height: "100dvh" }}>
    <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes}
      onNodesChange={changes => setNodes(current => applyNodeChanges(changes, current))}
      onNodeDragStart={(_, node) => positions.gesture(node.id, true)}
      onNodeDragStop={(_, node) => {
        positions.gesture(node.id, false)
        const particle = graph.current.particles.find(item => item.id === node.id)
        if (particle) positions.record(particle, node.position)
        void positions.flush()
      }} />
  </div>
}
