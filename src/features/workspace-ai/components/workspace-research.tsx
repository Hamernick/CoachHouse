"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { quoteWorkspaceResearch, getWorkspaceResearch, stopWorkspaceResearch } from "../research-actions"
import { researchResultSchema, type ResearchTarget, type ResearchResult, type ResearchRequest } from "../research-types"
import { ResearchReview, type ResearchPlanContext } from "./research-review"

type Quote = { maximumCredits: number; tariffVersion: string }
type Props = { target: ResearchTarget; userId: string; planContext?: ResearchPlanContext; stale?: boolean; onProposal: (result: ResearchResult) => Promise<boolean>; onClose: () => void }
type RunResponse = { run?: { status: string; result: ResearchResult | null }; error?: string }
const scopeIdentity = (target: ResearchTarget) => `${target.organizationId}:${target.objectiveId}:${target.plan?.id ?? "new"}`
const identity = (target: ResearchTarget) => `${target.organizationId}:${target.objectiveId}:${target.revision}:${target.plan?.id ?? "new"}:${target.plan?.revision ?? ""}`

export function WorkspaceResearch(props: Props) {
  // A target change owns a new session; late responses cannot reach its state or storage.
  return <ResearchSession key={`${props.userId}:${identity(props.target)}`} {...props} />
}
function ResearchSession({ target, userId, planContext, stale: targetStale, onProposal, onClose }: Props) {
  const [prompt, setPrompt] = useState(""), [skill, setSkill] = useState<ResearchRequest["skill"]>(target.plan ? "planning" : "research")
  const [quote, setQuote] = useState<Quote | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [runId, setRunId] = useState<string | null>(null), [result, setResult] = useState<ResearchResult | null>(null), [message, setMessage] = useState("")
  const alive = useRef(true), working = useRef(false), activeRun = useRef<string | null>(null)
  const key = `workspace-research:${userId}:${target.organizationId}:${target.objectiveId}${target.plan ? `:plan:${target.plan.id}` : ""}`
  const { organizationId, objectiveId, revision } = target
  const planId = target.plan?.id, planRevision = target.plan?.revision
  useEffect(() => {
    alive.current = true
    let current = true
    try { activeRun.current = sessionStorage.getItem(key); setRunId(activeRun.current) } catch { /* Browser storage is optional. */ }
    void quoteWorkspaceResearch({organizationId, objectiveId, revision, ...(planId !== undefined && planRevision !== undefined ? {plan:{id:planId,revision:planRevision}} : {})}).then(value => {
      if (!current) return
      if ("error" in value) setError(value.error ?? "Research unavailable.")
      else { setQuote(value); setError(null) }
    }).catch(() => { if (current) setError("Research pricing could not be loaded. Reopen research to retry.") })
    return () => { current = false; alive.current = false; activeRun.current = null }
  }, [key, organizationId, objectiveId, revision, planId, planRevision])
  const retain = (id: string | null) => {
    if (!alive.current) return
    activeRun.current = id; setRunId(id)
    try { if (id) sessionStorage.setItem(key, id); else sessionStorage.removeItem(key) } catch { /* Keep recovery in memory. */ }
  }
  const consume = (value: RunResponse, expectedRun: string) => {
    if (!alive.current || activeRun.current !== expectedRun) return
    if (value.error) { setError(value.error); return }
    if (value.run?.result) {
      const parsed = researchResultSchema.safeParse(value.run.result)
      if (!parsed.success || parsed.data.runId !== expectedRun || scopeIdentity(parsed.data.target) !== scopeIdentity(target)) {
        setError("This research belongs to a different plan. Discard it and research the current plan.")
        return
      }
      setResult(parsed.data); setError(null); setMessage("Research ready. Review the proposed changes.")
    } else if (value.run && ["failed", "canceled"].includes(value.run.status)) {
      setMessage(value.run.status === "canceled" ? "Research stopped." : "Research did not produce a valid proposal. No credits charged."); retain(null)
    } else setMessage("Research is still running or recovering. Check status shortly.")
  }
  const start = async () => {
    if (!quote || working.current || runId) return
    working.current = true; setBusy(true); setError(null); setResult(null); setMessage("Researching workspace context and relevant sources…")
    const id = crypto.randomUUID(); retain(id)
    try {
      const response = await fetch("/api/workspace-ai/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, target, prompt, skill, ...quote }) })
      const value = await response.json()
      consume(value, id)
      if (value.error && !value.reserved) retain(null)
    } catch { if (alive.current) setError("Connection interrupted. Check status to recover this run.") }
    finally { working.current = false; if (alive.current) setBusy(false) }
  }
  const recover = async (stop = false) => {
    if (!runId || (working.current && !stop)) return
    const expectedRun = runId
    try {
      const value = await (stop ? stopWorkspaceResearch(expectedRun, target) : getWorkspaceResearch(expectedRun, target))
      if (!alive.current || activeRun.current !== expectedRun) return
      if ("error" in value) setError(value.error ?? "Research unavailable.")
      else if (stop) setMessage("Stop requested. Finishing usage accounting.")
      else consume(value, expectedRun)
    } catch { if (alive.current && activeRun.current === expectedRun) setError("Unable to reach research. Try again.") }
  }
  const stale = Boolean(targetStale || (result && identity(result.target) !== identity(target)))
  const add = async () => {
    if (!result || working.current || stale) return
    working.current = true; setBusy(true); setError(null)
    try {
      const saved = await onProposal(result)
      if (!alive.current) return
      if (saved) { retain(null); onClose() }
      else setError("Proposal could not be added. Check the workspace error and try again.")
    } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : "Proposal could not be added.") }
    finally { working.current = false; if (alive.current) setBusy(false) }
  }
  const discard = () => { setResult(null); retain(null); setMessage(""); setError(null) }
  return <form aria-label={target.plan ? "Revise plan with AI" : "Research objective"} className="space-y-3 px-2 py-3" onSubmit={event => { event.preventDefault(); void start() }}>
    {planContext && <p className="text-sm font-medium">Revise {planContext.title}</p>}
    {!result && <><Textarea aria-label="Research request" placeholder={target.plan ? "What should change in this plan?" : "What should we find or develop?"} value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} required rows={3} disabled={busy || Boolean(runId)} className="rounded-xl px-3 py-2" />
      <Select value={skill} onValueChange={value => setSkill(value as ResearchRequest["skill"])} disabled={busy || Boolean(runId)}><SelectTrigger aria-label="Research approach" className="h-9 w-fit rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="research">Research</SelectItem><SelectItem value="partnerships">Find partners & resources</SelectItem><SelectItem value="planning">Develop the plan</SelectItem></SelectContent></Select>
      {quote && !runId && <p className="text-xs text-muted-foreground">Up to {quote.maximumCredits} credits, including web searches.</p>}</>}
    {result && <ResearchReview result={result} plan={planContext} />}
    {result && stale && <p role="status" className="text-xs text-muted-foreground">This plan or objective changed. Review this research, then discard it and research the current plan before proposing.</p>}
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      {runId && !result && <><Button type="button" variant="ghost" size="sm" onClick={() => void recover(true)}>Stop</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void recover()}>Check status</Button></>}
      {runId && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={discard}>Discard</Button>}
      {result && <Button type="button" size="sm" disabled={busy || stale || (!result.items.length && !result.removeReferences?.length)} onClick={() => void add()}>Add proposal</Button>}
      {!runId && !result && <Button type="submit" size="sm" disabled={busy || !quote || !prompt.trim()}>Research</Button>}
    </div>
  </form>
}
