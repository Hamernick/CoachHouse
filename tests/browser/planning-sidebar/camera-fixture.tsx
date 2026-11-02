import { useMemo, useRef, useState } from "react"
import { ReactFlow, type Node, type ReactFlowInstance } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { useParticleSelection } from "@/features/workspace-particles/hooks/use-particle-selection"
import type { ParticleNodeData } from "@/features/workspace-particles/components/particle-node"
import { useWorkspaceCanvasCameraController } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/runtime/workspace-canvas-camera-controller"
import type { WorkspaceCanvasSceneFitRequest } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/runtime/workspace-canvas-viewport-command"
import { ParticleFocusedPreview } from "@/features/workspace-particles/components/particle-focused-preview"
import "@xyflow/react/dist/style.css"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const graph = emptyParticleGraph(id(900))
graph.particles = [1, 2].map(n => ({ ...createParticle("activity", { id: id(n), workspaceId: graph.workspaceId, title: `Card ${n}`, now: "2026-10-30T12:00:00Z" }), position: { x: (n - 1) * 1600, y: 100 } }))
const options = { padding: 0.2, minZoom: 0.5, maxZoom: 1, duration: 380 }
const initialNodeIds = graph.particles.map(item => item.id)
const noop = () => {}

export function CameraFixture() {
  const flow = useRef<ReactFlowInstance | null>(null)
  const [ready, setReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<Node<ParticleNodeData>[]>(() => graph.particles.map(particle => ({ id: particle.id, position: particle.position, data: { particle, label: particle.title, editable: false, onOpen: noop, onEdit: noop }, width: 240, height: 140 })))
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 0.7 })
  const [scene, setScene] = useState<WorkspaceCanvasSceneFitRequest>(null)
  const [obstructed, setObstructed] = useState(false)
  const [covered, setCovered] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const visibleNodeIds = useMemo(() => initialNodeIds.slice(0, initialNodeIds.length + refresh), [refresh])
  const dirty = useRef(false)
  const navigation = useParticleSelection({ graph, selectedId, selectParticle: setSelectedId, setNodes, dirty, flow })
  useWorkspaceCanvasCameraController({ flowInstanceRef: flow, isFlowReady: ready, visibleNodeIds, layoutFitRequestKey: 0, acceleratorFocusRequestKey: 0,
    focusCardRequest: null, tutorialCompletionExitRequest: null, sceneFitRequest: scene, layoutFitOptions: options, sceneFitOptions: options,
    acceleratorFocusOptions: options, focusCardOptions: options, suppressInitialFit: true, onTutorialCompletionExitHandled: noop })
  return <div className="h-dvh w-screen" data-workspace-canvas-flow-frame>
    <div data-workspace-canvas-occluder className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-32px)] flex-wrap gap-2">
      <Button disabled={!ready} onClick={() => navigation.focusCanvas(id(2))}>Focus distant card</Button>
      <Button disabled={!ready} onClick={() => navigation.select(id(1))}>Inspect first card</Button>
      <Button onClick={() => { setObstructed(true); setNodes(current => current.map(node => node.id === id(2) ? { ...node, width: 816, height: 600, style: { width: 816, height: 600 } } : node)) }}>Show measured focus obstacles</Button>
      <Button onClick={() => setCovered(true)}>Cover canvas</Button>
      <Button onClick={() => setRefresh(value => value + 1)}>Refresh camera inputs</Button>
      <Button onClick={() => setScene({ nodeIds: [id(2)], requestKey: Date.now(), signature: String(Date.now()), layoutKey: "fixture", x: 1700, y: 170, zoom: 1, delayMs: 300, duration: 0 })}>Queue delayed scene</Button>
    </div>
    {obstructed && <><aside data-testid="focus-island" data-workspace-canvas-occluder className="absolute left-0 top-32 z-10 h-20 w-full bg-card md:top-0 md:h-full md:w-[420px]" /><aside data-testid="focus-composer" data-workspace-canvas-occluder className="absolute inset-x-0 bottom-0 z-10 h-32 bg-card" /></>}
    {covered && <aside data-workspace-canvas-occluder className="pointer-events-none absolute inset-0 z-10 bg-card" />}
    {selectedId && navigation.inspectorView === "preview" && <div className="absolute inset-x-3 top-52 z-30 max-h-[calc(100dvh-14rem)] overflow-auto rounded-2xl bg-card shadow-lg">
      <ParticleFocusedPreview particle={graph.particles.find(item => item.id === selectedId)!} editable
        onOpen={calendarEntryId => navigation.select(selectedId, { view: "details", calendarEntryId })}
        onClose={() => navigation.select(null)} />
    </div>}
    <ReactFlow<Node> minZoom={0.2} nodes={nodes} edges={[]} defaultViewport={viewport} onInit={instance => { flow.current = instance; setReady(true) }} onMove={(_, value) => setViewport(value)} />
    <output data-testid="camera-viewport">{JSON.stringify(viewport)}</output>
    <output data-testid="camera-mode">{navigation.inspectorView}</output>
    <output data-testid="camera-inspector">{selectedId}</output>
  </div>
}
