"use client"

import StarIcon from "lucide-react/dist/esm/icons/star"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { FormAnswer, FormSnapshotQuestion } from "../lib"
import styles from "./organization-form-preview.module.css"

export function OrganizationFormScaleAnswer({ question, id, value, error, onChange }: {
  question: Extract<FormSnapshotQuestion, { type: "linear_scale" | "rating" }>
  id: string; value: FormAnswer["value"] | undefined; error?: string
  onChange: (value: FormAnswer["value"]) => void
}) {
  const rating = question.type === "rating"
  return <fieldset className={styles.choices}>
    <legend className={styles.label}>{question.label}{question.required && <span className="text-muted-foreground ml-1 text-xs">(required)</span>}</legend>
    <RadioGroup id={id} aria-label={question.label} tabIndex={-1} aria-required={question.required}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      value={typeof value === "number" ? String(value) : ""} onValueChange={value => onChange(Number(value))}
      className="focus-ring flex flex-wrap gap-1 rounded-xl">
      {Array.from({ length: question.max - question.min + 1 }, (_, index) => question.min + index).map(number => {
        const endpoint = number === question.min ? question.lowerLabel : number === question.max ? question.upperLabel : ""
        const name = `${number}${rating ? ` of ${question.max} stars` : ""}${endpoint ? `: ${endpoint}` : ""}`
        return <Label key={number} htmlFor={`${id}-${number}`} className="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-2 py-2">
          <RadioGroupItem id={`${id}-${number}`} value={String(number)} aria-label={name} />
          {rating && <StarIcon aria-hidden className={`size-4 shrink-0 ${typeof value === "number" && number <= value ? "fill-current" : ""}`} />}
          <span className="tabular-nums">{number}</span>
        </Label>
      })}
    </RadioGroup>
    {(question.lowerLabel || question.upperLabel) && <div className="text-muted-foreground mt-2 flex justify-between gap-4 text-xs">
      <span className="min-w-0 break-words">{question.lowerLabel && `${question.min}: ${question.lowerLabel}`}</span>
      <span className="min-w-0 break-words text-right">{question.upperLabel && `${question.max}: ${question.upperLabel}`}</span>
    </div>}
    {typeof value === "number" && <Button type="button" variant="ghost" size="sm" className="mt-1 min-h-11" onClick={() => onChange("")}>Clear selection</Button>}
  </fieldset>
}
