import { ParticleResponsibilityPeople } from "@/features/workspace-particles/client"
import { ResponsibilityFixture } from "./responsibility-fixture"
import { useParticleSelection } from "@/features/workspace-particles/hooks/use-particle-selection"
import type { Node, ReactFlowInstance } from "@xyflow/react"
import type { ParticleNodeData } from "@/features/workspace-particles/components/particle-node"
import { useParticleCreate } from "@/features/workspace-particles/hooks/use-particle-create"
import { useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"
import { ParticleObjectivesIsland } from "@/features/workspace-objectives/components/particle-objectives-island"
import type { PlanningControls } from "@/features/workspace-objectives/hooks/use-particle-plans"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance/types"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { emptyParticleGraph } from "@/features/workspace-particles/lib/graph-validation"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import type { Particle, ParticleGraph, ParticleOperation } from "@/features/workspace-particles/types"
import { ExpansionFixture } from "./expansion-fixture"
import { CameraFixture } from "./camera-fixture"
import { PlacementFixture } from "./placement-fixture"
import { OverlayFixture } from "./overlay-fixture"
import { OpportunityCanvasFixture } from "./opportunity-canvas-fixture"
import { DragPerformanceFixture } from "./drag-performance-fixture"
import { LoadFixture } from "./load-fixture"
import { LoadingFixture } from "./loading-fixture"
import "@/app/globals.css"

const org = "00000000-0000-4000-8000-000000000001"
const graph = emptyParticleGraph(org)
const objectiveCount = Math.max(1, Math.min(16, Number(localStorage.getItem("objective-fixture-count") ?? 16)))
for (let i = 0; i < objectiveCount; i++) {
  const objective = createParticle("objective", { id: `00000000-0000-4000-8000-${String(i + 100).padStart(12, "0")}`, workspaceId: org, title: i === 0 ? "Community workshop" : `Objective ${i + 1}`, now: "2026-10-26T12:00:00Z" })
  if (objective.type !== "objective") throw new Error("Invalid objective")
  objective.status = i === 1 ? "done" : i === 2 ? "blocked" : "backlog"
  if (i === 0) {
    const resource = createParticle("activity", { id: "00000000-0000-4000-8000-000000000002", workspaceId: org, title: "Confirm the venue and accessibility requirements", now: "2026-10-26T12:00:00Z" })
    resource.status = "in_progress"
    const outreach = createParticle("activity", { id: "00000000-0000-4000-8000-000000000004", workspaceId: org, title: "Invite community partners", now: "2026-10-26T12:00:00Z" })
    graph.particles.push(resource, outreach)
    objective.data.planning = { plans: [{ id: "00000000-0000-4000-8000-000000000003", title: "Workshop preparation", revision: 0, particleIds: [resource.id, outreach.id] }], proposals: [] }
  }
  graph.particles.push(objective)
}
if (localStorage.getItem("membership-fixture")) {
  const objective = graph.particles.find(item => item.type === "objective")
  if (objective?.type === "objective" && objective.data.planning) objective.data.planning.plans.push({ id: "00000000-0000-4000-8000-000000000009", title: "Another plan", revision: 0, particleIds: ["00000000-0000-4000-8000-000000000002"] })
}
function Fixture() {
  const [responsibility, setResponsibility] = useState(false)
  const [expansion, setExpansion] = useState(() => localStorage.getItem("fixture-near-cap") === "1")
  const [camera, setCamera] = useState(false)
  const [loadCanvas, setLoadCanvas] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [dragPerformance, setDragPerformance] = useState(false)
  const [placement, setPlacement] = useState(false)
  const [overlaySamples, setOverlaySamples] = useState(false)
  const [opportunityCanvas, setOpportunityCanvas] = useState(false)
  const [current, setCurrent] = useState<ParticleGraph>(() => localStorage.getItem("membership-fixture") && localStorage.getItem("membership-graph") ? JSON.parse(localStorage.getItem("membership-graph")!) : graph)
  const currentRef = useRef(current); currentRef.current = current
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [navigationNodes, setNavigationNodes] = useState<Node<ParticleNodeData>[]>(() => graph.particles.map(particle => ({ id: particle.id, position: particle.position, data: { particle } as ParticleNodeData })))
  const navigationNodesRef = useRef(navigationNodes); navigationNodesRef.current = navigationNodes
  const viewport = useRef({ x: 40, y: 70, zoom: 0.8 })
  const dirty = useRef(false)
  const flow = useRef({
    getNodes: () => navigationNodesRef.current,
    getNode: (id: string) => navigationNodesRef.current.find(node => node.id === id),
    getViewport: () => ({ ...viewport.current }), getZoom: () => viewport.current.zoom,
    setCenter: async (x: number, y: number, options: { zoom: number; duration: number }) => {
      viewport.current = { x: -x, y: -y, zoom: options.zoom }
      localStorage.setItem("navigation-viewport", JSON.stringify(viewport.current))
      localStorage.setItem("navigation-duration", String(options.duration)); return true
    },
    setViewport: async (value: typeof viewport.current) => { viewport.current = value; localStorage.setItem("returned-viewport", JSON.stringify(value)); return true },
    screenToFlowPosition: (point: {x:number;y:number}) => ({x:point.x-8,y:point.y-66}),
  } as unknown as ReactFlowInstance)
  const navigation = useParticleSelection({ graph: current, selectedId, selectParticle: setSelectedId, setNodes: setNavigationNodes, dirty, flow,
    getSelectedIds: () => navigationNodesRef.current.filter(node => node.selected).map(node => node.id) })
  const canvasSelectedId = navigationNodes.find(node => node.selected)?.id ?? null
  const [canEdit, setCanEdit] = useState(true)
  const commit = async (operations: ParticleOperation[]) => {
    if (localStorage.getItem("membership-save-failure")) return false
    const previous = currentRef.current
    const result = await applyParticleBatch(previous, { id: crypto.randomUUID(), workspaceId: org, baseRevision: previous.revision, operations }, new Date().toISOString())
    if (!result.ok) throw new Error(result.error)
    currentRef.current = result.value.graph; setCurrent(result.value.graph);
    if (localStorage.getItem("membership-fixture")) localStorage.setItem("membership-graph", JSON.stringify(result.value.graph))
    return true
  }
  const controls = { graph: current, canEdit, pending: false, error: null, selectedId, getCurrentGraph: () => currentRef.current, commit,
    ...navigation, flow, canvasSelectedId,
    deleteObjective: async (id: string) => {
      if (localStorage.getItem("fail-objective-delete")) return false
      const objective = currentRef.current.particles.find(item => item.id === id)
      return objective ? commit([{ kind: "remove_particle", id, expectedRevision: objective.revision }]) : false
    },
    add: async (_: string, __: string, position: { x: number; y: number }, particle: Particle, options?: { positionMode?: "manual" | "managed" }) => commit([{ kind: "put_particle", particle: { ...particle, position, positionMode: options?.positionMode ?? particle.positionMode }, expectedRevision: null }]),
    edit: async (particle: Particle) => commit([{ kind: "put_particle", particle, expectedRevision: particle.revision }]),
    retry: async () => true, layout: { run: async () => true },
  } as unknown as PlanningControls
  controls.create = useParticleCreate({ add: controls.add, dirty: { current: false }, flow: { current: null }, getCurrentGraph: () => currentRef.current })
  const extraOpportunities = JSON.parse(localStorage.getItem("opportunity-fixtures") ?? "[]")
  const statuses = JSON.parse(localStorage.getItem("fixture-opportunity-statuses") ?? "{}")
  const opportunityOrder: string[] = JSON.parse(localStorage.getItem("fixture-opportunity-order") ?? "[]")
  const finance = { opportunitiesState: localStorage.getItem("opportunities-error") ? "error" : "ready", opportunities: [{ id: "00000000-0000-4000-8000-000000000050", title: "Community partnership", origin: "manual", status: "new", source: "Local foundation", report: { version: 1, blocks: [] } }, ...extraOpportunities] } as WorkspaceFinanceInput
  finance.opportunities = finance.opportunities?.map((item, index) => ({ ...item, feedPosition: opportunityOrder.includes(item.id) ? opportunityOrder.indexOf(item.id) + 1 : index + 100, status: statuses[item.id] ?? item.status })).filter(item => item.status !== "dismissed")
  if (responsibility) return <ResponsibilityFixture />
  if (expansion) return <ExpansionFixture />
  if (camera) return <CameraFixture />
  if (loadCanvas) return <LoadFixture controls={controls} finance={finance} />
  if (loadingDemo) return <LoadingFixture />
  if (placement) return <PlacementFixture />
  if (overlaySamples) return <OverlayFixture />
  if (dragPerformance) return <DragPerformanceFixture />
  if (opportunityCanvas) return <OpportunityCanvasFixture />
  return <><button onClick={() => setPlacement(true)}>Show placement canvas</button><main style={{ height: "100dvh", background: "var(--muted)", color: "var(--foreground)", padding: 8 }}>
    <div style={{ height: 42, display: "flex", gap: 8 }}><button onClick={() => setOverlaySamples(true)}>Show overlay samples</button><button onClick={() => setCanEdit(!canEdit)}>Toggle editing</button><button onClick={() => document.documentElement.classList.toggle("dark")}>Toggle theme</button></div>
    <div data-testid="planning-canvas" data-workspace-canvas-flow-frame style={{ position: "relative", width: "100%", height: "calc(100% - 90px)" }}><div className="react-flow" data-testid="opportunity-drop-canvas" style={{ position: "absolute", inset: 0 }} /><ParticleObjectivesIsland scope={{ userId: org, organizationId: org }} controls={controls} finance={finance} /></div>
    <button onClick={() => setResponsibility(true)}>Show responsibility fixture</button>
    <button onClick={() => setExpansion(true)}>Show expansion fixture</button>
    <button onClick={() => setCamera(true)}>Show camera fixture</button>
    <button onClick={() => setDragPerformance(true)}>Show drag performance canvas</button>
    <button onClick={() => setLoadingDemo(true)}>Show workspace loading</button>
    <button onClick={() => setLoadCanvas(true)}>Show loaded canvas</button>
    <button onClick={() => setOpportunityCanvas(true)}>Show opportunity canvas</button>
    <button onClick={() => { dirty.current = !dirty.current }}>Toggle dirty editor</button>
    <button onClick={() => { const id = navigation.walkthrough.currentId; setCurrent(value => ({ ...value, particles: value.particles.filter(item => item.id !== id) })) }}>Revoke current target</button>
    <button onClick={() => navigation.select("00000000-0000-4000-8000-000000000002", { view: "share", shareParticleIds: ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000004"] })}>Open shared selection</button>
    <output data-testid="inspection-state">{JSON.stringify({ id: selectedId, view: navigation.inspectorView, shareIds: navigation.shareParticleIds, calendar: navigation.calendarEntryRequest?.id })}</output>
    <output data-testid="navigation-selection">{canvasSelectedId}</output>
    <p>Fictional local fixture. No production connection.</p><output data-testid="graph" hidden>{JSON.stringify(current)}</output><Toaster />
  </main></>
}
createRoot(document.getElementById("root")!).render(<ParticleResponsibilityPeople value={[{ id: "00000000-0000-4000-8000-000000000701", name: "Alex Rivera" }, { id: "00000000-0000-4000-8000-000000000702", name: "Sam Chen" }]}><Fixture /></ParticleResponsibilityPeople>)
