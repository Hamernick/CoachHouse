"use client"

import { ParticleButton as Button, ParticleInput as Input, ParticleInput as InputGroupInput } from "@/components/ui/particle-ui"
import { useState } from "react"
import { Plus, Trash2, MoreHorizontal } from "lucide-react"

import { ParticleMenu } from "@/components/ui/particle-ui"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"

import { Label } from "@/components/ui/label"
import { ParticleSelect } from "@/components/ui/particle-ui"
import type { ObjectiveStep } from "../island-types"
import { planDraftSchema, type PlanDraft } from "../plan-types"
import { clearRemovedChoices } from "../lib/plan-progress"

function StepSelect({ value, onChange, steps, label, disabled }: { value: string; onChange: (id: string) => void; steps: { id: string; title: string }[]; label: string; disabled?: boolean }) {
  return <ParticleSelect value={value || "unselected"} onChange={event => { const id = event.target.value;  if (id && id !== "unselected") onChange(id)  }} disabled={disabled} aria-label={label} className="min-w-0 flex-1 rounded-xl shadow-none">
<option value="" disabled>{label}</option><option value="unselected" disabled className="hidden">{label}</option>{steps.map(step => <option key={step.id} value={step.id}>{step.title}</option>)}</ParticleSelect>
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
        <div className="flex flex-col gap-1"><Label htmlFor="objective-plan-title">Plan name</Label><Input size="2xl" autoFocus id="objective-plan-title" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={240} required disabled={pending} className="rounded-xl shadow-none" /></div>
        <div className="flex flex-col gap-2">
          {draft.steps.map((step, index) => <InputGroup key={step.id} className="items-center gap-0 rounded-2xl border border-border/70 p-1">
            <InputGroupInput size="2xl" data-slot="input-group-control" aria-label={`Item ${index + 1} title`} value={step.title} maxLength={240} required disabled={pending} onChange={event => patch(step.id, { title: event.target.value })} className="min-w-0 border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" />
            <InputGroupAddon>
              <ParticleMenu modal>
                <ParticleMenu.Trigger ><Button color="secondary" uniform type="button" variant="ghost" size="lg" disabled={pending} className="size-8 rounded-full" aria-label={`Item ${index + 1} options`}><MoreHorizontal aria-hidden /></Button></ParticleMenu.Trigger>
                <ParticleMenu.Content align="end" minWidth={0} width={224}>
                  <>
                    {decisionsAvailable && <ParticleMenu.Sub>
                      <ParticleMenu.SubTrigger disabled={pending}>Type</ParticleMenu.SubTrigger>
                      <ParticleMenu.SubContent minWidth={0} width={224}>
                        <ParticleMenu.RadioGroup value={draft.decisions?.some(item => item.stepId === step.id) ? "decision" : "action"} onChange={value => setDraft(current => ({ ...current, decisions: [...(current.decisions ?? []).filter(item => item.stepId !== step.id), ...(value === "decision" ? [{ stepId: step.id, selectedEdgeId: null }] : [])] }))}>
                          <ParticleMenu.RadioItem value="action" disabled={pending}>Action</ParticleMenu.RadioItem>
                          <ParticleMenu.RadioItem value="decision" disabled={pending}>Decision</ParticleMenu.RadioItem>
                        </ParticleMenu.RadioGroup>
                      </ParticleMenu.SubContent>
                    </ParticleMenu.Sub>}
                    {!draft.decisions?.some(item => item.stepId === step.id) && <ParticleMenu.Sub>
                      <ParticleMenu.SubTrigger disabled={pending}>Status</ParticleMenu.SubTrigger>
                      <ParticleMenu.SubContent minWidth={0} width={224}>
                        <ParticleMenu.RadioGroup value={step.status} onChange={value => patch(step.id, { status: value as typeof step.status })}>
                          <ParticleMenu.RadioItem value="todo" disabled={pending}>To do</ParticleMenu.RadioItem>
                          <ParticleMenu.RadioItem value="in_progress" disabled={pending}>In progress</ParticleMenu.RadioItem>
                          <ParticleMenu.RadioItem value="blocked" disabled={pending}>Blocked</ParticleMenu.RadioItem>
                          <ParticleMenu.RadioItem value="done" disabled={pending}>Done</ParticleMenu.RadioItem>
                        </ParticleMenu.RadioGroup>
                      </ParticleMenu.SubContent>
                    </ParticleMenu.Sub>}
                    <ParticleMenu.Item className="text-destructive" disabled={pending} onSelect={() => setDraft(value => clearRemovedChoices({ ...value, decisions: value.decisions?.filter(item => item.stepId !== step.id), steps: value.steps.filter(item => item.id !== step.id), edges: value.edges.filter(edge => edge.source !== step.id && edge.target !== step.id) }))}>
                      <Trash2 aria-hidden />Delete
                    </ParticleMenu.Item>
                  </>
                </ParticleMenu.Content>
              </ParticleMenu>
            </InputGroupAddon>
          </InputGroup>)}
          <div className="flex flex-wrap gap-2">
            <Button color="secondary" size="lg" type="button" variant="ghost" className="rounded-full" disabled={pending || draft.steps.length >= 80} onClick={() => setDraft(value => ({ ...value, steps: [...value.steps, { id: crypto.randomUUID(), title: "", status: "todo", expectedUpdatedAt: null }] }))}><Plus aria-hidden data-icon="inline-start" />Add item</Button>
            {allSteps.some(step => !draft.steps.some(item => item.id === step.id)) && <StepSelect disabled={pending || draft.steps.length >= 80} value="" label="Reuse saved item" steps={allSteps.filter(step => !draft.steps.some(item => item.id === step.id))} onChange={id => {
              const step = allSteps.find(item => item.id === id)!
              setDraft(value => ({ ...value, steps: [...value.steps, { id, title: step.title, status: step.status, expectedUpdatedAt: step.updatedAt }] }))
            }} />}
          </div>
        </div>
        {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {discard && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted p-3 text-sm"><span className="flex-1">Discard unsaved plan changes?</span><Button color="secondary" size="lg" type="button" variant="ghost" className="rounded-full" onClick={() => setDiscard(false)}>Keep editing</Button><Button color="danger" size="lg" type="button" variant="solid" className="rounded-full" onClick={onClose}>Discard</Button></div>}
        <div className="flex items-center justify-end gap-2"><Button color="secondary" size="lg" type="button" variant="ghost" className="rounded-full" disabled={pending} onClick={() => dirty ? setDiscard(true) : onClose()}>Cancel</Button><Button color="primary" size="lg" type="submit" className="rounded-full" disabled={pending}>Save plan</Button></div>
      </form>
  </section>
}
