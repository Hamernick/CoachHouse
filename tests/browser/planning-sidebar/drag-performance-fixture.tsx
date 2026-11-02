import { useMemo, useRef, useState } from "react"
import { ReactFlow, applyNodeChanges, type Node } from "@xyflow/react"
import { useObjectiveCanvas } from "@/features/workspace-objectives/hooks/use-objective-canvas"
import "@xyflow/react/dist/style.css"

export function DragPerformanceFixture() {
  const [nodes, setNodes] = useState<Node[]>(() => Array.from({ length: 28 }, (_, i) => ({
    id: `card-${i}`, position: { x: 40 + i % 4 * 190, y: 140 + Math.floor(i / 4) * 100 }, data: { label: `Card ${i + 1}` },
  })))
  const projection = useObjectiveCanvas("drag-performance", true, nodes)
  const builds = useRef(0)
  const edges = useMemo(() => { builds.current += 1; return [...projection.edges] }, [projection.edges])
  return <div className="workspace-layout-surface" style={{ width: "100vw", height: "100dvh" }}>
    <output data-testid="edge-builds">{builds.current}</output>
    <div data-testid="drag-glass" className="canvas-glass absolute top-8 left-8 z-10 rounded-xl p-3">Workspace controls</div>
    <ReactFlow nodes={nodes} edges={edges} className="workspace-flow" onNodesChange={changes => setNodes(current => applyNodeChanges(changes, current))} />
  </div>
}
