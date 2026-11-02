"use client"
import { ParticleSelect } from "@/components/ui/particle-ui"
import type { PlanEdge, PlanDecision } from "../plan-types"

export function PlanDecisionChoice({ decision, edges, label, disabled, onChange }: {
  decision: PlanDecision; edges: PlanEdge[]; label: string; disabled: boolean; onChange: (edgeId: string | null) => void
}) {
  return <ParticleSelect value={decision.selectedEdgeId ?? "unresolved"} disabled={disabled} onChange={event => { const value = event.target.value; return (onChange(value === "unresolved" ? null : value)); }} aria-label={label} className="nodrag nopan h-8 w-full min-w-0 rounded-full bg-background shadow-none">
<option value="" disabled>Choose…</option><option value="unresolved">Needs information</option>{edges.filter(edge => edge.source === decision.stepId).map(edge => <option key={edge.id} value={edge.id}>{edge.label}</option>)}</ParticleSelect>
}
