"use client"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { ResearchPublicOptions, ResearchScopeHelp } from "./research-public-brief"
import { useResearchPublicBrief, type ResearchQuote } from "./use-research-public-brief"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { quoteWorkspaceResearch, getWorkspaceResearch, stopWorkspaceResearch } from "../research-actions"
import { type ResearchTarget, type ResearchResult, type ResearchRequest } from "../research-types"
import { researchSnapshotSchema } from "../lib/research-snapshot"
import { ResearchReview, type ResearchPlanContext } from "./research-review"
import { researchRecovery, researchRecoveryCodeSchema, type ResearchRecoveryCode } from "../lib/research-recovery"
import { researchPhaseLabels } from "../lib/research-phase"
import type { ResearchItemPreview } from "../lib/research-item-preview"
import { ResearchHistoryMenu } from "./research-history-menu"

type Quote = ResearchQuote
import { applyResearchDraft, createResearchDraft, researchDraftError, validateResearchRecoveryDraft, type ResearchDraft } from "../lib/research-draft"
import { ResearchDraftEditor } from "./research-draft-editor"
import { sameResearchDraft } from "../lib/research-draft-checkpoint"
import { useResearchDraftCheckpoint } from "./use-research-draft-checkpoint"
import { useResearchDraftAutosave } from "./use-research-draft-autosave"
import { useResearchNavigationGuard } from "./use-research-navigation-guard"
import { IncomingResearchPreview } from "./research-presentation"
import { useResearchSourceEffects } from "./use-research-source-effects"
import { ResearchSourceEffects } from "./research-source-effects"
import { prepareReviewedResearchSources } from "../lib/research-source-application"

type Props = { target: ResearchTarget; userId: string; planContext?: ResearchPlanContext; stale?: boolean; initialPrompt?: string; onPromptChange?: (prompt: string) => void; onProposal: (result: ResearchResult, draft?: ResearchDraft) => Promise<boolean>; onClose: () => void }
type RunResponse = { run?: unknown; error?: string; failure?: { code?: unknown } }
const scopeIdentity = (target: ResearchTarget) => target.mode === "new_objective" ? `${target.organizationId}:new_objective:${target.canvasId ?? "default"}` : `${target.organizationId}:${target.objectiveId}:${target.plan?.id ?? "new"}`
const identity = (target: ResearchTarget) => `${scopeIdentity(target)}:${target.revision}:${target.plan?.revision ?? ""}`

