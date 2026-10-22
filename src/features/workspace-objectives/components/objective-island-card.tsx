"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ObjectiveEdit, ObjectiveStep } from "../island-types"
import type { WorkspaceObjectiveRecord } from "../types"
import { ObjectiveEditForm } from "./objective-edit-form"

const labels = { todo: "To do", in_progress: "In progress", blocked: "Blocked", done: "Done", archived: "Archived" }
export function ObjectiveIslandCard({ objective, steps, editable, pending, onEdit, onStep }: {
  objective: WorkspaceObjectiveRecord; steps: ObjectiveStep[]; editable: boolean; pending: boolean
  onEdit: (input: ObjectiveEdit) => Promise<boolean>; onStep: (step: ObjectiveStep, done: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const completed = steps.filter(step => step.status === "done").length
  const canEdit = editable && objective.kind === "custom"
  return <Card className="gap-0 rounded-3xl border-border/60 py-0 shadow-none">
    <Collapsible open={expanded || editing} onOpenChange={setExpanded}>
      <CardHeader className="gap-2 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-auto min-h-11 min-w-0 flex-1 justify-between whitespace-normal rounded-xl px-1 text-left">
              <CardTitle className={cn("min-w-0 text-sm leading-5", objective.status === "done" && "text-muted-foreground line-through")}>{objective.title}</CardTitle>
              <ChevronDown data-icon="inline-end" className={cn("transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
            </Button>
          </CollapsibleTrigger>
          {canEdit && <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full [@media(pointer:coarse)]:size-11" aria-label={`Edit ${objective.title}`} disabled={pending} onClick={() => setEditing(true)}><Pencil aria-hidden /></Button>}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{labels[objective.status]}</span>
          {steps.length > 0 && <span className="tabular-nums">{completed} / {steps.length} steps</span>}
        </div>
        {steps.length > 0 && <div className="flex gap-1" aria-hidden>{steps.map(step => <span key={step.id} className={cn("h-1.5 min-w-0 flex-1 rounded-full bg-muted", step.status === "done" && "bg-primary")} />)}</div>}
      </CardHeader>
      <CollapsibleContent>
        <CardContent className="px-3 pb-3">
          {editing ? <ObjectiveEditForm objective={objective} pending={pending} onSave={onEdit} onCancel={() => setEditing(false)} /> : <div className="flex flex-col gap-3">
            {objective.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{objective.description}</p>}
            {steps.length > 0 && <ul className="flex flex-col gap-1" aria-label={`${objective.title} steps`}>
              {steps.map(step => <li key={step.id} className="flex min-h-11 items-center gap-3">
                <Checkbox id={`objective-step-${step.id}`} checked={step.status === "done"} disabled={!canEdit || !step.editable || pending}
                  onCheckedChange={checked => onStep(step, checked === true)} className="rounded-full" />
                <label htmlFor={`objective-step-${step.id}`} className={cn("min-w-0 flex-1 break-words text-sm", step.status === "done" && "text-muted-foreground line-through")}>{step.title}</label>
                {step.status === "blocked" && <span className="text-xs text-muted-foreground">Blocked</span>}
              </li>)}
            </ul>}
            {!steps.length && !objective.description && <p className="text-sm text-muted-foreground">No steps yet.</p>}
          </div>}
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  </Card>
}
