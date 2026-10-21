"use client"

import { useId } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import ArrowDownIcon from "lucide-react/dist/esm/icons/arrow-down"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import type { ParticleConnection } from "../types"
import {
  createDecisionOutcome,
  decisionOutcomeRemovalReason,
  moveDecisionItem,
  removeDecisionOutcome,
  selectDecisionOutcome,
  type DecisionParticle,
} from "../lib/particle-decision"
import { ParticleDecisionCriteria } from "./particle-decision-criteria"
import { useParticleSurface } from "./particle-surface"
import { cn } from "@/lib/utils"
import styles from "./particle-editor.module.css"

export function ParticleDecisionEditor({
  particle,
  connections,
  disabled,
  onChange,
}: {
  particle: DecisionParticle
  connections: readonly ParticleConnection[]
  disabled: boolean
  onChange: (particle: DecisionParticle) => void
}) {
  const id = useId()
  const surface = useParticleSurface(
    "ParticleDecisionEditor",
    "particle-decision-editor.tsx"
  )
  return (
    <div className="flex flex-col gap-5" {...surface("editor")}>
      <ParticleDecisionCriteria
        particle={particle}
        disabled={disabled}
        onChange={onChange}
      />
      <section
        aria-labelledby={`${id}-outcomes`}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id={`${id}-outcomes`} className="text-sm font-medium">
            Outcomes
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Add outcome"
            disabled={disabled || particle.data.outcomes.length >= 12}
            onClick={() =>
              onChange({
                ...particle,
                data: {
                  ...particle.data,
                  outcomes: [
                    ...particle.data.outcomes,
                    createDecisionOutcome(crypto.randomUUID()),
                  ],
                },
              })
            }
          >
            <PlusIcon aria-hidden />
            Add outcome
          </Button>
        </div>
        {particle.data.outcomes.map((outcome, index) => {
          const reason = decisionOutcomeRemovalReason(
            particle,
            outcome.id,
            connections
          )
          return (
            <div
              key={outcome.id}
              {...surface(`outcome:${outcome.id}`)}
              className={cn("flex flex-col gap-2", styles.collectionItem)}
            >
              <Field>
                <FieldLabel htmlFor={`${id}-${outcome.id}`}>
                  Outcome {index + 1}
                </FieldLabel>
                <Input
                  id={`${id}-${outcome.id}`}
                  value={outcome.label}
                  required
                  maxLength={240}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...particle,
                      data: {
                        ...particle.data,
                        outcomes: particle.data.outcomes.map((item) =>
                          item.id === outcome.id
                            ? { ...item, label: event.target.value }
                            : item
                        ),
                      },
                    })
                  }
                />
              </Field>
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move outcome ${index + 1} up`}
                  disabled={disabled || index === 0}
                  onClick={() =>
                    onChange(
                      moveDecisionItem(particle, "outcomes", outcome.id, -1)
                    )
                  }
                >
                  <ArrowUpIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Move outcome ${index + 1} down`}
                  disabled={
                    disabled || index === particle.data.outcomes.length - 1
                  }
                  onClick={() =>
                    onChange(
                      moveDecisionItem(particle, "outcomes", outcome.id, 1)
                    )
                  }
                >
                  <ArrowDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove outcome ${index + 1}`}
                  aria-describedby={
                    reason ? `${id}-${outcome.id}-reason` : undefined
                  }
                  disabled={disabled || Boolean(reason)}
                  onClick={() =>
                    onChange(
                      removeDecisionOutcome(particle, outcome.id, connections)
                    )
                  }
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
              {reason ? (
                <p
                  id={`${id}-${outcome.id}-reason`}
                  className="text-muted-foreground text-xs"
                >
                  {reason}
                </p>
              ) : null}
            </div>
          )
        })}
      </section>
      <Field {...surface("selection")}>
        <FieldLabel htmlFor={`${id}-result`}>Selected outcome</FieldLabel>
        <div className="flex items-center gap-2">
          <Select
            value={particle.data.selectedOutcome ?? ""}
            disabled={disabled}
            onValueChange={(value) =>
              onChange(selectDecisionOutcome(particle, value))
            }
          >
            <SelectTrigger id={`${id}-result`} className="min-w-0 flex-1">
              <SelectValue placeholder="Not decided" />
            </SelectTrigger>
            <SelectContent>
              {particle.data.outcomes.map((outcome) => (
                <SelectItem key={outcome.id} value={outcome.id}>
                  {outcome.label || "Untitled outcome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || particle.data.selectedOutcome === null}
            onClick={() => onChange(selectDecisionOutcome(particle, null))}
          >
            Clear result
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Saving a result highlights its branch. Criteria stay unchanged; no
          work runs automatically.
        </p>
      </Field>
    </div>
  )
}
