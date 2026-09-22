"use client"
import { useId } from "react"
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { ObjectiveDecisionDraft } from "../types"
export function ObjectiveDecisionFields({
  value,
  onChange,
  disabled,
}: {
  value: ObjectiveDecisionDraft | null | undefined
  onChange: (value: ObjectiveDecisionDraft) => void
  disabled: boolean
}) {
  const id = useId()
  const fields = value ?? { question: "", yesAction: "", noAction: "" }
  return (
    <FieldSet>
      <FieldLegend>Decision (optional)</FieldLegend>
      {(
        [
          ["question", "Decision question", "Do we have a training site?"],
          ["yesAction", "If yes", "Confirm the first session…"],
          ["noAction", "If no", "Find a community partner…"],
        ] as const
      ).map(([key, label, placeholder]) => (
        <Field key={key}>
          <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
          <Input
            id={`${id}-${key}`}
            name={key}
            className="min-h-11 text-base"
            maxLength={160}
            disabled={disabled}
            value={fields[key]}
            placeholder={placeholder}
            onChange={(event) =>
              onChange({ ...fields, [key]: event.target.value })
            }
          />
        </Field>
      ))}
    </FieldSet>
  )
}
