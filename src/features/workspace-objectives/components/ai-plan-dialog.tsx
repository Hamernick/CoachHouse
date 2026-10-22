"use client"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AiCreditsPanel, aiCreditBalance } from "@/features/ai-credits/client"
import type { ObjectiveScope } from "../island-types"
import type { WorkspaceObjectiveRecord } from "../types"
import type { AiPlanTransport } from "../ai-plan-types"
import { useAiPlan } from "../hooks/use-ai-plan"
import { AiPlanReview } from "./ai-plan-review"
export function AiPlanDialog({ scope, objective, transport, onClose, onChanged }: {
  scope: ObjectiveScope; objective: WorkspaceObjectiveRecord; transport: AiPlanTransport; onClose: () => void; onChanged: () => void
}) {
  const target = useMemo(() => ({ ...scope, objectiveId: objective.id, revision: objective.updatedAt }), [scope, objective.id, objective.updatedAt])
  const state = useAiPlan(target, transport, onChanged)
  const [prompt, setPrompt] = useState(""); const [usage, setUsage] = useState(false); const [closing, setClosing] = useState(false)
  const proposal = state.proposal; const application = proposal?.application
  const revise = proposal?.status === "succeeded" && !application
  const balance = state.quote ? aiCreditBalance(state.quote.account) : null
  return <Dialog open onOpenChange={open => { if (!open) { if (prompt.trim() || state.pending || state.recoverable || (proposal?.content && !application)) setClosing(true); else onClose() } }}>
    <DialogContent className="max-h-[90svh] overflow-y-auto rounded-3xl sm:max-w-xl">
      <DialogHeader><DialogTitle>Plan with AI</DialogTitle><DialogDescription>{objective.title}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{state.quote ? `${state.quote.maximumCredits} credits maximum per request` : "AI quote unavailable"}</span>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setUsage(!usage)}>Usage</Button>
      </div>
      {usage && state.quote && <AiCreditsPanel account={state.quote.account} />}
      {proposal?.content && <AiPlanReview content={proposal.content} objective={objective} />}
      {state.pending && <p role="status" className="text-sm text-muted-foreground">Working…</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {application && <p role="status" className="text-sm">{application.undone_at ? "Plan removed. Your AI usage is unchanged." : "Plan saved. You can edit its steps in the checklist or tree."}</p>}
      {proposal?.credits != null && <p className="text-xs text-muted-foreground">{proposal.credits} credits charged</p>}
      <div className="flex flex-wrap gap-2">
        {revise && Boolean(proposal?.content?.draft.steps.length) && <Button className="rounded-full" disabled={state.pending || state.recoverable} onClick={() => void state.apply()}>Add plan</Button>}
        {application && !application.undone_at && <Button variant="ghost" className="rounded-full" disabled={state.pending} onClick={() => void state.apply(true)}>Undo adding plan</Button>}
        {state.recoverable && <Button variant="secondary" className="rounded-full shadow-none" onClick={() => void state.stop()}>Stop request</Button>}
        {state.runId && <Button variant="ghost" className="rounded-full" disabled={state.pending} onClick={() => void state.refresh()}>Check status</Button>}
        {state.previous && proposal && ["failed", "canceled"].includes(proposal.status) && <Button variant="ghost" className="rounded-full" onClick={state.restorePrevious}>Previous proposal</Button>}
        {proposal && !state.recoverable && !application && <Button variant="ghost" className="rounded-full" disabled={state.pending} onClick={state.discard}>Discard proposal</Button>}
      </div>
      {!application && <form className="space-y-2" onSubmit={async event => { event.preventDefault(); if (await state.generate(prompt, Boolean(revise))) setPrompt("") }}>
        <Label htmlFor="ai-plan-request">{revise ? "What should change?" : "What should the plan consider?"}</Label>
        <Textarea id="ai-plan-request" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={4000} disabled={state.pending} placeholder={revise ? "Answer questions or request changes…" : "Describe your task, constraints, and what you already know…"} className="min-h-24 rounded-2xl shadow-none" />
        <Button type="submit" className="rounded-full" disabled={!prompt.trim() || !state.quote || state.pending || state.recoverable || (balance !== null && balance.available < (state.quote?.maximumCredits ?? 0))}>{revise ? "Revise proposal" : "Generate proposal"}</Button>
      </form>}
      {closing && <div role="alert" className="space-y-2 rounded-2xl bg-muted p-3 text-sm"><p>{state.recoverable ? "This request continues in the background. Reopen to check its status." : "Close this review? You can recover the proposal when you reopen it."}</p><div className="flex gap-2"><Button variant="ghost" className="rounded-full" onClick={() => setClosing(false)}>Keep reviewing</Button><Button variant="secondary" className="rounded-full" onClick={onClose}>Close review</Button></div></div>}
    </DialogContent>
  </Dialog>
}
