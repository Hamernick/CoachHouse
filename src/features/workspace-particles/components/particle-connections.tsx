"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

import {
  isWorkspaceToolId,
  workspaceToolLabel,
} from "../lib/workspace-tool-contract"
import { useId, useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { ParticleSelect } from "@/components/ui/particle-ui"

import { particleConnectionSchema } from "../lib/particle-schema"
import { PARTICLE_RELATIONSHIP_LABELS } from "../lib/connection-editing"
import type { Particle, ParticleConnection, ParticleGraph } from "../types"
import type { useParticleConnections } from "../hooks/use-particle-connections"

export function ParticleConnections({
  particle,
  graph,
  editable,
  actions,
  visibleToolIds = [],
}: {
  particle: Particle
  graph: ParticleGraph
  editable: boolean
  visibleToolIds?: readonly string[]
  actions: ReturnType<typeof useParticleConnections>
}) {
  const id = useId()
  const [target, setTarget] = useState("")
  const [relationship, setRelationship] =
    useState<ParticleConnection["relationship"]>("dependency")
  const [outcome, setOutcome] = useState("")
  const connections = graph.connections.filter(
    (edge) => edge.source === particle.id || edge.target === particle.id
  )
  const targets = graph.particles.filter(
    (item) =>
      !item.canvasHidden &&
      (item.id !== particle.id || relationship === "feedback")
  )
  const decision = particle.type === "decision" ? particle : null

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="nodrag nopan nowheel flex flex-col gap-3 border-t p-4"
    >
      <h3 id={`${id}-title`} className="text-sm font-medium">
        Connections
      </h3>
      {connections.length ? (
        <ul className="divide-border divide-y">
          {connections.map((edge) => {
            const source = graph.particles.find(
              (item) => item.id === edge.source
            )
            const target = graph.particles.find(
              (item) => item.id === edge.target
            )
            const outcomeLabel =
              source?.type === "decision"
                ? source.data.outcomes.find((item) => item.id === edge.outcome)
                    ?.label
                : undefined
            const sourceTitle =
              source?.title ?? workspaceToolLabel(edge.source) ?? "Particle"
            const targetTitle =
              target?.title ?? workspaceToolLabel(edge.target) ?? "Particle"
            const hidden =
              source?.canvasHidden ||
              target?.canvasHidden ||
              (isWorkspaceToolId(edge.source) &&
                !visibleToolIds.includes(edge.source)) ||
              (isWorkspaceToolId(edge.target) &&
                !visibleToolIds.includes(edge.target))
            const label = `${sourceTitle} → ${targetTitle}`
            return (
              <li
                key={edge.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-sm break-words">{label}</p>
                  <p className="text-muted-foreground text-xs">
                    {outcomeLabel ??
                      PARTICLE_RELATIONSHIP_LABELS[edge.relationship]}
                    {hidden ? " · In drawer" : ""}
                  </p>
                </div>
                {edge.relationship !== "feedback" &&
                edge.relationship !== "related_resource" ? (
                  <Button color="secondary" size="lg"
                    type="button"
                    variant="ghost"
                    className="min-h-11 rounded-xl text-xs"
                    disabled={!editable || Boolean(hidden)}
                    aria-label={`Insert Resource between ${source?.title} and ${target?.title}`}
                    onClick={() => void actions.insert(edge.id, edge.revision)}

                  >
                    Insert Resource
                  </Button>
                ) : null}
                <Button color="secondary" size="lg"
                  type="button"
                  variant="ghost"
                  className="min-h-11 rounded-xl text-xs"
                  disabled={!editable}
                  aria-label={`Disconnect ${label}`}
                  onClick={() =>
                    void actions.disconnect(edge.id, edge.revision)
                  }

                >
                  Disconnect
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No connections yet.</p>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            await actions.connect({
              source: particle.id,
              target,
              relationship,
              sourceHandle:
                relationship === "decision_outcome"
                  ? `outcome:${outcome}`
                  : "out",
              targetHandle: isWorkspaceToolId(target)
                ? "workspace-card-target-left"
                : "in",
            })
          )
            setTarget("")
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-relationship`}>Relationship</FieldLabel>
            <ParticleSelect value={relationship} disabled={!editable} onChange={event => { const value = event.target.value;
                const result =
                  particleConnectionSchema.shape.relationship.safeParse(value)
                if (result.success) {
                  setRelationship(result.data)
                  setTarget("")
                }
               }} id={`${id}-relationship`} className="w-full">
<option value="" disabled>Choose…</option>
                {Object.entries(PARTICLE_RELATIONSHIP_LABELS)
                  .filter(([key]) => key !== "decision_outcome" || decision)
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </ParticleSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-target`}>Connect to</FieldLabel>
            <ParticleSelect value={target} disabled={
                !editable ||
                (!targets.length &&
                  !(
                    relationship === "related_resource" &&
                    visibleToolIds.some(isWorkspaceToolId)
                  ))
              } onChange={event => (setTarget)(event.target.value)} id={`${id}-target`} className="w-full">
<option value="" disabled>Choose a Particle…</option>
                {relationship === "related_resource" &&
                  visibleToolIds.filter(isWorkspaceToolId).map((id) => (
                    <option key={id} value={id}>
                      {workspaceToolLabel(id)}
                    </option>
                  ))}
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </ParticleSelect>
          </Field>
        </div>
        {relationship === "decision_outcome" && decision ? (
          <Field>
            <FieldLabel htmlFor={`${id}-outcome`}>Outcome</FieldLabel>
            <ParticleSelect value={outcome} disabled={!editable} onChange={event => (setOutcome)(event.target.value)} id={`${id}-outcome`}>
<option value="" disabled>Choose an outcome…</option>
                {decision.data.outcomes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </ParticleSelect>
          </Field>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button color="secondary" size="lg"
            type="submit"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={
              !editable ||
              !target ||
              (relationship === "decision_outcome" && !outcome)
            }

          >
            Connect Particles
          </Button>

        </div>
        <p role="status" className="text-muted-foreground text-xs">
          {actions.message}
        </p>
      </form>
    </section>
  )
}
