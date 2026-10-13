"use client"

import { ParticleWidgetPreview } from "./particle-widget-preview"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Particle } from "../types"
import { getParticleProgress } from "../lib/particle-registry"
import { replaceParticleSteps } from "../lib/particle-editing"
import { ParticleProgress } from "./particle-frame"

export type ParticlePreviewProps = {
  particle: Particle
  editable: boolean
  onEdit: (particle: Particle) => void
  onOpen: () => void
}

export function ParticleChecklist({
  particle,
  editable,
  onEdit,
}: ParticlePreviewProps) {
  if (particle.type !== "activity" && particle.type !== "workflow") return null
  if (particle.type === "activity" && particle.data.widget)
    return (
      <ParticleWidgetPreview
        particle={particle}
        editable={editable}
        onEdit={onEdit}
        onOpen={() => {}}
      />
    )
  const progress = getParticleProgress(particle)
  return (
    <div className="flex flex-col gap-3">
      <ParticleProgress
        value={progress.percent}
        label={`${progress.completed} of ${progress.total} complete`}
      />
      <div className="flex flex-col gap-1">
        {[...particle.data.steps]
          .sort((a, b) => a.order - b.order)
          .slice(0, 4)
          .map((step) => (
            <label
              key={step.id}
              className="nodrag nopan flex min-h-9 cursor-pointer items-center gap-2 text-xs"
            >
              <Checkbox
                disabled={!editable}
                checked={step.status === "done"}
                onCheckedChange={(checked) =>
                  onEdit(
                    replaceParticleSteps(
                      particle,
                      particle.data.steps.map((item) =>
                        item.id === step.id
                          ? {
                              ...item,
                              status: checked === true ? "done" : "backlog",
                            }
                          : item
                      )
                    )
                  )
                }
              />
              <span className="line-clamp-2">{step.title}</span>
            </label>
          ))}
      </div>
      {progress.total === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add a checklist in the inspector.
        </p>
      ) : null}
      {progress.total > 4 ? (
        <p className="text-muted-foreground text-xs">
          {progress.total - 4} more steps
        </p>
      ) : null}
    </div>
  )
}

function ObjectivePreview({ particle }: ParticlePreviewProps) {
  if (particle.type !== "objective") return null
  const { current, target, unit } = particle.data
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        {particle.description || "Define the outcome you want to achieve."}
      </p>
      {target !== null ? (
        <ParticleProgress
          value={current !== null && target > 0 ? (current / target) * 100 : 0}
          label={`${current ?? "Unmeasured"} / ${target} ${unit}`.trim()}
        />
      ) : (
        <p className="text-xs">No target set</p>
      )}
    </div>
  )
}

function CalendarPreview({ particle, onOpen }: ParticlePreviewProps) {
  if (particle.type !== "calendar") return null
  const entries = [...particle.data.entries].sort(
    (a, b) =>
      (a.scheduledAt ?? "z").localeCompare(b.scheduledAt ?? "z") ||
      a.order - b.order
  )
  const complete = entries.filter(
    (entry) => entry.status === "published"
  ).length
  return (
    <div className="flex flex-col gap-2">
      <ParticleProgress
        value={entries.length ? (complete / entries.length) * 100 : 0}
        label={`${entries.length} items · ${complete} published`}
      />
      {entries.slice(0, 4).map((entry) => (
        <Button
          key={entry.id}
          variant="ghost"
          className="nodrag nopan h-auto min-h-9 justify-start px-0 text-left text-xs whitespace-normal"
          onClick={onOpen}
        >
          {entry.delivery === "automatic"
            ? "Auto"
            : (entry.scheduledAt?.slice(5, 10) ?? "Draft")}{" "}
          · {entry.title}
        </Button>
      ))}
    </div>
  )
}

function DecisionPreview({ particle, onEdit, editable }: ParticlePreviewProps) {
  if (particle.type !== "decision") return null
  const progress = getParticleProgress(particle)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs">
        {progress.completed} of {progress.total} criteria met
      </p>
      <div className="flex flex-wrap gap-2">
        {particle.data.outcomes.map((outcome) => (
          <Button
            key={outcome.id}
            variant={
              outcome.id === particle.data.selectedOutcome
                ? "secondary"
                : "outline"
            }
            size="sm"
            className="nodrag nopan min-h-11 md:min-h-8"
            aria-pressed={outcome.id === particle.data.selectedOutcome}
            disabled={!editable}
            onClick={() =>
              onEdit({
                ...particle,
                data: { ...particle.data, selectedOutcome: outcome.id },
              })
            }
          >
            {outcome.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function PeoplePreview({ particle }: ParticlePreviewProps) {
  return particle.type === "people" ? (
    <p className="text-xs">
      {particle.data.personIds.length} people
      {particle.data.segment ? ` · ${particle.data.segment}` : ""}
    </p>
  ) : null
}
function MetricPreview({ particle }: ParticlePreviewProps) {
  if (particle.type !== "metric") return null
  const latest = [...particle.data.observations]
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-medium tabular-nums">
        {latest ? `${latest.value} ${particle.data.unit}` : "No observations"}
      </p>
      {particle.data.target !== null ? (
        <p className="text-muted-foreground text-xs">
          Target: {particle.data.target}
        </p>
      ) : null}
      {particle.data.demo ? (
        <p className="text-muted-foreground text-xs">Demo data</p>
      ) : null}
    </div>
  )
}
function FinancePreview({ particle }: ParticlePreviewProps) {
  if (particle.type !== "finance") return null
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm tabular-nums">
        {particle.data.committed === null
          ? "Unrecorded"
          : `${particle.data.currency} ${particle.data.committed}`}{" "}
        committed
      </p>
      <p className="text-muted-foreground text-xs">
        {particle.data.target === null
          ? "No target set"
          : `Target: ${particle.data.currency} ${particle.data.target}`}
      </p>
      {particle.data.demo ? (
        <p className="text-muted-foreground text-xs">Demo data</p>
      ) : null}
    </div>
  )
}

export const PARTICLE_PREVIEWS = {
  objective: ObjectivePreview,
  activity: ParticleChecklist,
  workflow: ParticleChecklist,
  calendar: CalendarPreview,
  people: PeoplePreview,
  decision: DecisionPreview,
  metric: MetricPreview,
  finance: FinancePreview,
} satisfies Record<
  Particle["type"],
  (props: ParticlePreviewProps) => React.ReactNode
>
