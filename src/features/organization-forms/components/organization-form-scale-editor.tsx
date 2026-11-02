"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FormQuestion } from "../types"

type ScaleQuestion = Extract<FormQuestion, { type: "linear_scale" | "rating" }>

export function OrganizationFormScaleEditor({ question, id, disabled, onChange }: {
  question: ScaleQuestion; id: string; disabled: boolean; onChange: (question: FormQuestion) => void
}) {
  return <div className="grid min-w-0 grid-cols-2 gap-3">
    {question.type === "linear_scale" && <Field>
      <FieldLabel htmlFor={`${id}-min`}>From</FieldLabel>
      <Select value={String(question.min)} disabled={disabled} onValueChange={value => {
        if (value === "0" || value === "1") onChange({ ...question, min: value === "0" ? 0 : 1 })
      }}>
        <SelectTrigger id={`${id}-min`} className="min-h-11 w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem></SelectContent>
      </Select>
    </Field>}
    <Field>
      <FieldLabel htmlFor={`${id}-max`}>{question.type === "rating" ? "Stars" : "To"}</FieldLabel>
      <Select value={String(question.max)} disabled={disabled} onValueChange={value => {
        const max = Number(value)
        if (Number.isInteger(max) && max >= 2 && max <= 10) onChange({ ...question, max })
      }}>
        <SelectTrigger id={`${id}-max`} className="min-h-11 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{Array.from({ length: 9 }, (_, index) => index + 2).map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field className="col-span-2">
      <FieldLabel htmlFor={`${id}-lower-label`}>Label for {question.min}</FieldLabel>
      <Input id={`${id}-lower-label`} value={question.lowerLabel} maxLength={120} placeholder="Optional" disabled={disabled} onChange={event => onChange({ ...question, lowerLabel: event.target.value })} />
    </Field>
    <Field className="col-span-2">
      <FieldLabel htmlFor={`${id}-upper-label`}>Label for {question.max}</FieldLabel>
      <Input id={`${id}-upper-label`} value={question.upperLabel} maxLength={120} placeholder="Optional" disabled={disabled} onChange={event => onChange({ ...question, upperLabel: event.target.value })} />
    </Field>
  </div>
}
