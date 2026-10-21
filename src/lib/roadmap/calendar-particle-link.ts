import { z } from "zod"

export function calendarParticleId(value: string | null) {
  const parsed = z.uuid().safeParse(value)
  return parsed.success ? parsed.data : null
}

export function calendarParticleHref(id: string, workspaceCanvasId?: string) {
  const target = calendarParticleId(id)
  if (!target) throw new Error("Invalid Event Particle.")
  if (workspaceCanvasId && !calendarParticleId(workspaceCanvasId)) throw new Error("Invalid workspace.")
  return `/workspace?particle=${target}${workspaceCanvasId ? `&workspace=${workspaceCanvasId}` : ""}`
}
