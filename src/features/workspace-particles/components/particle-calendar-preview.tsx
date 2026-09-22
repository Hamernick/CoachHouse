"use client"

import { RoadmapCalendar } from "@/components/roadmap/roadmap-calendar"
import { ParticleNaturalPreview } from "./particle-natural-preview"

export function ParticleCalendarPreview() {
  return (
    <ParticleNaturalPreview width={520}>
      <RoadmapCalendar hideHeaderCopy compactHeaderControls />
    </ParticleNaturalPreview>
  )
}
