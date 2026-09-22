"use client"
import { useEffect, useRef, useState } from "react"
import { objectiveDraft, saveObjectiveDraft } from "../lib"
import type { ObjectivePlan, ObjectivePlanDraft } from "../types"

export function useWorkspaceObjectivePlannerController(
  plan?: ObjectivePlan,
  preview = false
) {
  const [draft, setDraft] = useState(() => objectiveDraft(plan))
  const [origin, setOrigin] = useState<ObjectivePlan["origin"]>(
    plan?.origin ?? "manual"
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])
  async function generate() {
    if (pending) return
    if (preview) {
      setError(
        "AI drafting is unavailable in this sample preview. You can write a plan manually."
      )
      return
    }
    if (!draft.title.trim()) {
      setError("Add an objective first.")
      return
    }
    setError("")
    setPending(true)
    const controller = new AbortController()
    abort.current = controller
    try {
      const response = await fetch("/api/workspace/objectives/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: draft.title, notes: draft.summary }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok || !result.draft)
        throw new Error(result.error ?? "AI drafting is unavailable.")
      if (!controller.signal.aborted) {
        setDraft(result.draft as ObjectivePlanDraft)
        setOrigin("ai")
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "AI drafting is unavailable."
        )
    } finally {
      if (!controller.signal.aborted) setPending(false)
    }
  }
  function save(onSave: (next: ObjectivePlan) => boolean) {
    try {
      if (
        onSave(
          saveObjectiveDraft(
            draft,
            plan?.id ?? `plan-${crypto.randomUUID()}`,
            origin,
            plan
          )
        )
      )
        return true
      setError(
        "This canvas has no room for another plan. Return some particles to the catalog first."
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check your objective.")
    }
    return false
  }
  return { draft, setDraft, origin, pending, error, generate, save }
}
