import { useMemo } from "react"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import type { ParticleGraph } from "@/features/workspace-particles/types"
import { ReactFlow, type Node } from "@xyflow/react"
import { ParticleNode } from "@/features/workspace-particles/components/particle-node"
import { useParticleFlow } from "@/features/workspace-particles/hooks/use-particle-flow"
import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ParticleInspector } from "@/features/workspace-particles/components/particle-inspector"
import { ParticleResponsibilityPeople } from "@/features/workspace-particles/components/particle-responsibility-fields"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { useParticleSession, type ParticleTransport } from "@/features/workspace-particles/hooks/use-particle-session"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const nodeTypes = { "workspace-particle": ParticleNode }
const people = [{ id: id(701), name: "Alex Rivera" }, { id: id(702), name: "Sam Chen" }]
export function ResponsibilityFixture() {
  const [stored] = useState(() => {
    const saved = localStorage.getItem("responsibility-graph")
    if (saved) return JSON.parse(saved)
    if (localStorage.getItem("progress-fixture")) {
      const objective = createParticle("objective", { id: id(1), workspaceId: id(900), title: "Workshop", now: "2026-10-30T12:00:00Z" })
      if (objective.type !== "objective") throw new Error("Expected objective")
      const work = [10, 11, 12, 13].map(n => ({ ...createParticle("activity", { id: id(n), workspaceId: id(900), title: `Step ${n}`, now: "2026-10-30T12:00:00Z" }), status: n < 12 ? "done" as const : "backlog" as const, canvasHidden: true }))
      objective.data.planning = { plans: [{ id: id(20), revision: 0, title: "Preparation", particleIds: work.map(item => item.id) }], proposals: [] }
      return { ...emptyParticleGraph(id(900)), particles: [objective, ...work] }
    }
    if (localStorage.getItem("assignment-membership-fixture")) {
      const work = createParticle("activity", { id: id(10), workspaceId: id(900), title: "Shared step", now: "2026-10-30T12:00:00Z" })
      return { ...emptyParticleGraph(id(900)), particles: [work, ...[1, 2].map(n => {
        const objective = createParticle("objective", { id: id(n), workspaceId: id(900), title: n === 1 ? "Workshop" : "Outreach", now: "2026-10-30T12:00:00Z" })
        if (objective.type !== "objective") throw new Error("Expected objective")
        objective.canvasHidden = true
        objective.data.planning = { plans: [{ id: id(20), revision: 0, title: "Preparation", particleIds: [work.id] }], proposals: n === 1 ? [{ id: id(21), planId: id(20), baseRevision: 0, title: "Alternative", particleIds: [work.id], authorId: id(501), createdAt: "2026-10-30T12:00:00Z", status: "pending" }] : [] }
        return objective
      })] }
    }
    return { ...emptyParticleGraph(id(900)), particles: [createParticle("objective", { id: id(1), workspaceId: id(900), title: "Workshop", now: "2026-10-30T12:00:00Z" })] }
  })
  const server = useRef({ graph: stored, fail: false })
  const [owner, setOwner] = useState(true)
  const planningAccess = useMemo(() => ({ userId: id(501), workspaceId: id(900), isOrganizationOwner: owner, error: null }), [owner])
  const [canvas, setCanvas] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [available, setAvailable] = useState(people)
  const transport = useCallback<ParticleTransport>(async batch => {
    if (server.current.fail) return { ok: false, code: "unavailable", error: "Connection interrupted" }
    const prepared = await prepareAuthorizedParticleMutation({ input: batch, workspaceId: id(900), canEdit: true, now: new Date().toISOString(), planningActor: planningAccess })
    if (!prepared.ok) return prepared
    try {
      const value = prepared.value(server.current.graph)
      server.current.graph = value.graph
      localStorage.setItem("responsibility-graph", JSON.stringify(value.graph))
      return { ok: true, value }
    } catch (error) { return { ok: false, code: "scope", error: error instanceof Error ? error.message : "Save failed" } }
  }, [server, planningAccess])
  const load = useCallback(async () => ({ ok: true as const, value: server.current.graph }), [server])
  const session = useParticleSession({ workspaceId: id(900), stored, canEdit: true, transport, load })
  const flow = useParticleFlow({ workspaceId: id(900), session, canEdit: true, planningAccess })
  const flowRef = flow.flow
  const particle = session.graph!.particles[0]
  return <ParticleResponsibilityPeople value={available}>
    <div className="mx-auto max-w-xl p-4">
      <Button onClick={() => flow.walkthrough.start({ workspaceId: id(900), objectiveId: id(1), planId: id(20), proposalId: id(21) })}>Walk alternative</Button>
      <Button onClick={() => setOwner(value => !value)}>Toggle organization owner</Button>
      <Button onClick={() => {
        const graph = structuredClone(server.current.graph) as ParticleGraph
        const objective = graph.particles.find(item => item.type === "objective")
        if (objective?.type !== "objective") return
        objective.revision += 1; graph.revision += 1
        server.current.graph = graph; void session.retry()
      }}>Simulate plan change</Button>
      <Button onClick={() => {
        const graph = structuredClone(server.current.graph) as ParticleGraph
        for (const item of graph.particles) if (item.type === "objective") { item.data.planning = { plans: [], proposals: [] }; item.revision += 1 }
        graph.revision += 1; server.current.graph = graph; void session.retry()
      }}>Remove plan memberships</Button>
      <Button onClick={() => setCanvas(true)}>Show assignment canvas</Button>
      <Button onClick={() => { server.current.fail = !server.current.fail }}>Toggle connection failure</Button>
      <Button onClick={() => setAvailable([])}>Remove available people</Button>
      <Button onClick={() => void session.retry()}>Retry save</Button>
      {!canvas && <ParticleInspector particle={particle} canEditObjectiveProgress={owner} editable pending={session.pending} onSave={session.edit} onClose={() => {}} onDirtyChange={setDirty} />}
      <output className="sr-only" data-testid="responsibility-state">{JSON.stringify({ dirty, responsibility: particle.type === "objective" ? particle.responsibility : undefined })}</output>
    </div>
    {canvas && <div className="workspace-layout-surface relative h-[700px] w-full" data-workspace-canvas-flow-frame>
      <ReactFlow<Node> nodes={flow.nodes} edges={[]} nodeTypes={nodeTypes} className="workspace-flow" onInit={instance => { flowRef.current = instance }} onNodesChange={flow.onNodesChange} defaultViewport={{ x: 60, y: 60, zoom: 1 }} />
      <output className="sr-only" data-testid="rail-state">{JSON.stringify({ expanded: flow.expandedId, graph: session.graph })}</output>
    </div>}
  </ParticleResponsibilityPeople>
}
