import { Profiler, useCallback, useRef, useState } from "react"
import { ReactFlow, type Node, type NodeChange } from "@xyflow/react"
import { ParticleNode } from "@/features/workspace-particles/components/particle-node"
import { ParticleEdge } from "@/features/workspace-particles/components/particle-edge"
import { ParticleGeometryObserver } from "@/features/workspace-particles/components/particle-layout-controls"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { useParticleSession, type ParticleTransport } from "@/features/workspace-particles/hooks/use-particle-session"
import { useParticleFlow } from "@/features/workspace-particles/hooks/use-particle-flow"
import { WorkspaceObjectivesIsland } from "@/features/workspace-objectives/components/workspace-objectives-island"
import type { PlanningControls } from "@/features/workspace-objectives/hooks/use-particle-plans"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance/types"

const nodeTypes = { "workspace-particle": ParticleNode }
const edgeTypes = { "workspace-particle": ParticleEdge }
const toolIds: string[] = []
const metrics = { planningMs: 0, nodeUpdates: 0, saves: 0 }

export function LoadFixture({ controls, finance }: { controls: PlanningControls; finance: WorkspaceFinanceInput }) {
  const [stored] = useState(() => {
    const graph = structuredClone(controls.graph!)
    graph.particles.forEach(particle => { particle.canvasHidden = true })
    const cards = Array.from({ length: 200 }, (_, i) => {
      const particle = createParticle("activity", { id: `00000000-0000-4000-8001-${String(i).padStart(12, "0")}`, workspaceId: graph.workspaceId, title: `Load card ${i + 1}`, now: "2026-10-27T12:00:00Z" })
      if (particle.type !== "activity") throw Error("Expected activity")
      particle.position = { x: 450 + i % 8 * 440, y: 140 + Math.floor(i / 8) * 240 }
      particle.data.steps = [0, 1, 2].map(step => ({ id: `00000000-0000-4000-8002-${String(i * 3 + step).padStart(12, "0")}`, title: `Task ${step + 1}`, order: step, status: step === 0 ? "done" : "backlog" }))
      return particle
    })
    graph.particles.push(...cards)
    graph.connections = cards.slice(1).map((card, i) => ({ id: `00000000-0000-4000-8003-${String(i).padStart(12, "0")}`, source: cards[i].id, target: card.id, sourceHandle: "out", targetHandle: "in", relationship: "sequence", revision: 0 }))
    graph.connections.push({ id: "00000000-0000-4000-8003-000000000999", source: cards[0].id, target: cards[5].id, sourceHandle: "out", targetHandle: "in", relationship: "related_resource", revision: 0 })
    return graph
  })
  const server = useRef({ graph: stored })
  const transport = useCallback<ParticleTransport>(async batch => {
    const result = await applyParticleBatch(server.current.graph, batch, new Date().toISOString())
    if (result.ok) {
      server.current.graph = result.value.graph
      metrics.saves++
      const card = server.current.graph.particles.find(particle => particle.id === "00000000-0000-4000-8001-000000000000")!
      localStorage.setItem("drag-load-position", JSON.stringify({ id: card.id, position: card.position }))
    }
    return result
  }, [server])
  const load = useCallback(async () => ({ ok: true as const, value: server.current.graph }), [server])
  const session = useParticleSession({ workspaceId: stored.workspaceId, stored, canEdit: true, transport, load })
  const particles = useParticleFlow({ workspaceId: stored.workspaceId, session, canEdit: true, visibleToolIds: toolIds })
  const { flow: flowRef } = particles
  const onNodesChange = (changes: NodeChange[]) => {
    metrics.nodeUpdates++
    particles.onNodesChange(changes)
  }
  Object.assign(window, { dragLoadMetrics: metrics, resetDragLoadMetrics: () => Object.assign(metrics, { planningMs: 0, nodeUpdates: 0, saves: 0 }) })
  return <div className="workspace-layout-surface relative" style={{ height: "100dvh", width: "100vw" }}>
    <div className="pointer-events-none absolute inset-0 z-10">
      <Profiler id="planning" onRender={(_, __, actualDuration) => { metrics.planningMs += actualDuration }}>
        <WorkspaceObjectivesIsland scope={{ userId: stored.workspaceId, organizationId: stored.workspaceId }} particles={particles.controls} finance={finance} />
      </Profiler>
    </div>
    <ReactFlow<Node> nodes={particles.nodes} edges={particles.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} className="workspace-flow" onlyRenderVisibleElements={!particles.layout.measureAll} onInit={instance => { flowRef.current = instance }} onNodesChange={onNodesChange} onNodeDragStop={(_, node) => void particles.move([node])}>
      <ParticleGeometryObserver onChange={particles.layout.geometryChanged} />
    </ReactFlow>
  </div>
}
