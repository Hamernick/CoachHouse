"use client"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { CircularProgress } from "@/components/ui/circular-progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, CircleCheck, CircleMinus, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ObjectiveEdit, ObjectiveStep } from "../island-types"
import type { WorkspaceObjectiveRecord } from "../types"
import { planProgress } from "../lib/plan-progress"
import type { ObjectivePlan } from "../plan-types"
import { ObjectiveEditForm } from "./objective-edit-form"

export function ObjectiveIslandCard({ objective, steps, editable, pending, onEdit, onStep, children, checklistSteps = steps, plans = [] }: {
  plans?: ObjectivePlan[]; children?: ReactNode; checklistSteps?: ObjectiveStep[]; objective: WorkspaceObjectiveRecord; steps: ObjectiveStep[]; editable: boolean; pending: boolean
  onEdit: (input: ObjectiveEdit) => Promise<boolean>; onStep: (step: ObjectiveStep, done: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const progress = planProgress(plans, steps)
  const total = progress.active.length + progress.waiting
  const blocked = objective.status === "blocked"
  const complete = objective.status === "done" || (!blocked && total > 0 && progress.completed.length === total)
  const inProgress = !complete && (objective.status === "in_progress" || progress.completed.length > 0 || progress.active.some(item => item.status === "in_progress"))
  const percent = total > 0 ? Math.round(progress.completed.length / total * 100) : 0
  const progressLabel = complete ? "Complete" : blocked ? "Blocked" : inProgress ? `In progress, ${percent}% complete` : "Not started"
  const canEdit = editable && objective.kind === "custom"
  return <section className="min-w-0 border-t border-border/50 py-1">
    <Collapsible open={expanded || editing} onOpenChange={setExpanded}>
      <div className="flex flex-col gap-1 px-1 py-1" style={editing ? { display: "none" } : undefined}>
        <div className="flex min-w-0 items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" aria-description={progressLabel} className="h-auto min-h-11 min-w-0 flex-1 justify-between whitespace-normal rounded-xl px-1 text-left">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
                  {complete ? <CircleCheck className="text-emerald-600 dark:text-emerald-400" /> : blocked ? <CircleMinus className="text-destructive" /> : <CircularProgress
                    value={percent} size={16} strokeWidth={2} decorative
                    trackClassName={inProgress ? "stroke-orange-500/30 dark:stroke-orange-400/30" : undefined}
                    progressClassName="stroke-orange-500 dark:stroke-orange-400"
                  />}
                </span>
                <span className={cn("min-w-0 text-sm leading-5", objective.status === "done" && "text-muted-foreground line-through")}>{objective.title}</span>
              </span>
              <ChevronDown data-icon="inline-end" className={cn("transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
            </Button>
          </CollapsibleTrigger>
          {canEdit && <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full [@media(pointer:coarse)]:size-11" aria-label={`Edit ${objective.title}`} disabled={pending} onClick={() => setEditing(true)}><Pencil aria-hidden /></Button>}
        </div>

      </div>
      <CollapsibleContent>
        <div className="px-1 pb-1">
          {editing ? <ObjectiveEditForm objective={objective} pending={pending} onSave={onEdit} onCancel={() => setEditing(false)} /> : <div className="flex flex-col gap-3">
            {objective.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{objective.description}</p>}
            {checklistSteps.length > 0 && <ul className="flex flex-col gap-1" aria-label={`${objective.title} steps`}>
              {checklistSteps.map(step => <li key={step.id} className="flex min-h-11 items-center gap-3">
                <Checkbox id={`objective-step-${step.id}`} checked={step.status === "done"} disabled={!canEdit || !step.editable || pending}
                  onCheckedChange={checked => onStep(step, checked === true)} className="rounded-full" />
                <label htmlFor={`objective-step-${step.id}`} className={cn("min-w-0 flex-1 break-words text-sm", step.status === "done" && "text-muted-foreground line-through")}>{step.title}</label>
                {step.status === "blocked" && <span className="text-xs text-muted-foreground">Blocked</span>}
              </li>)}
            </ul>}
            {children}
            {!children && !steps.length && !objective.description && <p className="text-sm text-muted-foreground">No steps yet.</p>}
          </div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  </section>
}
