import { useEffect, useRef, useState } from "react"
import { applyWorkspaceResearchSourceEffects, readWorkspaceResearchSourceEffects } from "../research-source-actions"
import { researchSourceEffectsSchema, type ResearchSourceEffect } from "../lib/research-data-view"
import type { ResearchResult, ResearchTarget } from "../research-types"

export function useResearchSourceEffects(runId: string | null, target: ResearchTarget, result: ResearchResult | null) {
  const [effects, setEffects] = useState<ResearchSourceEffect[]>([])
  const [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false)
  const [plan, setPlan] = useState<"pending" | "applied" | "unconfirmed">("pending")
  const identity = JSON.stringify({ runId, target }), current = useRef(identity), busy = useRef(false)
  current.current = identity
  useEffect(() => { setEffects([]); setError(null); setPlan("pending"); setPending(false); busy.current = false }, [identity])
  async function request(apply: boolean) {
    if (!runId || busy.current) return false
    busy.current = true; setPending(true); setError(null)
    const version = identity
    try {
      const reply = await (apply ? applyWorkspaceResearchSourceEffects : readWorkspaceResearchSourceEffects)({ runId, target })
      if (current.current !== version) return false
      if ("error" in reply) { setEffects([]); setError(reply.error); return false }
      const value = researchSourceEffectsSchema.parse(reply)
      setEffects(value.effects); setPlan(value.planApplied ? "applied" : "pending")
      return value.planApplied || value.effects.every(effect => effect.status === "created")
    } catch {
      if (current.current === version) { setEffects([]); setError("Source effects could not be confirmed. Check status before retrying the same draft.") }
      return false
    } finally { if (current.current === version) { busy.current = false; setPending(false) } }
  }
  return { effects, error, pending, plan, available: Boolean(runId && (!result || result.items.some(item => item.kind === "data_view"))), check: () => request(false), apply: () => request(true),
    markPlan: (saved: boolean) => setPlan(saved ? "applied" : "unconfirmed") }
}
