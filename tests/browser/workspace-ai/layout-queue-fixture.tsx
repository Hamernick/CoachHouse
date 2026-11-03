import { useCallback, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Position, type Node, type ReactFlowInstance } from "@xyflow/react"
import { useParticleLayout } from "../../../src/features/workspace-particles/hooks/use-particle-layout"
import type { ParticleSession } from "../../../src/features/workspace-particles/hooks/use-particle-session"
import type { ParticleNodeData } from "../../../src/features/workspace-particles/components/particle-node"
import { createParticle, getParticleHandles } from "../../../src/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "../../../src/features/workspace-particles/lib/graph-validation"
import { applyParticleBatch } from "../../../src/features/workspace-particles/lib/graph-operations"
import type { ParticleBatch, ParticleGraph } from "../../../src/features/workspace-particles/types"

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const now = "2026-11-03T12:00:00.000Z"
const make = (value: number, type: "objective" | "activity" = "activity") => createParticle(type, { id: id(value), workspaceId: id(99), now })
const before = { ...emptyParticleGraph(id(99)), particles: [
  { ...make(1), positionMode: "manual" as const, position: { x: 0, y: 0 } },
  { ...make(2), locked: true, position: { x: 350, y: 0 } },
] }
const objective = make(3, "objective")
if (objective.type !== "objective") throw new Error("Invalid fixture")
objective.data.planning = { plans: [{ id: id(50), revision: 0, title: "Plan", particleIds: [id(4)] }], proposals: [] }
const saved: ParticleGraph = { ...before, revision: 1, particles: [...before.particles, objective, make(4)] }
const nodesFor = (graph: ParticleGraph) => graph.particles.map(particle => ({ id: particle.id, position: particle.position, data: { particle } })) as Node<ParticleNodeData>[]

function LayoutFixture() {
  const [graph, setGraph] = useState(before)
  const current = useRef<ParticleGraph>(before)
  const [nodes, setNodes] = useState(nodesFor(before))
  const currentNodes = useRef(nodes)
  currentNodes.current = nodes
  const [editable, setEditable] = useState(false)
  const [scope, setScope] = useState(0)
  const [commits, setCommits] = useState(0)
  const canvas = useRef({
    getNodes: () => currentNodes.current,
    getInternalNode: (nodeId: string) => {
      const node = currentNodes.current.find(item => item.id === nodeId)
      if (!node) return undefined
      const handles = getParticleHandles(node.data.particle)
      const bounds = (ids: readonly string[], target: boolean) => ids.map((handleId, index) => ({ id: handleId, nodeId, type: target ? "target" : "source", position: target ? Position.Left : Position.Right, x: target ? 0 : 280, y: 180 * (index + 1) / (ids.length + 1) - 4, width: 8, height: 8 }))
      return { ...node, measured: { width: 280, height: 180 }, internals: { positionAbsolute: node.position, handleBounds: { target: bounds(handles.inputs, true), source: bounds(handles.outputs, false) } } }
    },
  } as unknown as ReactFlowInstance)
  const commitBatch = useCallback(async (batch: ParticleBatch) => {
    if (scope) throw new Error("Queued layout crossed canvas scope")
    const value = await applyParticleBatch(current.current, batch, now)
    if (!value.ok) throw new Error(value.error)
    current.current = value.value.graph
    setGraph(value.value.graph)
    setCommits(count => count + 1)
    return value.value
  }, [scope])
  const layout = useParticleLayout({ session: { graph, editable, commitBatch, getCurrentGraph: () => current.current } as unknown as ParticleSession, flow: canvas, flush: async () => true, dirty: useRef(false), setNodes })
  return <main>
    <button onClick={() => { current.current = saved; layout.queueAfterSave(saved, [id(3), id(4)]) }}>Receive save receipt</button>
    <button onClick={() => setGraph(current.current)}>Render saved graph</button>
    <button onClick={() => setNodes(nodesFor(current.current))}>Project saved nodes</button>
    <button onClick={() => setEditable(true)}>Finish save render</button>
    <button onClick={() => setScope(value => value + 1)}>Switch canvas transport</button>
    <button onClick={layout.cancel}>Cancel queued layout</button>
    <output data-testid="layout-state">{JSON.stringify({ revision: graph.revision, editable, phase: layout.phase, message: layout.message, scope, commits, nodes: nodes.map(node => ({ id: node.id, position: node.position })), saved: graph.particles.map(particle => ({ id: particle.id, position: particle.position })) })}</output>
  </main>
}

function Fixture() {
  const [mounted, setMounted] = useState(true)
  return <><button onClick={() => setMounted(value => !value)}>Toggle layout mount</button>{mounted ? <LayoutFixture /> : <p>Unmounted</p>}</>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
