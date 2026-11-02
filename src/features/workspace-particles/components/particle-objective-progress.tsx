"use client"

import type { ObjectiveProgress } from "../lib/particle-progress"
import { ParticleProgress } from "./particle-frame"

export function ParticleObjectiveProgress({ value }: { value: ObjectiveProgress }) {
  const { config, work, time } = value
  return <div className="flex flex-col gap-2" aria-label="Objective progress">
    <p className="text-xs">{value.label}</p>
    {(config.mode === "work" || config.mode === "both") && work.percent !== null &&
      <ParticleProgress value={work.percent} label={`${work.completed} of ${work.total} required work complete${work.visibleScope ? " · Visible scope" : ""}`} />}
    {config.mode === "ongoing" && work.total > 0 && <p className="text-xs text-muted-foreground">{work.completed} of {work.total} current work complete{work.visibleScope ? " · Visible scope" : ""}</p>}
    {(config.mode === "time" || config.mode === "both") && (time ?
      <ParticleProgress value={time.percent} label={time.state === "upcoming" ? "Period not started" : time.state === "elapsed" ? "Period ended" : `${Math.ceil(time.remainingMs / 86_400_000)} days remaining`} /> : <p className="text-xs text-muted-foreground">Dates not set</p>)}
    {value.awaitingConfirmation && <p className="text-xs text-muted-foreground">Work complete · Confirm outcome separately</p>}
  </div>
}
