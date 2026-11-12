"use client"

import { prepareWorkspaceConversationTurn } from "../conversation-actions"
import { toast } from "sonner"
import type { ResearchPlacement } from "../lib/research-placement"
import { useComposerContext } from "./use-composer-context"
import type { ComposerContextControl } from "@/lib/workspace/composer-context"
import { useRef, useState, type ReactNode } from "react"
import type { ResearchTarget, ResearchResult } from "../research-types"
import type { ResearchDraft } from "../lib/research-draft"
import { WorkspaceResearch, type ResearchComposer } from "./workspace-research"
import { useResearchConversation } from "./use-research-conversation"
import { WorkspaceChatSidebar } from "./chat-sidebar"
import { ResearchConversationView } from "./research-conversation-view"

type Planner = {
  context: ComposerContextControl
  active: boolean
  input: string
  onInputChange: (value: string) => void
  focusVersion: number
  request?: ResearchComposer
  submit: (prompt: string, onReturn: (draft: string, saved: boolean) => void) => void
}
type Props = {
  organizationId: string; userId: string; canvasId: string | null; revision: number
  enabled?: boolean; children: (planner: Planner | undefined) => ReactNode
  onOpenPlan?: (id: string) => void
  disabled: boolean; onProposal: (result: ResearchResult, draft?: ResearchDraft, placement?: ResearchPlacement) => Promise<boolean>
}

/** Planning uses the dock's input; only the review sits above it. */
export function WorkspaceNewPlan(props: Props) {
  return <NewPlanSession key={`${props.userId}:${props.organizationId}:${props.canvasId ?? "default"}`} {...props} />
}
function NewPlanSession({ organizationId, userId, canvasId, revision, disabled, onProposal, onOpenPlan, children, enabled = true }: Props) {
  const [target, setTarget] = useState<ResearchTarget | null>(null)
  const [boardRevision, setBoardRevision] = useState(revision)
  const [input, updateInput] = useState("")
  const [followup, setFollowup] = useState("")
  const contextVersion = useRef(0)
  const context = useComposerContext({ mode: "new_objective", organizationId, canvasId, revision }, sanitize => {
    contextVersion.current += 1
    updateInput(sanitize); setFollowup(sanitize)
  })
  const setInput = (prompt: string) => { updateInput(prompt); context.retain(prompt) }
  const [focusVersion, setFocusVersion] = useState(0)
  const saved = useRef(false), opened = useRef(false), sessionVersion = useRef(0)
  const [turn, setTurn] = useState<{ key: number; parentRunId?: string; restoreRunId?: string; autoStart?: boolean }>({ key: 0 })
  const [preparing, setPreparing] = useState(false)
  const advancing = useRef(false), activeTurn = useRef<string | null>(null)
  const conversation = useResearchConversation({ mode: "new_objective", organizationId, canvasId, revision }, enabled, (id, automatic, restoredTarget) => {
    if (advancing.current || (automatic && (opened.current || input))) return
    if (!automatic && opened.current && activeTurn.current === id) { setFocusVersion(version => version + 1); return }
    activeTurn.current = id
    opened.current = true; saved.current = false; sessionVersion.current += 1
    setInput(""); setFollowup("")
    if (!automatic) setFocusVersion(version => version + 1)
    setBoardRevision(revision)
    setTarget(restoredTarget ?? { mode: "new_objective", organizationId, canvasId, revision })
    setTurn(previous => ({ key: previous.key + 1, restoreRunId: id }))
  })
  const close = () => {
    setTarget(null); opened.current = false; sessionVersion.current += 1
    if (saved.current) setInput("")
    setFocusVersion(version => version + 1)
  }
  const open = (prompt: string) => {
    if (!enabled || disabled || opened.current || context.control.access?.checking) return
    activeTurn.current = null
    conversation.clear()
    opened.current = true; saved.current = false; sessionVersion.current += 1
    setInput(prompt); setFocusVersion(version => version + 1)
    setBoardRevision(revision)
    setTarget({ mode: "new_objective", organizationId, canvasId, revision })
    setTurn(previous => ({ key: previous.key + 1 }))
  }
  const newChat = () => {
    activeTurn.current = null
    conversation.clear(); setInput(""); setFollowup("")
    opened.current = true; saved.current = false; sessionVersion.current += 1
    setBoardRevision(revision)
    setTarget({ mode: "new_objective", organizationId, canvasId, revision })
    setTurn(previous => ({ key: previous.key + 1, autoStart: false }))
    setFocusVersion(version => version + 1)
  }
  const planner: Planner = { context: context.control, active: Boolean(target), input, onInputChange: setInput, focusVersion, submit: open }
  if (!enabled || !target) return <>{enabled && <WorkspaceChatSidebar conversation={conversation} disabled={disabled} onNew={newChat} />}{children(enabled ? planner : undefined)}</>
  return <WorkspaceResearch key={turn.key} parentRunId={turn.parentRunId} restoreRunId={turn.restoreRunId} autoStart={turn.autoStart} target={target} userId={userId} stale={disabled || revision !== boardRevision}
    onRunChange={(id, status) => { activeTurn.current = id; void conversation.record(id, status) }}
    context={context.control.selected.map(({id,revision}) => ({id,revision}))}
    initialPrompt={input} onPromptChange={setInput}
    onProposal={async (result, edits, placement) => {
      const version = sessionVersion.current
      const applied = await onProposal(result, edits, placement)
      if (version === sessionVersion.current) saved.current = applied
      return applied
    }} onClose={close}>
    {request => {
      const ready = Boolean(request.followup)
      const blocked = request.pending || disabled || preparing || Boolean(context.control.access?.checking)
      return <><WorkspaceChatSidebar conversation={conversation} disabled={disabled || preparing || Boolean(request.navigationBlocked)} onNew={newChat} onDeleted={() => { setInput(""); setFollowup(""); close() }} />{children({ ...planner, request: {
        ...request,
        panel: <ResearchConversationView onOpenPlan={onOpenPlan} conversation={conversation} currentId={request.followup?.id} currentPrompt={input} pending={request.pending} panel={request.panel} />,
        ...(request.hasRun ? { prompt: followup, inputDisabled: request.inputDisabled || disabled || preparing, submitDisabled: !ready || blocked || !followup.trim() || followup.length > 2000,
          onChange: (value: string) => { setFollowup(value); context.retain(value) },
          submit: async () => {
            if (advancing.current || !request.followup || !followup.trim() || blocked) return
            advancing.current = true; setPreparing(true)
            const version = sessionVersion.current
            const accessVersion = contextVersion.current
            try {
              if (!await request.followup.prepare()) return
              if (version !== sessionVersion.current || accessVersion !== contextVersion.current) return
              const next = await prepareWorkspaceConversationTurn({ mode: "new_objective", organizationId, canvasId, revision }, request.followup.id)
              if (version !== sessionVersion.current || accessVersion !== contextVersion.current) return
              if ("error" in next) { toast.error(next.error); return }
              setBoardRevision(revision); setTarget(next.target)
              setInput(followup); setFollowup("")
              setTurn(previous => ({ key: previous.key + 1, parentRunId: request.followup!.id, autoStart: true }))
              setFocusVersion(version => version + 1)
            } finally { advancing.current = false; setPreparing(false) }
          },
        } : {}),
      } })}</>
    }}
  </WorkspaceResearch>
}
