"use client"

import { Button } from "@/components/ui/button"
import type { ParticleNodeData } from "./particle-node"

export function ParticleInspectionActions({ data }: { data: ParticleNodeData }) {
  return <div className="nodrag nopan flex items-center gap-1">
    {data.expanded && <Button type="button" size="sm" variant="ghost" className="min-h-7 px-2 text-xs [@media(pointer:coarse)]:min-h-11" onClick={() => data.onOpen(data.particle.id)}>{data.editable ? "Edit" : "Details"}</Button>}
    <Button type="button" size="sm" variant="ghost" className="min-h-7 px-2 text-xs [@media(pointer:coarse)]:min-h-11" aria-label={`${data.expanded ? "Collapse" : "Open"} ${data.particle.title}`} aria-expanded={Boolean(data.expanded)} data-particle-collapse={data.expanded || undefined} onClick={() => data.expanded ? data.onCollapse?.() : data.onExpand?.(data.particle.id)}>{data.expanded ? "Close" : "Open"}</Button>
  </div>
}
