"use client"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
    <FieldGroup>
      <Field><FieldLabel htmlFor={`${id}-title`}>Objective</FieldLabel>
        <Input id={`${id}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={240} disabled={pending} />
      </Field>
      <Field><FieldLabel htmlFor={`${id}-description`}>Details</FieldLabel>
        <Textarea id={`${id}-description`} value={description} onChange={event => setDescription(event.target.value)} maxLength={10000} disabled={pending} />
      </Field>
      <Field><FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
        <Select value={status} onValueChange={value => setStatus(value as WorkspaceObjectiveStatus)} disabled={pending}>
          <SelectTrigger id={`${id}-status`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="todo">To do</SelectItem><SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem><SelectItem value="done">Done</SelectItem>
          </SelectGroup></SelectContent>
        </Select>
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="rounded-full" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" className="rounded-full" disabled={pending || !title.trim()}>Save</Button>
      </div>
    </FieldGroup>
  </form>
}
