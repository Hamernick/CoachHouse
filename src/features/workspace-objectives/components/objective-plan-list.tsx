"use client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Pencil, Plus, Workflow } from "lucide-react"
import type { ObjectiveStep } from "../island-types"
import { planProgress } from "../lib/plan-progress"
import { PlanDecisionChoice } from "./plan-decision-choice"
import type { ObjectivePlan } from "../plan-types"
export function ObjectivePlanList({ plans, steps, canEdit, pending, visible, onToggle, onEdit, onCreate, onStep, onChoice, onRevise, allPlans = plans }: {
  onRevise?: (plan: ObjectivePlan) => void; allPlans?: ObjectivePlan[]; onChoice: (plan: ObjectivePlan, stepId: string, edgeId: string | null) => void; plans: ObjectivePlan[]; steps: ObjectiveStep[]; canEdit: boolean; pending: boolean; visible: string[]
  onToggle: (id: string) => void; onEdit: (plan: ObjectivePlan) => void; onCreate: () => void; onStep: (step: ObjectiveStep, done: boolean) => void
}) {
  return <div className="flex flex-col gap-2">
    {plans.map(plan => {
      const members = plan.stepIds.flatMap(id => steps.find(step => step.id === id) ?? [])
      const progress = planProgress(allPlans, members)
      const done = progress.completed.length
      return <Collapsible key={plan.id} className="min-w-0">
        <div className="flex min-w-0 items-center gap-1"><CollapsibleTrigger asChild><Button variant="ghost" className="h-auto min-h-9 min-w-0 flex-1 justify-between whitespace-normal rounded-xl px-1 text-left"><span>{plan.title} <span className="text-xs tabular-nums text-muted-foreground">{done}/{progress.active.length}{progress.waiting > 0 ? " · Awaiting a decision" : ""}</span></span><ChevronDown aria-hidden /></Button></CollapsibleTrigger>
          <Button variant="ghost" size="icon" className="size-9 rounded-full aria-pressed:bg-accent" aria-label={`Show ${plan.title} tree`} aria-pressed={visible.includes(plan.id)} onClick={() => onToggle(plan.id)}><Workflow aria-hidden /></Button>
          {canEdit && <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label={`Edit ${plan.title} plan`} disabled={pending} onClick={() => onEdit(plan)}><Pencil aria-hidden /></Button>}
        </div>
        <CollapsibleContent><ul aria-label={`${plan.title} plan steps`} className="flex flex-col gap-1 pt-1">{members.map(step => {
          const decision = plan.decisions?.find(item => item.stepId === step.id)
          const applicable = progress.steps.get(step.id) ?? "active"
          return <li key={step.id} className="flex min-h-11 flex-wrap items-center gap-2" data-applicability={applicable}>
            {decision ? <div className="w-full space-y-1 py-1"><span className="text-sm">{step.title}</span><PlanDecisionChoice decision={decision} edges={plan.edges} label={`Outcome for ${step.title} in ${plan.title}`} disabled={!canEdit || pending || applicable !== "active"} onChange={edgeId => onChoice(plan, step.id, edgeId)} /></div> : <>
              <Checkbox id={`plan-${plan.id}-${step.id}`} checked={step.status === "done"} disabled={!canEdit || !step.editable || pending || applicable !== "active"} onCheckedChange={value => onStep(step, value === true)} className="rounded-full" />
              <label htmlFor={`plan-${plan.id}-${step.id}`} className={`min-w-0 flex-1 break-words text-sm ${step.status === "done" || applicable !== "active" ? "text-muted-foreground" : ""} ${step.status === "done" ? "line-through" : ""}`}>{step.title}</label>
            </>}
            {applicable !== "active" && <span className="text-xs text-muted-foreground">{applicable === "waiting" ? "Awaiting a decision" : "Not selected"}</span>}
          </li>
        })}</ul>{canEdit && onRevise && <Button variant="ghost" size="sm" className="rounded-full" disabled={pending} onClick={() => onRevise(plan)}>Revise with AI</Button>}</CollapsibleContent>
      </Collapsible>
    })}
    {canEdit && <Button variant="ghost" size="sm" className="w-fit rounded-full" disabled={pending} onClick={onCreate}><Plus data-icon="inline-start" aria-hidden />Add plan</Button>}
  </div>
}
