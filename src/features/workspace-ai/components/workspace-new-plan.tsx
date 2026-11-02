"use client"

import { useId, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import type { NewObjectiveTarget, ResearchResult } from "../research-types"
import { WorkspaceResearch } from "./workspace-research"

type Planner = {
  active: boolean
  submit: (prompt: string, onReturn: (draft: string, saved: boolean) => void) => void
}
import type { ResearchDraft } from "../lib/research-draft"

type Props = {
  organizationId: string; userId: string; canvasId: string | null; revision: number
  enabled?: boolean; children?: (planner: Planner | undefined) => ReactNode
  disabled: boolean; onProposal: (result: ResearchResult, draft?: ResearchDraft) => Promise<boolean>
}

/** A run-only preview. The target has a canvas revision, never an objective ID. */
export function WorkspaceNewPlan(props: Props) {
  return <NewPlanSession key={`${props.userId}:${props.organizationId}:${props.canvasId ?? "default"}`} {...props} />
}
function NewPlanSession({ organizationId, userId, canvasId, revision, disabled, onProposal, children, enabled = true }: Props) {
  const [target, setTarget] = useState<NewObjectiveTarget | null>(null)
  const draft = useRef("")
  const returnToComposer = useRef<Parameters<Planner["submit"]>[1] | null>(null)
  const saved = useRef(false), opened = useRef(false)
  const sessionVersion = useRef(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = () => {
    setTarget(null); opened.current = false; sessionVersion.current += 1
    if (returnToComposer.current) returnToComposer.current(draft.current, saved.current)
    else requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
    returnToComposer.current = null
  }
  const open = (prompt: string, onReturn?: Parameters<Planner["submit"]>[1]) => {
    if (!enabled || disabled || opened.current) return
    opened.current = true; saved.current = false; draft.current = prompt; returnToComposer.current = onReturn ?? null; sessionVersion.current += 1
    setTarget({ mode: "new_objective", organizationId, canvasId, revision })
    requestAnimationFrame(() => document.getElementById(id)?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true }))
  }
  return <>
    {enabled && <div className="nodrag nopan nowheel min-w-0 px-2.5">
      <Button ref={trigger} type="button" variant="ghost" size="sm" className="min-h-11 rounded-lg"
        disabled={disabled && !target} aria-expanded={Boolean(target)} aria-controls={id}
        onClick={() => target ? document.getElementById(id)?.querySelector<HTMLButtonElement>("button")?.focus() : open("")}>Plan with AI</Button>
      {target && <section id={id} aria-label="New plan preview" className="max-h-[60dvh] min-w-0 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-1 break-words [@media(pointer:coarse)]:[&_button]:min-h-11">
        <WorkspaceResearch target={target} userId={userId} stale={disabled || revision !== target.revision}
          initialPrompt={draft.current} onPromptChange={prompt => { draft.current = prompt }}
          onProposal={async (result, edits) => {
            const version = sessionVersion.current
            const applied = await onProposal(result, edits)
            // Closing and reopening cannot let an old save clear a newer request.
            if (version === sessionVersion.current) saved.current = applied
            return applied
          }} onClose={close} />
      </section>}
    </div>}
    {children?.(enabled ? { active: Boolean(target), submit: open } : undefined)}
  </>
}
