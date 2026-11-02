import { useEffect, useRef, useState } from "react"
import { ReactFlow, Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import type { ParticlePlacementViewport } from "@/features/workspace-particles/lib/particle-placement-viewport"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { reconcileParticleNode } from "@/features/workspace-particles/lib/particle-node-state"
import { animateParticleNodes } from "@/features/workspace-particles/lib/particle-node-transition"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import { ParticlePlanningGuides } from "@/features/workspace-particles/components/particle-planning-guides"
import { useParticleCreate } from "@/features/workspace-particles/hooks/use-particle-create"
import { useParticlePlans, type PlanningControls } from "@/features/workspace-objectives/hooks/use-particle-plans"
import type { ParticleNodeData } from "@/features/workspace-particles/components/particle-node"
import type { Particle, ParticleOperation } from "@/features/workspace-particles/types"
import "@xyflow/react/dist/style.css"

const org = "00000000-0000-4000-8000-000000000001"
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const make = (n: number, type: Particle["type"], title: string) => createParticle(type, { id: id(n), workspaceId: org, title, now: "2026-10-26T12:00:00Z" })
function Card({ data }: NodeProps<Node<ParticleNodeData>>) {
  return <div inert={data.exiting} aria-hidden={data.exiting || undefined} className="h-full rounded-xl border bg-card p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
    <Handle type="target" position={Position.Left} id="in" />{data.particle.title}<Handle type="source" position={Position.Right} id="out" />
  </div>
}
const nodeTypes = { "workspace-particle": Card }
export function PlacementFixture() {
  const [graph, setGraph] = useState(() => {
    const graph = emptyParticleGraph(org)
    const objective = make(10, "objective", "Workshop")
    if (objective.type !== "objective") throw new Error("Expected objective")
    objective.position = { x: 100, y: 100 }
    objective.data.planning = { plans: [{ id: id(11), title: "Preparation", revision: 0, particleIds: [] }], proposals: [] }
    graph.particles.push(objective, { ...make(12, "activity", "Manually placed"), position: { x: 644, y: 500 }, positionMode: "manual" })
    return graph
  })
  const current = useRef(graph); current.current = graph
  const flow = useRef<ParticlePlacementViewport | null>(null)
  const [nodes, setNodes] = useState<Node<ParticleNodeData>[]>([])
  const live = useRef(nodes); live.current = nodes
  const commit = async (operations: ParticleOperation[]) => {
    const previous = current.current
    const result = await applyParticleBatch(previous, { id: crypto.randomUUID(), workspaceId: org, baseRevision: previous.revision, operations }, new Date().toISOString())
    if (!result.ok) throw new Error(result.error)
    current.current = result.value.graph; setGraph(result.value.graph)
    localStorage.setItem("placement-graph", JSON.stringify(result.value.graph))
    return true
  }
  const add: PlanningControls["add"] = async (_type, _title, position, prepared, options) => prepared ? commit([{ kind: "put_particle", particle: { ...prepared, position, positionMode: options?.positionMode ?? "manual" }, expectedRevision: null }]) : false
  const create = useParticleCreate({ add, getCurrentGraph: () => current.current, flow, dirty: { current: false } })
  const controls = { graph, flow, getCurrentGraph: () => current.current, commit, create } as PlanningControls
  const actions = useParticlePlans({ userId: org, organizationId: org }, controls)
  useEffect(() => {
    const next = graph.particles.filter(particle => !particle.canvasHidden).map(particle => reconcileParticleNode({ old: live.current.find(node => node.id === particle.id), particle, selectedId: null, movable: true, resizing: false, keepPosition: false, data: { particle, editable: true, onOpen: () => {}, onEdit: () => {} } }))
    return animateParticleNodes(live.current, next, setNodes, () => false)
  }, [graph])
  const attach = () => {
    const objective = current.current.particles.find(particle => particle.type === "objective")!
    if (objective.type !== "objective") return
    const item = current.current.particles.find(particle => particle.title === "Unassigned item")!
    const plan = objective.data.planning!.plans[0]
    void actions.savePlan(objective, { ...plan, particleIds: [...plan.particleIds, item.id] })
  }
  return <div className="h-dvh w-screen" data-workspace-canvas-flow-frame>
    <div className="absolute left-4 top-4 z-10 flex gap-2">
      <Button onClick={() => void create("activity", "Unassigned item", undefined, { inspect: false })}>Add unassigned</Button>
      <Button disabled={!graph.particles.some(item => item.title === "Unassigned item")} onClick={attach}>Attach to plan</Button>
      <Button onClick={() => { const item = current.current.particles.find(item => item.title === "Unassigned item"); if (item) void commit([{ kind: "put_particle", particle: { ...item, canvasHidden: true }, expectedRevision: item.revision }]) }}>Remove item</Button>
    </div>
    <ReactFlow nodes={nodes} edges={particleConnectionsToFlow(graph)} nodeTypes={nodeTypes} onInit={instance => { flow.current = instance }} defaultViewport={{ x: 100, y: 100, zoom: 0.55 }}>
      <ParticlePlanningGuides graph={graph} />
    </ReactFlow>
  </div>
}
