"use client"
import { Handle, Position, type Node, type NodeProps, type Edge } from "@xyflow/react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkspaceNodeFrameRoot, WorkspaceNodeFrameHeader, WorkspaceNodeFrameBody } from "@/components/workspace/workspace-node-frame"
import type { PlanDecision, PlanEdge } from "../plan-types"
import type { PlanApplicability } from "../lib/plan-progress"
import { PlanDecisionChoice } from "./plan-decision-choice"
import type { ObjectiveStep } from "../island-types"
export type ObjectivePlanNodeData = { step: ObjectiveStep; applicability: PlanApplicability; decisions: { decision: PlanDecision; edges: PlanEdge[]; planId: string; planTitle: string; onChange: (edgeId: string | null) => void }[]; plans: string; canEdit: boolean; pending: boolean; onEdit: () => void; onComplete: (done: boolean) => void }
export type ObjectivePlanFlowNode = Node<ObjectivePlanNodeData, "objectivePlanStep">
export type ObjectivePlanProjection = { scopeKey: string; focusKey: string; nodes: ObjectivePlanFlowNode[]; edges: Edge[] }
export function ObjectivePlanNode({ data }: NodeProps<ObjectivePlanFlowNode>) {
  return <WorkspaceNodeFrameRoot className="pointer-events-auto flex h-full min-h-[120px] w-[260px] flex-col gap-2 rounded-3xl p-3 shadow-none" data-applicability={data.applicability} aria-label={`Plan step: ${data.step.title}`}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <WorkspaceNodeFrameHeader className="items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground" title={data.plans}>{data.plans}</span>
      {data.canEdit && <Button variant="ghost" size="icon" className="nodrag nopan size-8 rounded-full" disabled={data.pending} aria-label={`Edit plan for ${data.step.title}`} onClick={data.onEdit}><Pencil aria-hidden /></Button>}
    </WorkspaceNodeFrameHeader>
    <WorkspaceNodeFrameBody className="flex flex-col gap-2"><div className="flex items-start gap-2">{!data.decisions.length && <Checkbox className="nodrag nopan mt-0.5 rounded-full" aria-label={`Complete ${data.step.title}`} checked={data.step.status === "done"} disabled={!data.canEdit || data.pending || data.applicability !== "active"} onCheckedChange={value => data.onComplete(value === true)} />}
      <span className={`line-clamp-2 text-sm ${!data.decisions.length && data.step.status === "done" ? "text-muted-foreground line-through" : ""}`} title={data.step.title}>{data.step.title}</span></div>
      {data.decisions.map(({ decision, edges, planId, planTitle, onChange }) => <PlanDecisionChoice key={`${planId}:${decision.stepId}`} decision={decision} edges={edges} label={`Tree outcome for ${data.step.title} in ${planTitle}`} disabled={!data.canEdit || data.pending || data.applicability !== "active"} onChange={onChange} />)}
      {data.applicability !== "active" && <span className="text-xs text-muted-foreground">{data.applicability === "waiting" ? "Awaiting a decision" : "Not selected"}</span>}
    </WorkspaceNodeFrameBody>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </WorkspaceNodeFrameRoot>
}
