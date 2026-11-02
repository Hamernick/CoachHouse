import { useEffect, useEffectEvent, useRef, useState } from "react"
import type { ResearchDraftCheckpoint } from "../lib/research-draft-checkpoint"
import type { useResearchDraftCheckpoint } from "./use-research-draft-checkpoint"

type Draft = NonNullable<ResearchDraftCheckpoint["draft"]>
type Conditions = { dirty: boolean; recoverable: boolean; attempted: boolean; busy: boolean; stale: boolean; checking: boolean; leaving: boolean }
type Recovery = Pick<ReturnType<typeof useResearchDraftCheckpoint>, "ready" | "busy" | "error" | "uncertain" | "save">

/** Coalesce private edits through the existing revisioned checkpoint writer.
 * Failed/uncertain saves require explicit retry; unload never starts a write. */
export function useResearchDraftAutosave(draft: Draft | null, conditions: Conditions, recovery: Recovery) {
  const { dirty, recoverable, attempted, busy, stale, checking, leaving } = conditions
  const enabled = dirty && recoverable && !attempted && !busy && !stale && !checking && !leaving &&
    recovery.ready && !recovery.busy && !recovery.error && !recovery.uncertain
  const [saving, setSaving] = useState(false)
  const mounted = useRef(false)
  const value = draft ? JSON.stringify(draft) : null
  const persist = useEffectEvent(async () => {
    if (!enabled || !draft) return
    setSaving(true)
    try { await recovery.save(draft) }
    finally { if (mounted.current) setSaving(false) }
  })
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!enabled || !value || saving) return
    const timer = setTimeout(() => { void persist() }, 1500)
    return () => clearTimeout(timer)
  }, [enabled, value, saving])
  return saving
}
