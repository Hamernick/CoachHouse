"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { ParticleSelect as Select } from "@/components/ui/particle-ui"
import type { FormQuestion } from "../types"

type ScaleQuestion = Extract<FormQuestion, { type: "linear_scale" | "rating" }>

export function OrganizationFormScaleEditor({ question, id, disabled, onChange }: {
  question: ScaleQuestion; id: string; disabled: boolean; onChange: (question: FormQuestion) => void
}) {
  return <div className="grid min-w-0 grid-cols-2 gap-3">
    {question.type === "linear_scale" && <Field>
      <FieldLabel htmlFor={`${id}-min`}>From</FieldLabel>
      <Select id={`${id}-min`} className="min-h-11 w-full" value={String(question.min)} disabled={disabled} onChange={event => ((value: string) => {
        if (value === "0" || value === "1") onChange({ ...question, min: value === "0" ? 0 : 1 })
      })(event.target.value)}>

        <option value="0">0</option><option value="1">1</option>
      </Select>
    </Field>}
    <Field>
      <FieldLabel htmlFor={`${id}-max`}>{question.type === "rating" ? "Stars" : "To"}</FieldLabel>
      <Select id={`${id}-max`} className="min-h-11 w-full" value={String(question.max)} disabled={disabled} onChange={event => ((value: string) => {
        const max = Number(value)
        if (Number.isInteger(max) && max >= 2 && max <= 10) onChange({ ...question, max })
      })(event.target.value)}>

        {Array.from({ length: 9 }, (_, index) => index + 2).map(value => <option key={value} value={String(value)}>{value}</option>)}
      </Select>
    </Field>
    <Field className="col-span-2">
      <FieldLabel htmlFor={`${id}-lower-label`}>Label for {question.min}</FieldLabel>
      <Input size="2xl" id={`${id}-lower-label`} value={question.lowerLabel} maxLength={120} placeholder="Optional" disabled={disabled} onChange={event => onChange({ ...question, lowerLabel: event.target.value })} />
    </Field>
    <Field className="col-span-2">
      <FieldLabel htmlFor={`${id}-upper-label`}>Label for {question.max}</FieldLabel>
      <Input size="2xl" id={`${id}-upper-label`} value={question.upperLabel} maxLength={120} placeholder="Optional" disabled={disabled} onChange={event => onChange({ ...question, upperLabel: event.target.value })} />
    </Field>
  </div>
}
