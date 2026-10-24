"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PlanEdge, PlanDecision } from "../plan-types"

export function PlanDecisionChoice({ decision, edges, label, disabled, onChange }: {
  decision: PlanDecision; edges: PlanEdge[]; label: string; disabled: boolean; onChange: (edgeId: string | null) => void
}) {
  return <Select value={decision.selectedEdgeId ?? "unresolved"} disabled={disabled} onValueChange={value => onChange(value === "unresolved" ? null : value)}>
    <SelectTrigger aria-label={label} className="nodrag nopan h-8 w-full min-w-0 rounded-full bg-background shadow-none"><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="unresolved">Needs information</SelectItem>{edges.filter(edge => edge.source === decision.stepId).map(edge => <SelectItem key={edge.id} value={edge.id}>{edge.label}</SelectItem>)}</SelectContent>
  </Select>
}
