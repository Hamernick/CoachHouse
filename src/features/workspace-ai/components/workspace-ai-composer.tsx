"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AiCreditsPanel, aiCreditBalance } from "@/features/ai-credits/client"
import { quoteDocumentAssistance, readDocumentAssistance, stopDocumentAssistance } from "../actions"
import { useAiDocumentTarget } from "../hooks/document-bridge"
import type { AiDocumentProposal, AiStreamPart } from "../types"

export type ComposerAssistance = {
  active: boolean; pending: boolean; controls: ReactNode; revising?:boolean
  submit: (prompt: string) => Promise<boolean>
}
export function WorkspaceAiComposer({ children }: { children: (assistant: ComposerAssistance) => ReactNode }) {
  const bridge = useAiDocumentTarget()
  const [active,setActive] = useState(false)
  const [pending,setPending] = useState(false)
  const [quote,setQuote] = useState<Awaited<ReturnType<typeof quoteDocumentAssistance>> | null>(null)
  const [proposal,setProposal] = useState<AiDocumentProposal | null>(null)
  const [preview,setPreview] = useState("")
  const [error,setError] = useState<string | null>(null)
  const [applied,setApplied] = useState(false)
  const [revision,setRevision] = useState<AiDocumentProposal | null>(null)
  const [usage,setUsage] = useState(false)
  const [showOriginal,setShowOriginal] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const runId = useRef<string | null>(null)
  const target = bridge?.target
  const targetKey = target ? `${target.userId}:${target.organizationId}:${target.sectionId}` : ""
  const scope = useMemo(() => ({ targetKey }),[targetKey])
  const currentScope = useRef(scope)
  currentScope.current=scope
  const enableIntent = useRef(0)
  useEffect(() => {
    abort.current?.abort()
    setActive(false); setPending(false); setQuote(null); setProposal(null); setPreview(""); setError(null); setApplied(false)
    runId.current = null
    setUsage(false); setShowOriginal(false); setRevision(null)
  },[targetKey])
  useEffect(() => () => abort.current?.abort(),[])

  async function enable() {
    const intent = ++enableIntent.current
    const current = () => currentScope.current === scope && enableIntent.current === intent
    if (active) { setActive(false); return }
    if (!bridge) { setError("Open a core document before asking for AI assistance."); return }
    try {
      setError(null)
      setActive(true)
      let savedId: string | null = null
      try { savedId = sessionStorage.getItem(`workspace-ai:${targetKey}`) } catch { /* Browser storage may be unavailable. */ }
      if (savedId) {
        const result = await readDocumentAssistance(savedId,bridge.target)
        if (!current()) return
        runId.current=savedId; setProposal(result)
        if (result.revisionSourceRunId && ["failed","canceled"].includes(result.status)) {
          const previous = await readDocumentAssistance(result.revisionSourceRunId,bridge.target)
          if (!current()) return
          if (previous.status === "succeeded" && !previous.application) setRevision(previous)
        }
      }
      const next = await quoteDocumentAssistance(bridge.target)
      if (current()) setQuote(next)
    } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : "AI assistance is unavailable.") }
  }
  async function refresh() {
    const id = runId.current
    if (!id || !target) return
    const current = () => currentScope.current === scope && runId.current === id
    try {
      const result = await readDocumentAssistance(id,target)
      if (!current()) return
      setProposal(result); setError(null); setQuote(null)
      const next = await quoteDocumentAssistance(target)
      if (current()) setQuote(next)
    } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : "Unable to check this request.") }
  }
  async function stop() {
    const id = runId.current, controller = abort.current
    if (!id || !target) return
    const current = () => currentScope.current === scope && runId.current === id
    try { await stopDocumentAssistance(id,target); if (current()) controller?.abort() }
    catch { if (current()) setError("Unable to stop the request. Check its status before retrying.") }
  }
  async function submit(prompt: string) {
    if (!bridge || !quote || pending) return false
    if (bridge.dirty || bridge.saving) {setError("Save your current edits before generating another draft.");return false}
    if (aiCreditBalance(quote.account).available < quote.maximumCredits) { setError("Not enough credits for this request. Your text is still here."); return false }
    if (runId.current && (!proposal || ["reserved","running","reconciling"].includes(proposal.status))) {
      setError("Check the current request before starting another."); return false
    }
    const id = crypto.randomUUID()
    const controller = new AbortController()
    const current = () => currentScope.current === scope && abort.current === controller
    abort.current=controller; runId.current=id
    try { sessionStorage.setItem(`workspace-ai:${targetKey}`,id) } catch { /* The current request remains available in memory. */ }
    setPending(true); setPreview(""); setProposal(null); setApplied(false); setError(null)
    try {
      const response = await fetch("/api/workspace/ai/document", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id,target: bridge.target,prompt,
          maximumCredits: quote.maximumCredits,tariffVersion: quote.tariffVersion,
          ...(revision ? {reviseRunId:revision.id} : {}) }) })
      if (response.headers.get("content-type")?.includes("application/json")) {
        const body = await response.json()
        if (!current()) return false
        if (!response.ok) {
          if (body.reserved === false) {
            setProposal(revision);runId.current=revision?.id ?? null
            try {
              if (revision) sessionStorage.setItem(`workspace-ai:${targetKey}`,revision.id)
              else sessionStorage.removeItem(`workspace-ai:${targetKey}`)
            } catch { /* Optional browser recovery pointer. */ }
          }
          throw new Error(body.error ?? "The request could not start.")
        }
        setProposal(body.proposal)
        if (body.proposal.status === "succeeded") setRevision(null)
        return body.proposal.status === "succeeded"
      }
      if (!response.ok || !response.body) throw new Error("The request could not start.")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let delivered = false
      let terminal = false
      while (true) {
        const { value,done } = await reader.read()
        if (!current()) return false
        if (done) break
        buffer += decoder.decode(value,{ stream: true })
        let newline: number
        while ((newline=buffer.indexOf("\n"))>=0) {
          const part = JSON.parse(buffer.slice(0,newline)) as AiStreamPart
          buffer=buffer.slice(newline+1)
          if (part.type === "text") setPreview(previous => previous+part.text)
          if (part.type === "proposal") {
            terminal=true
            setProposal(part.proposal);delivered=part.proposal.status === "succeeded"
            if (delivered) setRevision(null)
            else setError(part.proposal.status === "canceled" ? "Request stopped. No credits charged." : "The draft was incomplete. No credits charged.")
          }
          if (part.type === "error") {terminal=true;setError(part.message)}
        }
      }
      if (!terminal && current()) setError("Connection interrupted. Check status before starting another request.")
      return delivered
    } catch (cause) {
      if (!current()) return false
      setError(controller.signal.aborted ? "Stopped. Check status to confirm the final credit charge." : cause instanceof Error ? cause.message : "Request interrupted. Check status before retrying.")
      return false
    } finally {
      if (current()) {
        setPending(false); abort.current=null; setQuote(null)
        try {
          const next = await quoteDocumentAssistance(bridge.target)
          if (currentScope.current === scope && (runId.current === id || runId.current === revision?.id || !runId.current)) setQuote(next)
        } catch { /* Keep generation disabled until the current quote is refreshed. */ }
      }
    }
  }
  const application = proposal?.application ?? (bridge?.application?.run_id === proposal?.id ? bridge?.application : null)
  const hasApplied = applied || Boolean(application)
  const appliedSaved = Boolean(application && bridge && !bridge.dirty && !bridge.saving && bridge.target.revision === application.saved_revision)
  if (process.env.NEXT_PUBLIC_WORKSPACE_AI_ENABLED !== "true") return children({ active: false, pending: false, controls: null, submit })
  const controls = <Button type="button" variant="ghost" size="sm" className="h-9 touch-manipulation rounded-full px-2 text-xs [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
    aria-pressed={active} aria-label="AI document assistance" disabled={pending} onClick={() => void enable()}>AI</Button>
  return <>
    {(active || error) && <section aria-label="AI document assistance" className="nodrag nopan nowheel mx-2.5 flex min-w-0 flex-col gap-2 rounded-2xl border border-border/60 bg-card/95 p-3 text-sm shadow-none backdrop-blur-xl [&_button]:touch-manipulation [@media(pointer:coarse)]:[&_button]:min-h-11">
      {target && active ? <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">{target.title}</span>
        <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={() => setUsage(!usage)}>{quote ? `${quote.maximumCredits} credits maximum · Usage` : "Refreshing credits…"}</Button>
      </div> : null}
      {usage && quote ? <AiCreditsPanel account={quote.account} /> : null}
      {(preview || proposal?.content || pending) && <div className="h-56 overflow-auto overscroll-contain rounded-xl bg-muted/40 p-3">
        {proposal?.content ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: proposal.content }} />
          : preview ? <p className="whitespace-pre-wrap text-muted-foreground">{preview.replace(/<[^>]*>/g,"")}</p>
            : <p role="status" className="text-muted-foreground">Drafting…</p>}
      </div>}
      {error ? <p role="status" className="text-xs text-muted-foreground">{error}</p> : null}
      {proposal || pending || runId.current ? <div className="flex flex-wrap items-center gap-2">
        {pending ? <Button size="sm" variant="secondary" className="rounded-full shadow-none" onClick={() => void stop()}>Stop</Button> : null}
        {proposal?.status === "succeeded" && !hasApplied && !pending ? <Button size="sm" className="rounded-full shadow-none" disabled={bridge?.dirty || bridge?.saving} onClick={() => {
          if (!bridge?.apply(proposal)) { setError("The editor changed. Keep this proposal and review your current document before applying."); return }
          setApplied(true); setRevision(null); setError(null)
        }}>Apply to editor</Button> : null}
        {hasApplied ? <span className="text-xs" role="status">{appliedSaved ? "Saved" : bridge?.saving ? "Saving…" : application && !bridge?.dirty ? "Applied previously" : "Applied to editor · unsaved changes"}</span> : null}
        {proposal?.status === "succeeded" && !hasApplied && !pending ? <Button size="sm" variant="ghost" className="rounded-full" aria-pressed={Boolean(revision)} onClick={() => setRevision(revision ? null : proposal)}>{revision ? "Cancel revision" : "Revise"}</Button> : null}
        {revision && proposal && ["failed","canceled"].includes(proposal.status) && !pending ? <Button size="sm" variant="ghost" className="rounded-full" onClick={() => {
          setProposal(revision);setPreview("");runId.current=revision.id;setError(null)
          try {sessionStorage.setItem(`workspace-ai:${targetKey}`,revision.id)} catch { /* Optional browser recovery pointer. */ }
        }}>Previous draft</Button> : null}
        {proposal?.content ? <Button size="sm" variant="ghost" className="rounded-full" aria-expanded={showOriginal} onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? "Hide original" : "Compare original"}</Button> : null}
        {proposal?.credits !== null && proposal?.credits !== undefined ? <span className="text-xs text-muted-foreground">{proposal.credits} credits</span> : null}
        {!pending ? <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void refresh()}>Check status</Button> : null}
        {!pending && (!runId.current || (proposal && !["reserved","running","reconciling"].includes(proposal.status))) ? <Button size="sm" variant="ghost" className="rounded-full" onClick={() => {
          setProposal(null);setPreview("");setApplied(false);setShowOriginal(false);setRevision(null);runId.current=null;
          try { sessionStorage.removeItem(`workspace-ai:${targetKey}`) } catch { /* Storage can be unavailable. */ }
        }}>Discard</Button> : null}
      </div> : null}
      {showOriginal && proposal ? <div className="max-h-48 overflow-auto rounded-xl border border-border/60 p-3 text-muted-foreground"><p className="whitespace-pre-wrap">{proposal.original.replace(/<[^>]*>/g,"") || "Empty document"}</p></div> : null}
    </section>}
    {children({ active,pending,controls,submit,revising:Boolean(revision) })}
  </>
}
