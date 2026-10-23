"use client"
import { useState } from "react"
import { Plus, Trash2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ObjectiveStep } from "../island-types"
import { planDraftSchema, type PlanDraft } from "../plan-types"
import { clearRemovedChoices } from "../lib/plan-progress"

function StepSelect({ value, onChange, steps, label, disabled }: { value: string; onChange: (id: string) => void; steps: { id: string; title: string }[]; label: string; disabled?: boolean }) {
  return <Select value={value || "unselected"} onValueChange={id => { if (id && id !== "unselected") onChange(id) }} disabled={disabled}><SelectTrigger aria-label={label} className="min-w-0 flex-1 rounded-xl shadow-none"><SelectValue placeholder={label} /></SelectTrigger>
    <SelectContent><SelectItem value="unselected" disabled className="hidden">{label}</SelectItem>{steps.map(step => <SelectItem key={step.id} value={step.id}>{step.title}</SelectItem>)}</SelectContent></Select>
}
export function ObjectivePlanEditor({ initial, allSteps, pending, error, onSave, onClose, decisionsAvailable = false }: {
  decisionsAvailable?: boolean; initial: PlanDraft; allSteps: ObjectiveStep[]; connectedStepIds: string[]; pending: boolean; error: string | null
  onSave: (draft: PlanDraft) => Promise<boolean>; onClose: () => void
}) {
  // Preserve the opening revision and every canonical step baseline until explicitly reopened.
  const [draft, setDraft] = useState(initial)
  const [validation, setValidation] = useState<string | null>(null)
  const [discard, setDiscard] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const patch = (id: string, fields: Partial<PlanDraft["steps"][number]>) => setDraft(value => ({ ...value, steps: value.steps.map(step => step.id === id ? { ...step, ...fields } : step) }))
  return <section aria-label={initial.revision ? "Edit plan" : "New plan"} className="min-w-0"
    onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); if (!pending) { if (dirty) setDiscard(true); else onClose() } } }}>
      <form className="flex min-w-0 flex-col gap-4" onSubmit={async event => { event.preventDefault(); const result = planDraftSchema.safeParse(draft); if (!result.success) { setValidation(result.error.issues[0].message); return }; setValidation(null); if (await onSave(result.data)) onClose() }}>
        <div className="flex flex-col gap-1"><Label htmlFor="objective-plan-title">Plan name</Label><Input autoFocus id="objective-plan-title" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={240} required disabled={pending} className="rounded-xl shadow-none" /></div>
        <div className="flex flex-col gap-2">
          {draft.steps.map((step, index) => <InputGroup key={step.id} className="items-center gap-0 rounded-2xl border border-border/70 p-1">
            <InputGroupInput aria-label={`Item ${index + 1} title`} value={step.title} maxLength={240} required disabled={pending} onChange={event => patch(step.id, { title: event.target.value })} className="min-w-0 border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" />
            <InputGroupAddon>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={pending} className="size-8 rounded-full" aria-label={`Item ${index + 1} options`}><MoreHorizontal aria-hidden /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuGroup>
                    {decisionsAvailable && <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={pending}>Type</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="rounded-xl">
                        <DropdownMenuRadioGroup value={draft.decisions?.some(item => item.stepId === step.id) ? "decision" : "action"} onValueChange={value => setDraft(current => ({ ...current, decisions: [...(current.decisions ?? []).filter(item => item.stepId !== step.id), ...(value === "decision" ? [{ stepId: step.id, selectedEdgeId: null }] : [])] }))}>
                          <DropdownMenuRadioItem value="action" disabled={pending}>Action</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="decision" disabled={pending}>Decision</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>}
                    {!draft.decisions?.some(item => item.stepId === step.id) && <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={pending}>Status</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="rounded-xl">
                        <DropdownMenuRadioGroup value={step.status} onValueChange={value => patch(step.id, { status: value as typeof step.status })}>
                          <DropdownMenuRadioItem value="todo" disabled={pending}>To do</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="in_progress" disabled={pending}>In progress</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="blocked" disabled={pending}>Blocked</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="done" disabled={pending}>Done</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>}
                    <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => setDraft(value => clearRemovedChoices({ ...value, decisions: value.decisions?.filter(item => item.stepId !== step.id), steps: value.steps.filter(item => item.id !== step.id), edges: value.edges.filter(edge => edge.source !== step.id && edge.target !== step.id) }))}>
                      <Trash2 aria-hidden />Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
          </InputGroup>)}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="rounded-full" disabled={pending || draft.steps.length >= 80} onClick={() => setDraft(value => ({ ...value, steps: [...value.steps, { id: crypto.randomUUID(), title: "", status: "todo", expectedUpdatedAt: null }] }))}><Plus aria-hidden data-icon="inline-start" />Add item</Button>
            {allSteps.some(step => !draft.steps.some(item => item.id === step.id)) && <StepSelect disabled={pending || draft.steps.length >= 80} value="" label="Reuse saved item" steps={allSteps.filter(step => !draft.steps.some(item => item.id === step.id))} onChange={id => {
              const step = allSteps.find(item => item.id === id)!
              setDraft(value => ({ ...value, steps: [...value.steps, { id, title: step.title, status: step.status, expectedUpdatedAt: step.updatedAt }] }))
            }} />}
          </div>
        </div>
        {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {discard && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted p-3 text-sm"><span className="flex-1">Discard unsaved plan changes?</span><Button type="button" variant="ghost" className="rounded-full" onClick={() => setDiscard(false)}>Keep editing</Button><Button type="button" variant="destructive" className="rounded-full" onClick={onClose}>Discard</Button></div>}
        <div className="flex items-center justify-end gap-2"><Button type="button" variant="ghost" className="rounded-full" disabled={pending} onClick={() => dirty ? setDiscard(true) : onClose()}>Cancel</Button><Button type="submit" className="rounded-full" disabled={pending}>Save plan</Button></div>
      </form>
  </section>
}
