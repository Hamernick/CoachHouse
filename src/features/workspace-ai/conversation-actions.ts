"use server"
import { assertResearchCanvasAccess } from "./server/research-canvas-access"
import { nextConversationTarget } from "./server/conversation-target"
import { newObjectiveTargetSchema } from "./research-types"
import { loadResearchContext } from "./server/research-context"
import { conversationEntries, readConversationTurn } from "./server/research-conversation"
import { chatMutationSchema } from "./lib/research-conversation"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { ResearchConversationTurn } from "./lib/research-conversation"
import { readConversationHistoryTurn } from "./server/conversation-history"

export async function getWorkspaceConversation(target: unknown, rootId: string | null = null, beforeTurn?: number) {
  try {
    const context = await loadResearchContext(newObjectiveTargetSchema.parse(target), false)
    const entries = await conversationEntries(context, rootId, beforeTurn)
    if (!rootId) {
      const recent = await Promise.all(entries.map(async entry => {
        try {
          const turn = await readConversationHistoryTurn(context, entry)
          return { ...entry, target: turn.target, title: entry.customTitle ?? turn.savedPlan?.title ?? turn.title }
        } catch { return { ...entry, customTitle: null, title: null } }
      }))
      await assertResearchCanvasAccess(context)
      return { entries: recent }
    }
    const turns: ResearchConversationTurn[] = []
    for (const entry of entries) {
      try {
        turns.push(await readConversationHistoryTurn(context, entry))
      } catch {
        // Do not reveal cached prose when its authorization or sources changed.
        turns.push({ ...entry, customTitle: null, prompt: "", title: null, summary: null, applied: false, unavailable: true })
      }
    }
    // Recheck once after assembling the page, including unavailable turns.
    await assertResearchCanvasAccess(context)
    const visibleEntries = entries.map((entry, index) => turns[index].unavailable ? { ...entry, customTitle: null, title: null } : entry)
    return { entries: visibleEntries, turns, beforeTurn: entries.length === 12 && entries[0].turn > 1 ? entries[0].turn : null }
  } catch { return { error: "Chat could not be loaded. Retry." } }
}

export async function updateWorkspaceConversation(target: unknown, input: unknown): Promise<{ ok: true } | { error: string }> {
  try {
    const change = chatMutationSchema.parse(input)
    const context = await loadResearchContext(newObjectiveTargetSchema.parse(target), false)
    const { error } = await createSupabaseAdminClient({ actorId: context.user.id, requestTimeoutMs: 10000 }).rpc("manage_workspace_research_conversation", {
      p_org_id: context.target.organizationId, p_actor_id: context.user.id, p_canvas_id: context.canvasId,
      p_root_id: change.rootId, p_operation: change.action, p_revision: change.revision,
      p_title: change.action === "rename" ? change.title : null, p_pinned: change.action === "pin" ? change.pinned : null,
    })
    if (error) return { error: error.code === "55000" ? "Wait for this chat to finish before deleting it." : "Chat could not be updated. Reload and retry." }
    return { ok: true }
  } catch { return { error: "Chat could not be updated. Reload and retry." } }
}

export async function prepareWorkspaceConversationTurn(target: unknown, parentRunId: string) {
  try {
    const context = await loadResearchContext(newObjectiveTargetSchema.parse(target), false)
    const { target: savedTarget } = await readConversationTurn(context, parentRunId)
    const next = nextConversationTarget(context, parentRunId, savedTarget)
    await loadResearchContext(next)
    return { target: next }
  } catch (error) {
    return { error: error instanceof Error && error.message.startsWith("Accept the proposed plan")
      ? error.message : "This plan changed or is unavailable. Reopen the chat before continuing." }
  }
}
