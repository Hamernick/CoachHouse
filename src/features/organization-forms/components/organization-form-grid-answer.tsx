"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { FormAnswer, FormSnapshotQuestion } from "../lib"
import type { FormGridAnswer } from "../lib/form-grid-schema"
import styles from "./organization-form-preview.module.css"

export function OrganizationFormGridAnswer({ question, id, value, error, onChange }: {
  question: Extract<FormSnapshotQuestion, { type: "multiple_choice_grid" | "checkbox_grid" }>
  id: string; value: FormAnswer["value"] | undefined; error?: string
  onChange: (value: FormAnswer["value"]) => void
}) {
  const answers: FormGridAnswer = typeof value === "object" && !Array.isArray(value) ? value : {}
  const change = (rowId: string, selected: string | string[] | undefined) => {
    const next = { ...answers }
    if (selected === undefined || (Array.isArray(selected) && !selected.length)) delete next[rowId]
    else next[rowId] = selected
    onChange(next)
  }
  return <fieldset className="min-w-0 space-y-3">
    <legend className={styles.label}>{question.label}{question.required && <span className="text-muted-foreground ml-1 text-xs">(every row required)</span>}</legend>
    <div id={id} role="group" aria-label={question.label} aria-describedby={error ? `${id}-error` : undefined} tabIndex={-1} className="focus-ring min-w-0 space-y-4 rounded-xl">
      {question.rows.map(row => {
        const selected = answers[row.id]
        const labelId = `${id}-${row.id}-label`
        return <div key={row.id} className="min-w-0 space-y-1">
          <p id={labelId} className="break-words text-sm font-medium [overflow-wrap:anywhere]">{row.label}</p>
          {question.type === "multiple_choice_grid" ? <RadioGroup aria-labelledby={labelId} aria-required={question.required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
            value={typeof selected === "string" ? selected : ""} onValueChange={next => change(row.id, next)} className="gap-0">
            {question.columns.map(column => <Label key={column.id} htmlFor={`${id}-${row.id}-${column.id}`} className={styles.choice}>
              <RadioGroupItem id={`${id}-${row.id}-${column.id}`} value={column.id} />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{column.label}</span>
            </Label>)}
          </RadioGroup> : <div role="group" aria-labelledby={labelId}>
            {question.columns.map(column => <Label key={column.id} htmlFor={`${id}-${row.id}-${column.id}`} className={styles.choice}>
              <Checkbox id={`${id}-${row.id}-${column.id}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} checked={Array.isArray(selected) && selected.includes(column.id)}
                onCheckedChange={checked => {
                  const current = Array.isArray(selected) ? selected : []
                  change(row.id, checked === true ? [...current.filter(entry => entry !== column.id), column.id] : current.filter(entry => entry !== column.id))
                }} />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{column.label}</span>
            </Label>)}
          </div>}
          {selected !== undefined && <Button type="button" variant="ghost" className="min-h-11 rounded-xl" aria-label={`Clear ${row.label}`} onClick={() => change(row.id, undefined)}>Clear selection</Button>}
        </div>
      })}
    </div>
  </fieldset>
}
