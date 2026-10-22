"use client"
import { Handle, Position, type Node, type NodeProps, type Edge } from "@xyflow/react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkspaceNodeFrameRoot, WorkspaceNodeFrameHeader, WorkspaceNodeFrameBody } from "@/components/workspace/workspace-node-frame"
import type { ObjectiveStep } from "../island-types"
export type ObjectivePlanNodeData = { step: ObjectiveStep; plans: string; canEdit: boolean; pending: boolean; onEdit: () => void; onComplete: (done: boolean) => void }
export type ObjectivePlanFlowNode = Node<ObjectivePlanNodeData, "objectivePlanStep">
export type ObjectivePlanProjection = { scopeKey: string; focusKey: string; nodes: ObjectivePlanFlowNode[]; edges: Edge[] }
export function ObjectivePlanNode({ data }: NodeProps<ObjectivePlanFlowNode>) {
  return <WorkspaceNodeFrameRoot className="pointer-events-auto flex h-[120px] w-[260px] flex-col gap-2 rounded-3xl p-3 shadow-none" aria-label={`Plan step: ${data.step.title}`}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <WorkspaceNodeFrameHeader className="items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground" title={data.plans}>{data.plans}</span>
      {data.canEdit && <Button variant="ghost" size="icon" className="nodrag nopan size-8 rounded-full" disabled={data.pending} aria-label={`Edit plan for ${data.step.title}`} onClick={data.onEdit}><Pencil aria-hidden /></Button>}
    </WorkspaceNodeFrameHeader>
    <WorkspaceNodeFrameBody className="flex items-start gap-2"><Checkbox className="nodrag nopan mt-0.5 rounded-full" aria-label={`Complete ${data.step.title}`} checked={data.step.status === "done"} disabled={!data.canEdit || data.pending} onCheckedChange={value => data.onComplete(value === true)} />
      <span className={`line-clamp-2 text-sm ${data.step.status === "done" ? "text-muted-foreground line-through" : ""}`} title={data.step.title}>{data.step.title}</span>
    </WorkspaceNodeFrameBody>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </WorkspaceNodeFrameRoot>
}
