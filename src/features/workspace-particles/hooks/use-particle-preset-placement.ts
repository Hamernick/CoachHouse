"use client"

import { useRef, useState } from "react"
import {
  buildParticlePreset,
  DEFAULT_PRESET_FIELDS,
  type ParticlePreset,
  type PresetFields,
} from "../lib/particle-presets"
import type { Particle } from "../types"

// Keep failed attempts' identities stable so a retry cannot create duplicates.
export function useParticlePresetPlacement(
  workspaceId: string,
  onAdd?: (particle: Particle) => Promise<boolean>,
  existingIds: readonly string[] = []
) {
  const drafts = useRef(new Map<string, Particle>())
  const inFlight = useRef(false)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const prepare = (preset: ParticlePreset, fields?: Partial<PresetFields>, title = preset.label) => {
    const key = `${workspaceId}:${preset.id}`
    let draft = drafts.current.get(key)
    if (draft && existingIds.includes(draft.id)) draft = undefined
    if (!draft || fields) {
      draft = buildParticlePreset(preset, {
        id: draft?.id ?? crypto.randomUUID(),
        workspaceId,
        now: draft?.createdAt ?? new Date().toISOString(),
        title,
        description: "",
        fields: { ...DEFAULT_PRESET_FIELDS, expression: "0", ...fields },
      })
      drafts.current.set(key, draft)
    }
    return draft
  }
  const add = async (preset: ParticlePreset, fields?: Partial<PresetFields>, title = preset.label) => {
    if (!onAdd || inFlight.current) return
    inFlight.current = true
    setAdding(true)
    setMessage(null)
    const key = `${workspaceId}:${preset.id}`
    try {
      const draft = prepare(preset, fields, title)
      if (await onAdd(draft)) {
        drafts.current.delete(key)
        setMessage(`${preset.label} added to canvas${preset.id === "event" ? " and calendar" : ""}`)
      } else
        setMessage("Not confirmed yet. Retry to finish adding this Particle.")
    } catch {
      setMessage("Unable to add. Try again.")
    } finally {
      inFlight.current = false
      setAdding(false)
    }
  }
  return { add, prepare, adding, message }
}
