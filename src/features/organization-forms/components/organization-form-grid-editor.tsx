"use client"

import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { Label } from "@/components/ui/label"
import { FORM_GRID_LIMITS } from "../lib/form-grid-schema"
import type { FormQuestion } from "../types"

type GridQuestion = Extract<FormQuestion, { type: "multiple_choice_grid" | "checkbox_grid" }>
export function OrganizationFormGridEditor({ question, id, disabled, onChange }: {
  question: GridQuestion; id: string; disabled: boolean; onChange: (question: FormQuestion) => void
}) {
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    {(["rows", "columns"] as const).map(axis => {
      const singular = axis === "rows" ? "Row" : "Column"
      return <fieldset key={axis} className="min-w-0 space-y-2" disabled={disabled}>
        <legend className="mb-2 text-sm font-medium">{axis === "rows" ? "Rows" : "Columns"}</legend>
        {question[axis].map((entry, index) => <div key={entry.id} className="flex min-w-0 items-center gap-2">
          <Label htmlFor={`${id}-${entry.id}`} className="sr-only">{singular} {index + 1}</Label>
          <Input size="2xl" id={`${id}-${entry.id}`} value={entry.label} maxLength={240} placeholder={`${singular} ${index + 1}`} className="min-h-11 min-w-0"
            onChange={event => onChange({ ...question, [axis]: question[axis].map(item => item.id === entry.id ? { ...item, label: event.target.value } : item) })} />
          <Button color="primary" type="button" variant="ghost" size="lg" uniform className="size-11 shrink-0" aria-label={`Remove ${singular.toLowerCase()} ${index + 1}`}
            onClick={() => onChange({ ...question, [axis]: question[axis].filter(item => item.id !== entry.id) })}><Trash2Icon aria-hidden /></Button>
        </div>)}
        <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={disabled || question[axis].length >= FORM_GRID_LIMITS[axis]}
          onClick={() => onChange({ ...question, [axis]: [...question[axis], { id: crypto.randomUUID(), label: "" }] })}>Add {singular.toLowerCase()}</Button>
      </fieldset>
    })}
  </div>
}
