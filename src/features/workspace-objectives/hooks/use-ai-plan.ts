"use client"
import { useEffect, useRef, useState } from "react"
import type { AiPlanDocument, AiPlanProposal, AiPlanQuote, AiPlanTarget, AiPlanTransport } from "../ai-plan-types"
const terminal = (proposal: AiPlanProposal | null) => proposal && ["succeeded", "failed", "canceled"].includes(proposal.status)
export function useAiPlan(target: AiPlanTarget, transport: AiPlanTransport, onChanged: () => void) {
  const [quote, setQuote] = useState<AiPlanQuote | null>(null)
  const [proposal, setProposal] = useState<AiPlanProposal | null>(null)
  const [previous, setPrevious] = useState<AiPlanProposal | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(false); const locked = useRef(false)
  const storageKey = `workspace-ai-plan:${target.userId}:${target.organizationId}:${target.objectiveId}`
  const remember = (id: string | null) => {
    setRunId(id)
    try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey) } catch { /* Optional recovery pointer. */ }
  }
  useEffect(() => {
    alive.current = true
    let current = true
    void transport.quote(target).then(value => { if (current) setQuote(value) }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "AI planning unavailable.") })
    let saved: string | null = null
    try { saved = sessionStorage.getItem(storageKey) } catch { /* Storage may be disabled. */ }
    if (saved) {
      setRunId(saved)
      void transport.read(saved, target).then(async value => {
        if (!current) return
        setProposal(value)
        if (value.revisionSourceRunId && ["failed", "canceled"].includes(value.status)) {
          const prior = await transport.read(value.revisionSourceRunId, target)
          if (current && prior.status === "succeeded" && !prior.application) setPrevious(prior)
        }
      }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "Unable to recover the proposal.") })
    }
    return () => { current = false; alive.current = false }
  }, [target, transport, storageKey])
  async function generate(prompt: string, revise: boolean, document?: AiPlanDocument) {
    if (locked.current || !quote || (runId && !terminal(proposal))) return false
    locked.current = true; setPending(true); setError(null)
    const prior = proposal; const id = crypto.randomUUID(); remember(id); setPrevious(prior); setProposal(null)
    try {
      const result = await transport.generate({ id, target, prompt, ...(document ? { document } : {}), maximumCredits: quote.maximumCredits, tariffVersion: quote.tariffVersion, ...(revise && prior ? { reviseRunId: prior.id } : {}) })
      if (!alive.current) return false
      if (result.proposal) {
        setProposal(result.proposal)
        if (result.proposal.status === "succeeded") { setPrevious(null); return true }
        setError(result.proposal.status === "canceled" ? "Request stopped. No credits charged." : "No valid plan was generated. No credits charged.")
      } else {
        setError(result.error ?? "Check status before trying again.")
        if (result.reserved === false) { setProposal(prior); remember(prior?.id ?? null); setPrevious(null) }
      }
    } catch { if (alive.current) setError("Connection interrupted. Check status to recover this request before starting another.") }
    finally {
      locked.current = false
      if (alive.current) {
        setPending(false); setQuote(null)
        void transport.quote(target).then(value => { if (alive.current) setQuote(value) }).catch(() => undefined)
      }
    }
    return false
  }
  async function refresh() {
    if (!runId || locked.current) return
    locked.current = true; setPending(true); setError(null)
    try {
      const value = await transport.read(runId, target)
      if (alive.current) { setProposal(value); if (value.application) onChanged() }
      if (value.revisionSourceRunId && ["failed", "canceled"].includes(value.status)) {
        const prior = await transport.read(value.revisionSourceRunId, target)
        if (alive.current && prior.status === "succeeded" && !prior.application) setPrevious(prior)
      }
    }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Unable to recover the request.") }
    finally { locked.current = false; if (alive.current) setPending(false) }
  }
  async function apply(undo = false) {
    if (!proposal || locked.current) return
    locked.current = true; setPending(true); setError(null)
    try {
      const application = await (undo ? transport.undo : transport.apply)(proposal.id, target)
      if (alive.current) { setProposal({ ...proposal, application }); onChanged() }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Check status before retrying.") }
    finally { locked.current = false; if (alive.current) setPending(false) }
  }
  async function stop() {
    if (!runId) return
    try { await transport.stop(runId, target); if (alive.current) setError("Stop requested. Check status to confirm the result and credits.") }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Unable to stop. Check status.") }
  }
  return { quote, proposal, previous, runId, pending, error, generate, refresh, apply, stop,
    recoverable: Boolean(runId && !terminal(proposal)),
    discard: () => { if (!pending && (!runId || terminal(proposal))) { setProposal(null); setPrevious(null); remember(null); setError(null) } },
    restorePrevious: () => { if (!pending && previous && terminal(proposal)) { setProposal(previous); remember(previous.id); setPrevious(null); setError(null) } },
  }
}
