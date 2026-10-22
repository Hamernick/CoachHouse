"use client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Pencil, Plus, Workflow } from "lucide-react"
import type { ObjectiveStep } from "../island-types"
import type { ObjectivePlan } from "../plan-types"
export function ObjectivePlanList({ plans, steps, canEdit, pending, visible, onToggle, onEdit, onCreate, onStep }: {
  plans: ObjectivePlan[]; steps: ObjectiveStep[]; canEdit: boolean; pending: boolean; visible: string[]
  onToggle: (id: string) => void; onEdit: (plan: ObjectivePlan) => void; onCreate: () => void; onStep: (step: ObjectiveStep, done: boolean) => void
}) {
  return <div className="space-y-2">
    {plans.map(plan => {
      const members = plan.stepIds.flatMap(id => steps.find(step => step.id === id) ?? [])
      const done = members.filter(step => step.status === "done").length
      return <Collapsible key={plan.id} className="rounded-2xl bg-muted/40 p-2">
        <div className="flex min-w-0 items-center gap-1"><CollapsibleTrigger asChild><Button variant="ghost" className="h-auto min-h-9 min-w-0 flex-1 justify-between whitespace-normal rounded-xl px-1 text-left"><span>{plan.title} <span className="text-xs tabular-nums text-muted-foreground">{done}/{members.length}</span></span><ChevronDown aria-hidden /></Button></CollapsibleTrigger>
          <Button variant="ghost" size="icon" className="size-9 rounded-full aria-pressed:bg-accent" aria-label={`Show ${plan.title} tree`} aria-pressed={visible.includes(plan.id)} onClick={() => onToggle(plan.id)}><Workflow aria-hidden /></Button>
          {canEdit && <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label={`Edit ${plan.title} plan`} disabled={pending} onClick={() => onEdit(plan)}><Pencil aria-hidden /></Button>}
        </div>
        <CollapsibleContent><ul aria-label={`${plan.title} plan steps`} className="space-y-1 pt-1">{members.map(step => <li key={step.id} className="flex min-h-11 items-center gap-2">
          <Checkbox id={`plan-${plan.id}-${step.id}`} checked={step.status === "done"} disabled={!canEdit || !step.editable || pending} onCheckedChange={value => onStep(step, value === true)} className="rounded-full" />
          <label htmlFor={`plan-${plan.id}-${step.id}`} className={`min-w-0 flex-1 break-words text-sm ${step.status === "done" ? "text-muted-foreground line-through" : ""}`}>{step.title}</label>
        </li>)}</ul></CollapsibleContent>
      </Collapsible>
    })}
    {canEdit && <Button variant="ghost" size="sm" className="rounded-full" disabled={pending} onClick={onCreate}><Plus data-icon="inline-start" aria-hidden />Add plan</Button>}
  </div>
}
