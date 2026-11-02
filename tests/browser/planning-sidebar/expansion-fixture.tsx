import { useCallback, useState } from "react"
import { ReactFlow, type Node } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { ParticleNode } from "@/features/workspace-particles/components/particle-node"
import { ParticleFocusedPreview } from "@/features/workspace-particles/components/particle-focused-preview"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { useParticleSession, type ParticleTransport } from "@/features/workspace-particles/hooks/use-particle-session"
import { useParticleFlow } from "@/features/workspace-particles/hooks/use-particle-flow"
import { useWorkspaceParticleFlowHandlers } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-particle-flow-handlers"
import "@xyflow/react/dist/style.css"

const id = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`
const nodeTypes = { "workspace-particle": ParticleNode }
const toolIds: string[] = []
const noop = () => {}
export function ExpansionFixture() {
  const [stored, setStored] = useState(() => {
    const graph = emptyParticleGraph(id(900))
    graph.particles = [1, 2].map(n => {
      const card = createParticle("activity", { id: id(n), workspaceId: graph.workspaceId, title: `Inspection ${n}`, now: "2026-10-30T12:00:00Z" })
      if (card.type !== "activity") throw Error("Expected activity")
      card.position = { x: 60 + (n - 1) * 680, y: 200 }
      card.data.steps = Array.from({ length: 8 }, (_, i) => ({ id: id(n * 10 + i), title: `Item ${i + 1}`, order: i, status: "backlog" as const }))
      return card
    })
    return graph
  })
  const [server] = useState(() => ({ graph: stored, writes: 0 }))
  const transport = useCallback<ParticleTransport>(async batch => {
    server.writes++
    const result = await applyParticleBatch(server.graph, batch, new Date().toISOString())
    if (result.ok) server.graph = result.value.graph
    return result
  }, [server])
  const load = useCallback(async () => ({ ok: true as const, value: server.graph }), [server])
  const session = useParticleSession({ workspaceId: stored.workspaceId, stored, canEdit: true, transport, load })
  const particles = useParticleFlow({ workspaceId: stored.workspaceId, session, canEdit: true, visibleToolIds: toolIds })
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: window.innerWidth < 600 ? 0.7 : 1 })
  const [overlayMoved, setOverlayMoved] = useState(false)
  const [covered, setCovered] = useState(false)
  const handlers = useWorkspaceParticleFlowHandlers(particles, { onNodesChange: noop, onNodeClick: noop, onKeyDownCapture: noop, onNodeDragStop: noop, onSelectionDragStop: noop, onInit: noop })
  return <div className="workspace-layout-surface relative h-dvh w-screen" data-workspace-canvas-flow-frame onKeyDownCapture={handlers.onKeyDownCapture}>
    <div data-workspace-canvas-occluder className="absolute top-4 left-4 z-20 flex gap-2">
      <Button onClick={() => setCovered(value => !value)}>Toggle overlay</Button>
      <Button onClick={() => setOverlayMoved(value => !value)}>Move overlay</Button>
      <Button onClick={() => void particles.flow.current?.setViewport({ x: -200, y: 0, zoom: 1 }, { duration: 240 })}>Pan canvas</Button>
      <Button onClick={() => { const next = structuredClone(server.graph); next.revision++; next.particles[0].position = { x: 100, y: 220 }; next.particles[0].revision++; server.graph = next; setStored(next) }}>Collaborator moves card</Button>
      <Button onClick={() => { particles.select(id(1)); particles.setDirty(true) }}>Open dirty editor</Button>
    </div>
    <aside data-testid="moving-overlay" data-workspace-canvas-occluder className="pointer-events-none absolute top-36 left-[2000px] z-10 h-96 w-72 bg-muted transition-transform duration-500 motion-reduce:transition-none" style={{ transform: overlayMoved ? "translateX(-2000px)" : "translateX(0)" }} />
    {covered && <aside data-workspace-canvas-occluder className="pointer-events-none absolute top-36 left-0 z-10 h-96 w-72 bg-muted" />}
    {particles.selected && <div className="absolute inset-x-3 top-20 z-30 max-h-[calc(100dvh-6rem)] overflow-auto rounded-xl bg-card">
      {particles.inspectorView === "preview" ? <ParticleFocusedPreview particle={particles.selected} editable onOpen={() => particles.select(particles.selectedId)} onClose={() => particles.select(null)} /> : <section aria-label="Source editor"><Button onClick={() => { particles.setDirty(false); particles.select(null) }}>Close editor</Button></section>}
    </div>}
    <ReactFlow<Node> nodes={particles.nodes} edges={[]} nodeTypes={nodeTypes} className="workspace-flow" onInit={handlers.onInit} onNodesChange={handlers.onNodesChange} onNodeClick={handlers.onNodeClick} onNodeDragStop={handlers.onNodeDragStop} onMove={(_, value) => setViewport(value)} defaultViewport={viewport} />
    <output data-testid="inspection-state">{JSON.stringify({ expanded: particles.expandedId, selected: particles.selectedId, mode: particles.inspectorView, writes: server.writes, viewport, positions: session.graph?.particles.map(p => p.position) })}</output>
  </div>
}
