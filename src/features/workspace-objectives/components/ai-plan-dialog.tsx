"use client"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { AiCreditsPanel, aiCreditBalance } from "@/features/ai-credits/client"
import type { ObjectiveScope } from "../island-types"
import type { WorkspaceObjectiveRecord } from "../types"
import type { ObjectivePlan } from "../plan-types"
import type { AiPlanTransport } from "../ai-plan-types"
import { useAiPlan } from "../hooks/use-ai-plan"
import { AiPlanReview } from "./ai-plan-review"
export function AiPlanDialog({ scope, objective, plan, transport, onClose, onChanged }: {
  plan?: ObjectivePlan; scope: ObjectiveScope; objective: WorkspaceObjectiveRecord; transport: AiPlanTransport; onClose: () => void; onChanged: () => void
}) {
  const target = useMemo(() => ({ ...scope, objectiveId: objective.id, revision: objective.updatedAt, ...(plan ? { plan: { id: plan.id, revision: plan.revision } } : {}) }), [scope, objective.id, objective.updatedAt, plan])
  const state = useAiPlan(target, transport, onChanged)
  const [prompt, setPrompt] = useState(""); const [usage, setUsage] = useState(false); const [closing, setClosing] = useState(false)
  const [documentId, setDocumentId] = useState("none")
  const document = state.proposal ? state.proposal.document : state.quote?.documents?.find(item => item.sectionId === documentId)
  const proposal = state.proposal; const application = proposal?.application
  const revise = proposal?.status === "succeeded" && !application
  const balance = state.quote ? aiCreditBalance(state.quote.account) : null
  return <section aria-label="Plan with AI" className="flex min-w-0 flex-col gap-3" onKeyDown={event => {
    if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); setClosing(true) }
  }}>
      <div className="flex items-center justify-between gap-2"><h2 className="min-w-0 truncate text-sm font-medium">{plan?.title ?? objective.title}</h2><Button variant="ghost" size="sm" className="rounded-full" onClick={() => { if (prompt.trim() || state.pending || state.recoverable || (proposal?.content && !application)) setClosing(true); else onClose() }}>Back</Button></div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{state.quote ? `${state.quote.maximumCredits} credits maximum per request` : "AI quote unavailable"}</span>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setUsage(!usage)}>Usage</Button>
      </div>
      {usage && state.quote && <AiCreditsPanel account={state.quote.account} />}
      {proposal?.content && <AiPlanReview baseline={proposal.baseline} content={proposal.content} objective={objective} />}
      {state.pending && <p role="status" className="text-sm text-muted-foreground">Working…</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {application && <p role="status" className="text-sm">{application.undone_at ? plan ? "Previous plan restored. Your AI usage is unchanged." : "Plan removed. Your AI usage is unchanged." : "Plan saved. You can edit its steps in the checklist or tree."}</p>}
      {proposal?.credits != null && <p className="text-xs text-muted-foreground">{proposal.credits} credits charged</p>}
      <div className="flex flex-wrap gap-2">
        {revise && Boolean(proposal?.content?.draft.steps.length) && <Button className="rounded-full" disabled={state.pending || state.recoverable} onClick={() => void state.apply()}>{plan ? "Apply changes" : "Add plan"}</Button>}
        {application && !application.undone_at && <Button variant="ghost" className="rounded-full" disabled={state.pending} onClick={() => void state.apply(true)}>{plan ? "Undo changes" : "Undo adding plan"}</Button>}
        {state.recoverable && <Button variant="secondary" className="rounded-full shadow-none" onClick={() => void state.stop()}>Stop request</Button>}
        {state.runId && <Button variant="ghost" className="rounded-full" disabled={state.pending} onClick={() => void state.refresh()}>Check status</Button>}
        {state.previous && proposal && ["failed", "canceled"].includes(proposal.status) && <Button variant="ghost" className="rounded-full" onClick={state.restorePrevious}>Previous proposal</Button>}
        {proposal && !state.recoverable && !application && <Button variant="ghost" className="rounded-full" disabled={state.pending} onClick={state.discard}>Discard proposal</Button>}
      </div>
      {!application && <form className="flex flex-col gap-2" onSubmit={async event => { event.preventDefault(); if (await state.generate(prompt, Boolean(revise), document)) setPrompt("") }}>
        <Label htmlFor="ai-plan-request">{revise ? "What should change?" : "What should the plan consider?"}</Label>
        <InputGroup className="flex-col gap-0 rounded-2xl border border-border/70 p-1"><InputGroupTextarea id="ai-plan-request" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={4000} disabled={state.pending} placeholder={revise ? "Answer questions or request changes…" : "Describe your task, constraints, and what you already know…"} className="min-h-24 resize-none rounded-xl border-0 bg-transparent shadow-none dark:bg-transparent focus-visible:ring-0" /><InputGroupAddon align="block-end" className="flex-wrap justify-between gap-1 p-1">
        <Select value={document?.sectionId ?? "none"} onValueChange={setDocumentId} disabled={state.pending || state.recoverable || Boolean(proposal)}><SelectTrigger aria-label="Plan document context" className="h-8 w-fit max-w-full rounded-full border-0 bg-transparent text-xs shadow-none"><SelectValue placeholder="No document" /></SelectTrigger><SelectContent><SelectItem value="none">No document</SelectItem>{(state.quote?.documents ?? []).map(item => <SelectItem key={item.sectionId} value={item.sectionId}>{item.title}</SelectItem>)}{document && !state.quote?.documents?.some(item => item.sectionId === document.sectionId) && <SelectItem value={document.sectionId}>{document.title}</SelectItem>}</SelectContent></Select>
        <Button type="submit" className="rounded-full" disabled={!prompt.trim() || !state.quote || state.pending || state.recoverable || (balance !== null && balance.available < (state.quote?.maximumCredits ?? 0))}>{revise ? "Revise proposal" : "Generate proposal"}</Button></InputGroupAddon></InputGroup>
      </form>}
      {closing && <div role="alert" className="space-y-2 rounded-2xl bg-muted p-3 text-sm"><p>{state.recoverable ? "This request continues in the background. Reopen to check its status." : "Close this review? You can recover the proposal when you reopen it."}</p><div className="flex gap-2"><Button variant="ghost" className="rounded-full" onClick={() => setClosing(false)}>Keep reviewing</Button><Button variant="secondary" className="rounded-full" onClick={onClose}>Close review</Button></div></div>}
  </section>
}
