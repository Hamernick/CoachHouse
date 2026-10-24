"use client"
import { useState } from "react"
import { ObjectiveInlineTitle } from "./objective-inline-title"
import styles from "./objective-timeline.module.css"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Pencil, Plus } from "lucide-react"
import type { ObjectiveStep } from "../island-types"
import { planProgress } from "../lib/plan-progress"
import { PlanDecisionChoice } from "./plan-decision-choice"
import type { ObjectivePlan } from "../plan-types"
export function ObjectivePlanList({ plans, steps, canEdit, pending, onRename, onCreate, onStep, onChoice, onRevise, allPlans = plans }: {
  onRevise?: (plan: ObjectivePlan) => void; allPlans?: ObjectivePlan[]; onChoice: (plan: ObjectivePlan, stepId: string, edgeId: string | null) => void; plans: ObjectivePlan[]; steps: ObjectiveStep[]; canEdit: boolean; pending: boolean; visible: string[]
  onToggle: (id: string) => void; onRename: (plan: ObjectivePlan, title: string) => Promise<boolean>; onCreate: () => void; onStep: (step: ObjectiveStep, done: boolean) => void
}) {
  const [editing, setEditing] = useState<ObjectivePlan | null>(null)
  return <div className={cn("flex flex-col gap-2", plans.length > 0 && styles.plans)}>
    {plans.map(plan => {
      const members = plan.stepIds.flatMap(id => steps.find(step => step.id === id) ?? [])
      const progress = planProgress(allPlans, members)
      return <Collapsible key={plan.id} className={styles.plan}>
        <div className="flex min-w-0 items-center gap-1">
          {editing?.id === plan.id ? <ObjectiveInlineTitle key={editing.id} initial={editing.title} pending={pending}
            onSave={title => onRename(editing, title)} onCancel={() => setEditing(null)} /> : <>
            <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto min-h-9 min-w-0 flex-1 justify-start whitespace-normal rounded-xl px-1 text-left">{plan.title}</Button></CollapsibleTrigger>
            {canEdit && <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label={`Edit ${plan.title} plan`} disabled={pending} onClick={() => setEditing(plan)}><Pencil aria-hidden /></Button>}
          </>}
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
    {canEdit && <Button variant="ghost" size="sm" className="w-fit rounded-full" disabled={pending} onClick={onCreate}><Plus data-icon="inline-start" aria-hidden />Add to plan</Button>}
  </div>
}
