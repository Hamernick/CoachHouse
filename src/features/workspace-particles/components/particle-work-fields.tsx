"use client"

import { useId } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { replaceParticleSteps } from "../lib/particle-editing"
import type { Particle } from "../types"
import styles from "./particle-editor.module.css"

export function ParticleWorkFields({
  draft,
  editable,
  setDraft,
}: {
  draft: Particle
  editable: boolean
  setDraft: (particle: Particle) => void
}) {
  const id = useId()
  return (
    <>
      {draft.type === "objective" ? (
        <FieldGroup className="grid-cols-2">
          {(["current", "target"] as const).map((field) => (
            <Field key={field}>
              <FieldLabel htmlFor={`${id}-${field}`}>
                {field === "current" ? "Current" : "Target"}
              </FieldLabel>
              <Input
                id={`${id}-${field}`}
                type="number"
                min={0}
                step="any"
                disabled={!editable}
                value={draft.data[field] ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    data: {
                      ...draft.data,
                      [field]:
                        event.target.value === ""
                          ? null
                          : event.target.valueAsNumber,
                    },
                  })
                }
              />
            </Field>
          ))}
          <Field className="col-span-2">
            <FieldLabel htmlFor={`${id}-unit`}>Unit</FieldLabel>
            <Input
              id={`${id}-unit`}
              value={draft.data.unit}
              disabled={!editable}
              maxLength={80}
              placeholder="e.g. attendees…"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  data: { ...draft.data, unit: event.target.value },
                })
              }
            />
          </Field>
        </FieldGroup>
      ) : null}
      {draft.type === "workflow" || (draft.type === "activity" && (!draft.data.widget || draft.data.steps.length > 0)) ? (
        <FieldSet>
          <FieldLegend>Checklist</FieldLegend>
          {draft.data.steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2">
              <Input
                aria-label={`Step ${index + 1}`}
                value={step.title}
                disabled={!editable}
                maxLength={240}
                onChange={(event) =>
                  setDraft(
                    replaceParticleSteps(
                      draft,
                      draft.data.steps.map((item) =>
                        item.id === step.id
                          ? { ...item, title: event.target.value }
                          : item
                      )
                    )
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={styles.rowAction}
                disabled={!editable}
                aria-label={`Remove step ${index + 1}`}
                onClick={() =>
                  setDraft(
                    replaceParticleSteps(
                      draft,
                      draft.data.steps.filter((item) => item.id !== step.id)
                    )
                  )
                }
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!editable || draft.data.steps.length >= 200}
            onClick={() =>
              setDraft(
                replaceParticleSteps(draft, [
                  ...draft.data.steps,
                  {
                    id: crypto.randomUUID(),
                    title: "New step",
                    status: "backlog",
                    order: draft.data.steps.length,
                  },
                ])
              )
            }
          >
            <PlusIcon aria-hidden />
            Add step
          </Button>
        </FieldSet>
      ) : null}
    </>
  )
}
