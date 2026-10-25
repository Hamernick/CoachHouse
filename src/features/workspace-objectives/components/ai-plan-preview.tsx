"use client"
import { useMemo, useState } from "react"
import { Background, ReactFlow, ReactFlowProvider } from "@xyflow/react"
import { usePlanProjection } from "../hooks/use-plan-projection"
import { ObjectivePlanNode, type ObjectivePlanProjection } from "./objective-plan-node"
import { ObjectivePlanViewport } from "./objective-plan-viewport"
import type { PlanDraft } from "../plan-types"
import type { WorkspaceObjectiveRecord } from "../types"
import type { ObjectiveIslandData } from "../island-types"
const nodeTypes = { objectivePlanStep: ObjectivePlanNode }
const noop = () => undefined
export function AiPlanPreview({ draft, objective }: { draft: PlanDraft; objective: WorkspaceObjectiveRecord }) {
  const [projection, setProjection] = useState<ObjectivePlanProjection>({ scopeKey: "preview", focusKey: "", nodes: [], edges: [] })
  const selected = useMemo(() => [draft.id], [draft.id])
  const data = useMemo<ObjectiveIslandData>(() => ({ loadedFrom: "normalized", objectives: [objective], groups: [],
    steps: draft.steps.map((step, order) => ({ ...step, objectiveId: objective.id, order, editable: false, updatedAt: objective.updatedAt })),
    planning: { available: true, decisionsAvailable: true, plans: [{ ...draft, stepIds: draft.steps.map(step => step.id) }] },
  }), [draft, objective])
  const error = usePlanProjection({ data, selected, scopeKey: "preview", pending: false, canEdit: false, onEdit: noop, onStep: noop, onChoice: noop, onProjection: setProjection })
  return <div aria-label="Proposed plan tree" className="h-64 overflow-hidden rounded-2xl border border-border/60 bg-background">
    {error ? <p role="alert" className="p-3 text-sm">{error}</p> : <ReactFlowProvider><ReactFlow nodes={projection.nodes} edges={projection.edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} minZoom={0.1} maxZoom={1} zoomOnScroll={false} preventScrolling={false}>
      <Background /><ObjectivePlanViewport focusKey={draft.id} />
    </ReactFlow></ReactFlowProvider>}
  </div>
}
