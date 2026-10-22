"use client"
import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
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
export function ObjectivePlanEditor({ initial, allSteps, connectedStepIds, pending, error, onSave, onClose, decisionsAvailable = false }: {
  decisionsAvailable?: boolean; initial: PlanDraft; allSteps: ObjectiveStep[]; connectedStepIds: string[]; pending: boolean; error: string | null
  onSave: (draft: PlanDraft) => Promise<boolean>; onClose: () => void
}) {
  // Preserve the opening revision and every canonical step baseline until explicitly reopened.
  const [draft, setDraft] = useState(initial)
  const [source, setSource] = useState("")
  const [target, setTarget] = useState("")
  const [label, setLabel] = useState("")
  const [validation, setValidation] = useState<string | null>(null)
  const [discard, setDiscard] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const patch = (id: string, fields: Partial<PlanDraft["steps"][number]>) => setDraft(value => ({ ...value, steps: value.steps.map(step => step.id === id ? { ...step, ...fields } : step) }))
  const targets = [...draft.steps, ...allSteps.filter(step => connectedStepIds.includes(step.id) && !draft.steps.some(item => item.id === step.id))]
  return <Dialog open onOpenChange={open => { if (!open && !pending) { if (dirty) setDiscard(true); else onClose() } }}>
    <DialogContent className="max-h-[90svh] overflow-y-auto rounded-3xl sm:max-w-2xl">
      <DialogHeader><DialogTitle>{initial.revision ? "Edit plan" : "New plan"}</DialogTitle><DialogDescription className="sr-only">Edit steps and connect branches. Shared steps stay in sync across plans.</DialogDescription></DialogHeader>
      <form className="flex min-w-0 flex-col gap-4" onSubmit={async event => { event.preventDefault(); const result = planDraftSchema.safeParse(draft); if (!result.success) { setValidation(result.error.issues[0].message); return }; setValidation(null); if (await onSave(result.data)) onClose() }}>
        <div className="space-y-1"><Label htmlFor="objective-plan-title">Plan name</Label><Input id="objective-plan-title" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={240} required disabled={pending} className="rounded-xl shadow-none" /></div>
        <div className="space-y-2">
          <Label>Steps</Label>
          {draft.steps.map((step, index) => <div key={step.id} className="flex min-w-0 flex-wrap items-center gap-1 rounded-2xl bg-muted/50 p-2">
            <Input aria-label={`Step ${index + 1} title`} value={step.title} maxLength={240} required disabled={pending} onChange={event => patch(step.id, { title: event.target.value })} className="min-w-[140px] flex-1 rounded-xl shadow-none" />
            {decisionsAvailable && <Select value={draft.decisions?.some(item => item.stepId === step.id) ? "decision" : "action"} disabled={pending} onValueChange={value => setDraft(current => ({ ...current, decisions: [...(current.decisions ?? []).filter(item => item.stepId !== step.id), ...(value === "decision" ? [{ stepId: step.id, selectedEdgeId: null }] : [])] }))}>
              <SelectTrigger aria-label={`Step ${index + 1} type`} className="w-28 rounded-xl shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="action">Action</SelectItem><SelectItem value="decision">Decision</SelectItem></SelectContent>
            </Select>}
            {!draft.decisions?.some(item => item.stepId === step.id) && <Select value={step.status} disabled={pending} onValueChange={value => patch(step.id, { status: value as typeof step.status })}>
              <SelectTrigger aria-label={`Step ${index + 1} status`} className="w-32 rounded-xl shadow-none"><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="todo">To do</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="blocked">Blocked</SelectItem><SelectItem value="done">Done</SelectItem>
              </SelectContent></Select>}
            <Button type="button" variant="ghost" size="icon" disabled={pending} className="rounded-full" aria-label={`Remove step ${index + 1} from plan`} onClick={() => {
              setDraft(value => clearRemovedChoices({ ...value, decisions: value.decisions?.filter(item => item.stepId !== step.id), steps: value.steps.filter(item => item.id !== step.id), edges: value.edges.filter(edge => edge.source !== step.id && edge.target !== step.id) }))
              setSource(""); setTarget("")
            }}><X aria-hidden /></Button>
          </div>)}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="rounded-full" disabled={pending || draft.steps.length >= 80} onClick={() => setDraft(value => ({ ...value, steps: [...value.steps, { id: crypto.randomUUID(), title: "", status: "todo", expectedUpdatedAt: null }] }))}><Plus aria-hidden data-icon="inline-start" />Add step</Button>
            {allSteps.some(step => !draft.steps.some(item => item.id === step.id)) && <StepSelect disabled={pending || draft.steps.length >= 80} value="" label="Reuse saved step" steps={allSteps.filter(step => !draft.steps.some(item => item.id === step.id))} onChange={id => {
              const step = allSteps.find(item => item.id === id)!
              setDraft(value => ({ ...value, steps: [...value.steps, { id, title: step.title, status: step.status, expectedUpdatedAt: step.updatedAt }] }))
            }} />}
          </div>
        </div>
        <div className="space-y-2"><Label>Connections</Label>
          {draft.edges.map(edge => <div key={edge.id} className="flex items-center gap-2 rounded-xl bg-muted/50 p-2 text-sm">
            <span className="min-w-0 flex-1 break-words">{targets.find(step => step.id === edge.source)?.title} → {targets.find(step => step.id === edge.target)?.title}{edge.label && ` · ${edge.label}`}</span>
            <Button type="button" variant="ghost" size="icon" className="rounded-full" disabled={pending} aria-label="Remove connection" onClick={() => setDraft(value => clearRemovedChoices({ ...value, edges: value.edges.filter(item => item.id !== edge.id) }))}><X aria-hidden /></Button>
          </div>)}
          {draft.steps.length > 0 && <fieldset disabled={pending} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/40 p-2">
            <div className="flex min-w-0 gap-2"><StepSelect value={source} onChange={setSource} steps={draft.steps.filter(step => step.title.trim())} label="From step" /><StepSelect value={target} onChange={setTarget} steps={targets.filter(step => step.id !== source && step.title.trim())} label="To step" /></div>
            <div className="flex gap-2"><Input value={label} onChange={event => setLabel(event.target.value)} maxLength={120} placeholder="Decision or condition (optional)" aria-label="Connection condition" className="rounded-xl shadow-none" />
              <Button type="button" variant="ghost" className="rounded-full" disabled={!source || !target || source === target || draft.edges.length >= 160} onClick={() => {
                setDraft(value => ({ ...value, edges: [...value.edges, { id: crypto.randomUUID(), source, target, label: label.trim() }] })); setSource(""); setTarget(""); setLabel("")
              }}>Connect</Button></div>
          </fieldset>}
        </div>
        {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {discard && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted p-3 text-sm"><span className="flex-1">Discard unsaved plan changes?</span><Button type="button" variant="ghost" className="rounded-full" onClick={() => setDiscard(false)}>Keep editing</Button><Button type="button" variant="destructive" className="rounded-full" onClick={onClose}>Discard</Button></div>}
        <DialogFooter><Button type="button" variant="ghost" className="rounded-full" disabled={pending} onClick={() => dirty ? setDiscard(true) : onClose()}>Cancel</Button><Button type="submit" className="rounded-full" disabled={pending}>Save plan</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
