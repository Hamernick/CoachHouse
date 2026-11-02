"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { FormAnswer, FormSnapshotQuestion } from "../lib"
import { FORM_OTHER_ID, FORM_OTHER_TEXT_LIMIT, isFormOtherAnswer } from "../lib/form-other-answer"
import styles from "./organization-form-preview.module.css"

type ChoiceQuestion = Extract<FormSnapshotQuestion, { type: "single_choice" | "multiple_choice" }>
export function OrganizationFormChoiceAnswer({ question, id, value, error, onChange }: {
  question: ChoiceQuestion; id: string; value: FormAnswer["value"] | undefined; error?: string
  onChange: (value: FormAnswer["value"]) => void
}) {
  const other = isFormOtherAnswer(value) ? value : null
  const selected = other ? other.optionIds : Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  const choices = question.allowOther ? [...question.options, { id: FORM_OTHER_ID, label: "Other" }] : question.options
  const accessibility = { "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined }
  function select(ids: string[]) {
    onChange(ids.includes(FORM_OTHER_ID) ? { optionIds: ids, otherText: other?.otherText ?? "" }
      : question.type === "single_choice" ? ids[0] ?? "" : ids)
  }
  return <fieldset className={styles.choices}>
    <legend className={styles.label}>{question.label}{question.required && <span className="text-muted-foreground ml-1 text-xs">(required)</span>}</legend>
    {question.type === "single_choice" ? <RadioGroup id={id} aria-label={question.label} tabIndex={-1}
      {...accessibility} aria-required={question.required} value={selected[0] ?? ""} onValueChange={value => select([value])} className="focus-ring gap-0">
      {choices.map(option => <Label key={option.id} htmlFor={`${id}-${option.id}`} className={styles.choice}>
        <RadioGroupItem id={`${id}-${option.id}`} value={option.id} />
        <span className="min-w-0 break-words">{option.label}</span>
      </Label>)}
    </RadioGroup> : <div id={id} role="group" aria-label={question.label} tabIndex={-1}
      aria-describedby={accessibility["aria-describedby"]} className="focus-ring rounded-xl">
      {choices.map(option => <Label key={option.id} htmlFor={`${id}-${option.id}`} className={styles.choice}>
        <Checkbox id={`${id}-${option.id}`} {...accessibility} checked={selected.includes(option.id)}
          onCheckedChange={checked => select(checked === true ? [...selected.filter(entry => entry !== option.id), option.id] : selected.filter(entry => entry !== option.id))} />
        <span className="min-w-0 break-words">{option.label}</span>
      </Label>)}
    </div>}
    {question.allowOther && selected.includes(FORM_OTHER_ID) && <div className="mt-2 min-w-0 space-y-1.5">
      <Label htmlFor={`${id}-other-text`}>Other answer</Label>
      <Input id={`${id}-other-text`} value={other?.otherText ?? ""} maxLength={FORM_OTHER_TEXT_LIMIT}
        {...accessibility} aria-required className={`${styles.input} w-full min-w-0`} placeholder="Your answer…"
        onChange={event => onChange({ optionIds: selected, otherText: event.target.value })} />
    </div>}
  </fieldset>
}