export function WorkspaceResearch(props: Props) {
  // A target change owns a new session; late responses cannot reach its state or storage.
  return <ResearchSession key={`${props.userId}:${identity(props.target)}`} {...props} />
}
function ResearchSession({ target, userId, planContext, stale: targetStale, initialPrompt = "", onPromptChange, onProposal, onClose }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt), [skill, setSkill] = useState<ResearchRequest["skill"]>(target.plan || target.mode === "new_objective" ? "planning" : "research")
  const [quote, setQuote] = useState<Quote | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const alive=useRef(true)
  const {publicResearch,publicAvailable,setPublicAvailable,updatePublicResearch}=useResearchPublicBrief(target,alive,setQuote,setError)
  const [runId, setRunId] = useState<string | null>(null), [result, setResult] = useState<ResearchResult | null>(null), [message, setMessage] = useState("")
  const sourceEffects = useResearchSourceEffects(runId, target, result)
  const [unsavedPreview, setUnsavedPreview] = useState<ResearchResult | null>(null)
  const [partialItems, setPartialItems] = useState<ResearchItemPreview[]>([])
  const clearPreviews = () => { setUnsavedPreview(null); setPartialItems([]) }
  const [checking, setChecking] = useState(false)
  const [draft, setDraft] = useState<{ runId: string; base: string; value: ReturnType<typeof createResearchDraft> } | null>(null)
  const [editing, setEditing] = useState(false), [attempted, setAttempted] = useState(false)
  const [leaving, setLeaving] = useState<"close" | "discard" | { href: string } | null>(null)
  const leaveTrigger = useRef<HTMLElement | null>(null), keepEditing = useRef<HTMLButtonElement>(null)
  const leaveIntent = useRef(leaving); leaveIntent.current = leaving
  useEffect(() => { if (leaving) keepEditing.current?.focus() }, [leaving])
  const recovery = useResearchDraftCheckpoint(result, target, (value, frozen) => {
    if (!result || draft) return
    setDraft({ runId: result.runId, base: JSON.stringify(result), value }); setAttempted(frozen); setEditing(!frozen)
  })
  const dirty = Boolean(draft && !sameResearchDraft(draft.value, recovery.checkpoint.draft ?? createResearchDraft(JSON.parse(draft.base))))
  const navigate = useResearchNavigationGuard(dirty, (href, trigger) => {
    leaveTrigger.current = trigger; setLeaving({ href })
  })
  const [failure, setFailure] = useState<ResearchRecoveryCode | null>(null)
  const checkingRun = useRef<string | null>(null), readVersion = useRef(0)
  const working = useRef(false), activeRun = useRef<string | null>(null)
  const streamAbort = useRef<AbortController | null>(null)
  const key = target.mode === "new_objective" ? `workspace-research:${userId}:${scopeIdentity(target)}` : `workspace-research:${userId}:${target.organizationId}:${target.objectiveId}${target.plan ? `:plan:${target.plan.id}` : ""}`
  const { organizationId, objectiveId, revision } = target
  const planId = target.plan?.id, planRevision = target.plan?.revision
  const mode = target.mode, canvasId = target.mode === "new_objective" ? target.canvasId : null
  const retain = (id: string | null) => {
    if (!alive.current) return
    readVersion.current += 1; checkingRun.current = null; setChecking(false)
    activeRun.current = id; setRunId(id)
    try { if (id) sessionStorage.setItem(key, id); else sessionStorage.removeItem(key) } catch { /* Keep recovery in memory. */ }
  }
  const fail = (value: Pick<RunResponse, "error" | "failure">) => {
    clearPreviews()
    const parsed = researchRecoveryCodeSchema.safeParse(value.failure?.code)
    setFailure(parsed.success ? parsed.data : null)
    setResult(null); setMessage("")
    setError(parsed.success ? researchRecovery[parsed.data].message : value.error ?? researchRecovery.verification_unavailable.message)
  }
  const consume = (value: RunResponse, expectedRun: string) => {
    if (!alive.current || activeRun.current !== expectedRun) return
    clearPreviews()
    if (value.error) { fail(value); return }
    const snapshot = researchSnapshotSchema.safeParse(value.run)
    if (!snapshot.success || snapshot.data.id !== expectedRun || (snapshot.data.appliedObjectiveId && target.mode !== "new_objective")) {
      fail({ failure: { code: "invalid_result" } }); return
    }
    const run = snapshot.data
    setFailure(null)
    if (run.appliedObjectiveId) {
      setDraft(null); setEditing(false); setAttempted(false); setLeaving(null)
      setResult(null); setError(null); setMessage("Proposal already added. Reload the workspace to see it."); retain(null)
      return
    }
    if (run.result) {
      const saved = run.result
      if (scopeIdentity(saved.target) !== scopeIdentity(target)) {
        setResult(null); setMessage("")
        setError("This research belongs to a different plan. Discard it and research the current plan.")
        return
      }
      if (draft && (draft.runId !== expectedRun || draft.base !== JSON.stringify(saved))) {
        fail({ error: "Saved research changed. Discard this preview and reopen it." }); return
      }
      setResult(saved); setError(null); setMessage("Research ready. Review the proposed changes.")
    } else {
      setResult(null)
      if (["failed", "canceled"].includes(run.status)) {
        setMessage(run.status === "canceled" ? "Research stopped." : "Research did not produce a valid proposal. No credits charged."); retain(null)
      } else setMessage("Research is still running or recovering. Check status shortly.")
    }
  }
  const start = async () => {
    if (!quote || working.current || runId) return
    working.current = true; setBusy(true); setError(null); setFailure(null); setResult(null); clearPreviews(); setMessage("Researching workspace context and relevant sources…")
    const id = crypto.randomUUID(); retain(id)
    const generationVersion = readVersion.current
    const controller = new AbortController(); streamAbort.current = controller
    try {
      const response = await fetch("/api/workspace-ai/research", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Accept: "text/event-stream, application/json" }, body: JSON.stringify({ id, target, prompt, skill, maximumCredits:quote.maximumCredits,tariffVersion:quote.tariffVersion,...(publicResearch ? {publicResearch} : {}) }) })
      if (!alive.current || activeRun.current !== id || readVersion.current !== generationVersion) { await response.body?.cancel(); return }
      if (response.headers.get("content-type")?.startsWith("text/event-stream")) {
        const { readResearchProgress } = await import("../lib/research-progress-client")
        if (!alive.current || activeRun.current !== id || readVersion.current !== generationVersion) { await response.body?.cancel(); return }
        const savedSnapshot = await readResearchProgress(response,{runId:id,target,userId},phase=>{
          if (alive.current && activeRun.current === id && readVersion.current === generationVersion && !controller.signal.aborted) setMessage(researchPhaseLabels[phase])
        },controller.signal, preview => {
          if (alive.current && activeRun.current === id && readVersion.current === generationVersion && !controller.signal.aborted && document.visibilityState === "visible") { setPartialItems([]); setUnsavedPreview(preview) }
        }, item => {
          if (alive.current && activeRun.current === id && readVersion.current === generationVersion && !controller.signal.aborted && document.visibilityState === "visible") setPartialItems(items => item ? [...items, item] : [])
        })
        if (!alive.current || activeRun.current !== id || readVersion.current !== generationVersion) return
        // A validated terminal snapshot is already an authorized saved read.
        // Older, interrupted or oversized streams fall back to one fresh read.
        if (savedSnapshot) { consume({ run: savedSnapshot.payload.run }, id); return }
        // Never repeat generation or treat readiness alone as acceptance.
        clearPreviews(); setMessage("Checking saved research…")
        const snapshot = await getWorkspaceResearch(id,target)
        if (readVersion.current === generationVersion) consume(snapshot,id)
        return
      }
      const value = await response.json()
      if (!alive.current || activeRun.current !== id || readVersion.current !== generationVersion) return
      consume(value, id)
      if (value.error && !value.reserved) retain(null)
    } catch { if (alive.current && activeRun.current === id && readVersion.current === generationVersion) setError("Connection interrupted. Check status to recover this run.") }
    finally {
      if (streamAbort.current === controller) {
        streamAbort.current = null; working.current = false
        if (alive.current) setBusy(false)
      }
    }
  }
  const recover = async (stop = false, expectedRun = runId, reconnect = false) => {
    if (!expectedRun || (working.current && !stop && !(reconnect && streamAbort.current)) || (!stop && checkingRun.current === expectedRun)) return
    const version = ++readVersion.current
    clearPreviews()
    if ((stop || reconnect) && streamAbort.current) {
      // End presentation only. The same run is read below; no replay, model
      // restart or stale generation finally may replace the recovered session.
      streamAbort.current.abort(); streamAbort.current = null
      working.current = false; setBusy(false)
    }
    checkingRun.current = expectedRun; setChecking(true)
    setResult(null); setError(null); setFailure(null); setMessage(stop ? "Stopping research…" : "Checking research sources…")
    try {
      const value = await (stop ? stopWorkspaceResearch(expectedRun, target) : getWorkspaceResearch(expectedRun, target))
      if (!alive.current || activeRun.current !== expectedRun || readVersion.current !== version) return
      if ("error" in value) fail(value)
      else if (stop) setMessage("Stop requested. Finishing usage accounting.")
      else consume(value, expectedRun)
    } catch {
      if (alive.current && activeRun.current === expectedRun && readVersion.current === version) {
        fail({ failure: { code: "verification_unavailable" } })
      }
    } finally {
      if (alive.current && activeRun.current === expectedRun && readVersion.current === version) {
        checkingRun.current = null; setChecking(false)
      }
    }
  }
  // Restore once per mounted scope through the existing authorized reader. A
  // running/failed read remains explicit recovery, never polling or generation.
  const restoreSavedRun = useEffectEvent((id: string) => { void recover(false, id) })
  useEffect(() => {
    alive.current = true
    let current = true
    try {
      const stored = sessionStorage.getItem(key)
      const parsed = researchSnapshotSchema.shape.id.safeParse(stored)
      if (parsed.success) { activeRun.current = parsed.data; setRunId(parsed.data); restoreSavedRun(parsed.data) }
      else if (stored) sessionStorage.removeItem(key)
    } catch { /* Browser storage is optional. */ }
    void quoteWorkspaceResearch(mode === "new_objective" ? {mode, organizationId, revision, canvasId} : {organizationId, objectiveId:objectiveId!, revision, ...(planId !== undefined && planRevision !== undefined ? {plan:{id:planId,revision:planRevision}} : {})}).then(value => {
      if (!current) return
      if ("error" in value) setError(value.error ?? "Research unavailable.")
      else {setQuote(value);setPublicAvailable(Boolean(value.publicResearchAvailable))}
    }).catch(() => { if (current) setError("Research pricing could not be loaded. Reopen research to retry.") })
    return () => { current = false; alive.current = false; activeRun.current = null; streamAbort.current?.abort() }
  }, [key, organizationId, objectiveId, revision, planId, planRevision, mode, canvasId, setPublicAvailable])
  const recheckVisibleResult = useEffectEvent((reconnect: boolean) => {
    const resumable = reconnect && runId && (!failure || researchRecovery[failure].action === "check_status")
    if (document.visibilityState === "visible" && (result || resumable) && !targetStale) void recover(false, runId, reconnect)
  })
  useEffect(() => {
    const recheck = (event: Event) => {
      clearPreviews()
      recheckVisibleResult(event.type === "online" || event.type === "visibilitychange")
    }
    window.addEventListener("focus", recheck)
    window.addEventListener("online", recheck)
    document.addEventListener("visibilitychange", recheck)
    return () => {
      window.removeEventListener("focus", recheck)
      window.removeEventListener("online", recheck)
      document.removeEventListener("visibilitychange", recheck)
    }
  }, [])
  const stale = Boolean(targetStale || (result && identity(result.target) !== identity(target)))
  const add = async () => {
    if (!result || working.current || checkingRun.current || stale || !recovery.ready || recovery.busy || recovery.uncertain) return
    working.current = true; setBusy(true); setError(null)
    try {
      setAttempted(true)
      // Freeze the exact retry payload durably before any canonical save attempt.
      const prepared = await prepareReviewedResearchSources({ result, draft: draft?.value, saveDraft: recovery.save,
        applySources: sourceEffects.apply, isCurrent: () => alive.current && activeRun.current === result.runId })
      if (!prepared.ready) return
      if (!alive.current || activeRun.current !== result.runId) return
      const saved = await onProposal(result, prepared.draft)
      sourceEffects.markPlan(saved)
      if (!alive.current) return
      if (saved) { retain(null); onClose() }
      else { setResult(null); setMessage(""); setError("Proposal could not be added. Check status before retrying.") }
    } catch (error) { if (alive.current) { setResult(null); setMessage(""); setError(error instanceof Error ? error.message : "Proposal could not be added.") } }
    finally { working.current = false; if (alive.current) setBusy(false) }
  }
  const discard = () => { setDraft(null); setEditing(false); setAttempted(false); setLeaving(null); setResult(null); clearPreviews(); retain(null); setMessage(""); setError(null); setFailure(null) }
  const leave = (action: "close" | "discard") => {
    if (dirty || (action === "discard" && recovery.checkpoint.draft)) { leaveTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setLeaving(action); return }
    if (action === "close") onClose()
    else void discardSaved()
  }
  const discardSaved = async () => {
    if (recovery.checkpoint.revision && !recovery.conflict && !await recovery.save(null)) return false
    discard(); return true
  }
  const draftError = result && draft ? researchDraftError(result, draft.value) : null
  const validDraft = !draftError
  let recoverableDraft = false
  if (result && draft) {
    try { validateResearchRecoveryDraft(result, draft.value); recoverableDraft = true } catch { /* Unsafe structures cannot be checkpointed. */ }
  }
  const autosaving = useResearchDraftAutosave(draft?.value ?? null,
    { dirty, recoverable: recoverableDraft, attempted, busy, stale, checking, leaving: Boolean(leaving) }, recovery)
  const preview = result && draft && validDraft ? applyResearchDraft(result, draft.value) : result
  const saveAndLeave = async () => {
    const action = leaving
    if (!action || action === "discard" || !draft || !result || !recoverableDraft || attempted || busy || recovery.busy || recovery.uncertain || !recovery.ready) return
    const saved = !dirty || await recovery.save(draft.value)
    // A late acknowledgement may save the checkpoint, but cannot close a newer
    // scope or override Keep editing / a different navigation destination.
    if (!saved || !alive.current || activeRun.current !== result.runId || leaveIntent.current !== action) return
    if (action === "close") onClose()
    else navigate(action.href)
  }
  const canCheck = !failure || researchRecovery[failure].action === "check_status"
  return <form aria-label={target.mode === "new_objective" ? "Plan a new objective" : target.plan ? "Revise plan with AI" : "Research objective"} className="space-y-3 px-2 py-3" onSubmit={event => { event.preventDefault(); void start() }}>
    {planContext && <p className="text-sm font-medium">Revise {planContext.title}</p>}
    {!result && <><ResearchScopeHelp publicAvailable={publicAvailable} /><Textarea aria-label="Research request" placeholder={target.mode === "new_objective" ? "What do you want to accomplish?" : target.plan ? "What should change in this plan?" : "What should we find or develop?"} value={prompt} onChange={event => { setPrompt(event.target.value); onPromptChange?.(event.target.value) }} maxLength={2000} required rows={3} disabled={busy || Boolean(runId)} className="rounded-xl px-3 py-2" />
      {target.mode !== "new_objective" && <Select value={skill} onValueChange={value => setSkill(value as ResearchRequest["skill"])} disabled={busy || Boolean(runId)}><SelectTrigger aria-label="Research approach" className="h-9 w-fit rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="research">Research</SelectItem><SelectItem value="partnerships">Find partners & resources</SelectItem><SelectItem value="planning">Develop the plan</SelectItem></SelectContent></Select>}
      <ResearchPublicOptions available={publicAvailable} disabled={busy || Boolean(runId)} quote={quote} publicResearch={publicResearch} hasRun={Boolean(runId)} onChange={(value,awaitingReview)=>void updatePublicResearch(value,awaitingReview)} /></>}
    {preview && !stale && !checking && <>
      {editing && draft ? <ResearchDraftEditor result={result!} draft={draft.value} disabled={busy || attempted || (recovery.busy && !autosaving) || recovery.uncertain || !recovery.ready} onChange={value => setDraft({ ...draft, value })} />
        : <><p className="text-sm font-medium">{preview.title}</p><ResearchReview result={preview} plan={planContext} /></>}
      {editing && !attempted && <p className="text-xs text-muted-foreground">Edits save privately. Add proposal when ready.</p>}
      {dirty && <p role="status" className="text-xs text-muted-foreground">{autosaving ? "Saving private draft…" : "Unsaved edits."}</p>}
      {!dirty && recovery.checkpoint.draft && <p role="status" className="text-xs text-muted-foreground">Private draft saved. Not added to the plan.</p>}
      {draft && !attempted && <Button type="button" variant="ghost" size="sm" disabled={!dirty || !recoverableDraft || busy || recovery.busy || recovery.uncertain || !recovery.ready} onClick={() => void recovery.save(draft.value)}>Save draft</Button>}
      {!validDraft && <p role="alert" className="text-xs text-destructive">{draftError}</p>}
      {!attempted && <Button type="button" variant="ghost" size="sm" disabled={busy || !validDraft || recovery.busy || recovery.uncertain || !recovery.ready} onClick={() => {
        if (!draft && result) setDraft({ runId: result.runId, base: JSON.stringify(result), value: createResearchDraft(result) })
        setEditing(!editing)
      }}>{editing ? "Review changes" : "Edit preview"}</Button>}
      {attempted && <p className="text-xs text-muted-foreground">Saving was attempted. Retry uses these same edits.</p>}
    </>}
    <ResearchSourceEffects key={`${runId}:${scopeIdentity(target)}`} available={sourceEffects.available} organizationId={target.organizationId} effects={sourceEffects.effects}
      error={sourceEffects.error} pending={sourceEffects.pending} plan={sourceEffects.plan} onCheck={() => { void sourceEffects.check() }} />
    {partialItems.length > 0 && !unsavedPreview && !result && !targetStale && !checking && <section aria-label="Plan taking shape" className="space-y-2">
      <p className="text-xs text-muted-foreground">Unconfirmed items. Connections pending.</p>
      <IncomingResearchPreview items={partialItems} />
    </section>}
    {unsavedPreview && !result && !targetStale && !checking && <section aria-label="Unsaved plan preview" className="space-y-2">
      <p className="text-xs text-muted-foreground">Unsaved preview. Waiting for confirmation.</p>
      <p className="text-sm font-medium">{unsavedPreview.title}</p>
      <ResearchReview result={unsavedPreview} plan={planContext} />
    </section>}
    {stale && <p role="status" className="text-xs text-muted-foreground">This plan or objective changed. Discard this research and research the current plan.</p>}
    {message && !stale && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {recovery.error && <div role="alert" className="text-xs text-destructive">{recovery.error} {!recovery.conflict && <Button type="button" variant="ghost" size="sm" disabled={busy || recovery.busy} onClick={recovery.retry}>Retry draft</Button>}</div>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {leaving && <div role="group" aria-label="Unsaved preview edits" className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-sm">{leaving === "discard" ? "Discard this draft? Saved AI research stays available." : dirty ? "Save your edits before leaving?" : "Edits saved. Ready to leave."}</p>
      <div className="flex flex-wrap gap-2">
        {leaving !== "discard" && draft && <Button type="button" size="sm" disabled={!recoverableDraft || attempted || busy || recovery.busy || recovery.uncertain || !recovery.ready} onClick={() => void saveAndLeave()}>{dirty ? leaving === "close" ? "Save and close" : "Save and leave" : leaving === "close" ? "Close saved draft" : "Leave with saved draft"}</Button>}
        <Button type="button" size="sm" variant="outline" ref={keepEditing} onClick={() => { setLeaving(null); leaveTrigger.current?.focus() }}>Keep editing</Button>
        <Button type="button" size="sm" variant="ghost" disabled={(busy && attempted) || recovery.busy} onClick={async () => {
          const action = leaving
          if (typeof action === "object" && action) { navigate(action.href); return }
          if (action === "close") { onClose(); return }
          await discardSaved()
        }}>Discard edits</Button>
      </div>
    </div>}
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" disabled={(busy && attempted) || recovery.busy} onClick={() => leave("close")}>Close</Button>
      {!runId && !result && <ResearchHistoryMenu target={target} disabled={busy || checking || stale} onResume={id => {
        if (working.current || activeRun.current) return
        retain(id); void recover(false, id)
      }} />}
      {runId && !result && canCheck && <><Button type="button" variant="ghost" size="sm" disabled={checking} onClick={() => void recover(true)}>Stop</Button><Button type="button" variant="outline" size="sm" disabled={busy || checking || stale} onClick={() => void recover()}>Check status</Button></>}
      {runId && <Button type="button" variant="ghost" size="sm" disabled={busy || recovery.busy || recovery.uncertain} onClick={() => leave("discard")}>Discard</Button>}
      {result && <Button type="button" size="sm" disabled={busy || checking || stale || !validDraft || !recovery.ready || recovery.busy || recovery.uncertain || (!preview?.items.length && !preview?.removeReferences?.length)} onClick={() => void add()}>Add proposal</Button>}
      {!runId && !result && <Button type="submit" size="sm" disabled={busy || !quote || !prompt.trim() || Boolean(failure && researchRecovery[failure].action === "reopen")}>{target.mode === "new_objective" ? "Generate plan" : "Research"}</Button>}
    </div>
  </form>
}
