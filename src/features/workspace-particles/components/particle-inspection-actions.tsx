"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"


import type { ParticleNodeData } from "./particle-node"

export function ParticleInspectionActions({ data }: { data: ParticleNodeData }) {
  if (!data.expanded) return null
  return <div className="nodrag nopan flex items-center gap-1">
    <Button color="secondary" type="button" size="md" variant="ghost" className="min-h-7 px-2 text-xs [@media(pointer:coarse)]:min-h-11" onClick={() => data.onOpen(data.particle.id)}>{data.editable ? "Edit" : "Details"}</Button>
    <Button color="secondary" type="button" size="md" variant="ghost" className="min-h-7 px-2 text-xs [@media(pointer:coarse)]:min-h-11" aria-label={`Collapse ${data.particle.title}`} aria-expanded data-particle-collapse onClick={() => data.onCollapse?.()}>Close</Button>
  </div>
}
