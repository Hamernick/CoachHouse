import { particlePresetQuery } from "./particle-presets"
import type { ParticleResult } from "../types"

export const PARTICLE_CREATE_TYPES = [
  "objective",
  "activity",
] as const
export function parseParticleCreateCommand(input: string): ParticleResult<{
  type: (typeof PARTICLE_CREATE_TYPES)[number]
  title: string
}> {
  const match = /^create (\w+)\s+([\s\S]+)$/i.exec(
    input.trim()
  )
  const requestedType = match?.[1]?.toLowerCase()
  const type = PARTICLE_CREATE_TYPES.find(
    (item) => item === (requestedType === "resource" ? "activity" : requestedType)
  )
  const title = match?.[2]?.trim()
  if (!type || !title || title.length > 240)
    return {
      ok: false,
      code: "invalid",
      error:
        "Use: create objective Your goal or create resource Your title (up to 240 characters). Or choose +.",
    }
  return { ok: true, value: { type, title } }
}

// The dock owns library search; only explicit create commands enter mutation parsing.
export function particleComposerSearchQuery(input: string): string | null {
  if (/^create\b/i.test(input.trimStart())) return null
  return particlePresetQuery(input) ?? input.trim()
}
