"use client"

import { useId, useState } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import ArrowDownIcon from "lucide-react/dist/esm/icons/arrow-down"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  decisionCriteriaOrder,
  moveDecisionItem,
  replaceDecisionCriterion,
  type DecisionCriterion,
  type DecisionParticle,
} from "../lib/particle-decision"
import { useParticleSurface } from "./particle-surface"
import { cn } from "@/lib/utils"
import styles from "./particle-editor.module.css"

const PAGE_SIZE = 8

export function ParticleDecisionCriteria({
  particle,
  disabled,
  onChange,
}: {
  particle: DecisionParticle
  disabled: boolean
  onChange: (particle: DecisionParticle) => void
}) {
  const id = useId()
  const surface = useParticleSurface(
    "ParticleDecisionCriteria",
    "particle-decision-criteria.tsx"
  )
  const [page, setPage] = useState(0)
  const criteria = decisionCriteriaOrder(particle.data.criteria)
  const pages = Math.max(1, Math.ceil(criteria.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const start = currentPage * PAGE_SIZE
  return (
    <section
      {...surface("criteria")}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-heading`} className="text-sm font-medium">
          Criteria
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Add criterion"
          disabled={disabled || criteria.length >= 200}
          onClick={() => {
            const criterion: DecisionCriterion = {
              id: crypto.randomUUID(),
              title: "New criterion",
              status: "backlog",
              order: criteria.length,
            }
            onChange({
              ...particle,
              data: {
                ...particle.data,
                criteria: [...criteria, criterion].map((item, order) => ({
                  ...item,
                  order,
                })),
              },
            })
            setPage(Math.floor(criteria.length / PAGE_SIZE))
          }}
        >
          <PlusIcon aria-hidden />
          Add criterion
        </Button>
      </div>
      {criteria.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add the requirements you want to evaluate.
        </p>
      ) : null}
      {criteria.slice(start, start + PAGE_SIZE).map((criterion, offset) => {
        const index = start + offset
        return (
          <div
            key={criterion.id}
            {...surface(`criterion:${criterion.id}`)}
            className={cn("flex flex-col gap-2", styles.collectionItem)}
          >
            <Field>
              <FieldLabel htmlFor={`${id}-${criterion.id}`}>
                Criterion {index + 1}
              </FieldLabel>
              <Input
                id={`${id}-${criterion.id}`}
                value={criterion.title}
                disabled={disabled}
                required
                maxLength={240}
                onChange={(event) =>
                  onChange(
                    replaceDecisionCriterion(particle, {
                      ...criterion,
                      title: event.target.value,
                    })
                  )
                }
              />
            </Field>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move criterion ${index + 1} up`}
                disabled={disabled || index === 0}
                onClick={() => {
                  onChange(
                    moveDecisionItem(particle, "criteria", criterion.id, -1)
                  )
                  setPage(Math.floor((index - 1) / PAGE_SIZE))
                }}
              >
                <ArrowUpIcon aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move criterion ${index + 1} down`}
                disabled={disabled || index === criteria.length - 1}
                onClick={() => {
                  onChange(
                    moveDecisionItem(particle, "criteria", criterion.id, 1)
                  )
                  setPage(Math.floor((index + 1) / PAGE_SIZE))
                }}
              >
                <ArrowDownIcon aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove criterion ${index + 1}`}
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...particle,
                    data: {
                      ...particle.data,
                      criteria: criteria
                        .filter((item) => item.id !== criterion.id)
                        .map((item, order) => ({ ...item, order })),
                    },
                  })
                }
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          </div>
        )
      })}
      {pages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous criteria
          </Button>
          <span className="text-muted-foreground text-xs" aria-live="polite">
            Page {currentPage + 1} of {pages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next criteria
          </Button>
        </div>
      ) : null}
    </section>
  )
}
