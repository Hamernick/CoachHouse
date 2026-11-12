import "server-only"
import { validateUIMessages } from "ai"
import { readAiRun } from "@/features/ai-credits"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { conversationReplyPartSchema, conversationPlanPartSchema, parseConversationMessages, conversationMessageText } from "../lib/conversation-messages"
import type { ResearchConversationEntry, ResearchConversationTurn } from "../lib/research-conversation"
import { researchResultSchema } from "../research-types"
import type { ResearchContext } from "./research-context"
import { researchRunSchema } from "./research-run"
import { storedConversationTarget, savedConversationPlan } from "./conversation-target"
import { assertResearchProvenance, assertResearchSourcesAccessible } from "./research-result-access"
import { ResearchRecoveryError } from "./research-recovery"

/** Readable history is not an executable proposal. Do not call readResearchRun:
 * that checks current proposal applicability and may reject unrelated board edits.
 * All actual observed source dependencies still require fresh authorization.
 */
export async function readConversationHistoryTurn(context: ResearchContext, entry: ResearchConversationEntry): Promise<ResearchConversationTurn> {
  const raw = researchRunSchema.parse(await readAiRun(entry.id, context.target.organizationId, context.user.id))
  const target = storedConversationTarget(context, raw)
  if (raw.id !== entry.id || raw.target.conversation?.id !== entry.rootId || raw.target.conversation.turn !== entry.turn)
    throw new ResearchRecoveryError("scope_mismatch")
  const { data, error } = await createSupabaseAdminClient({ actorId: context.user.id, requestTimeoutMs: 10000 }).rpc("manage_workspace_research_conversation", {
    p_org_id: context.target.organizationId, p_actor_id: context.user.id, p_canvas_id: context.canvasId,
    p_root_id: entry.rootId, p_operation: "read",
  })
  if (error || !data || data.deleted !== false) throw new ResearchRecoveryError("verification_unavailable")
  const messages = parseConversationMessages(raw.conversation_messages, raw.id)
  await validateUIMessages({ messages, dataSchemas: { plan: conversationPlanPartSchema, reply: conversationReplyPartSchema } })
  let sources: ResearchConversationTurn["sources"]
  if (messages.some(message => message.role === "assistant")) {
    const result = researchResultSchema.parse(JSON.parse(raw.proposal ?? "null"))
    assertResearchProvenance(result, raw.id, target)
    await assertResearchSourcesAccessible(context, result, "history")
    if (result.responseKind === "answer" || result.responseKind === "clarify") sources = result.sources
  }
  const saved = savedConversationPlan(context, raw.id)
  const planPart = messages.flatMap(message => message.parts).find(part => part.type === "data-plan" || part.type === "data-reply")
  return { ...entry, target, messages, ...(sources?.length ? { sources } : {}), prompt: conversationMessageText(messages, "user"),
    title: planPart ? planPart.data.title : null,
    summary: conversationMessageText(messages, "assistant") || null, applied: Boolean(saved), unavailable: false,
    ...(saved ? { savedPlan: { id: saved.objective.id, title: saved.objective.title, description: null } } : {}),
  }
}
