"use client"

import { ParticleButton as Button, ParticleTextarea as Textarea, ParticleInput as InputGroupInput } from "@/components/ui/particle-ui"
import { useId, useState } from "react"

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import { Check } from "lucide-react"

import { ParticleSelect } from "@/components/ui/particle-ui"
import type { WorkspaceObjectiveRecord, WorkspaceObjectiveStatus } from "../types"
import type { ObjectiveEdit } from "../island-types"

export function ObjectiveEditForm({ objective, pending, onSave, onCancel }: {
  objective: WorkspaceObjectiveRecord; pending: boolean
  onSave: (input: ObjectiveEdit) => Promise<boolean>; onCancel: () => void
}) {
  const id = useId()
  const [baseline] = useState({ id: objective.id, updatedAt: objective.updatedAt })
  const [title, setTitle] = useState(objective.title)
  const [description, setDescription] = useState(objective.description ?? "")
  const [status, setStatus] = useState<WorkspaceObjectiveStatus>(objective.status)
  return <form onSubmit={async event => {
    event.preventDefault()
    if (await onSave({ id: baseline.id, expectedUpdatedAt: baseline.updatedAt, title, description, status })) onCancel()
  }}>
    <FieldGroup className="gap-3">
      <Field><FieldLabel htmlFor={`${id}-title`}>Objective</FieldLabel>
        <InputGroup className="items-center gap-0 rounded-2xl border border-border/70 p-1"><InputGroupInput size="2xl" data-slot="input-group-control" autoFocus id={`${id}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={240} disabled={pending} className="min-w-0 border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" /><InputGroupAddon><Button color="secondary" uniform type="submit" variant="ghost" size="lg" className="size-9 rounded-full" aria-label="Save" disabled={pending || !title.trim()}><Check aria-hidden /></Button></InputGroupAddon></InputGroup>
      </Field>
      <Field><FieldLabel htmlFor={`${id}-description`}>Details</FieldLabel>
        <Textarea size="2xl" id={`${id}-description`} value={description} onChange={event => setDescription(event.target.value)} maxLength={10000} disabled={pending} />
      </Field>
      <Field><FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
        <ParticleSelect value={status} onChange={event => { const value = event.target.value; return (setStatus(value as WorkspaceObjectiveStatus)); }} disabled={pending} id={`${id}-status`}>
<option value="" disabled>Choose…</option><>
            <option value="todo">To do</option><option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option><option value="done">Done</option>
          </></ParticleSelect>
      </Field>
      <div className="flex justify-end gap-2">
        <Button color="secondary" type="button" variant="ghost" size="md" className="rounded-full" disabled={pending} onClick={onCancel}>Cancel</Button>

      </div>
    </FieldGroup>
  </form>
}
