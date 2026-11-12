import { z } from "zod"
import type { UIMessage } from "ai"

export const conversationPlanPartSchema = z.strictObject({ runId: z.uuid(), title: z.string().min(1).max(240) })
export const conversationReplyPartSchema = conversationPlanPartSchema.extend({ kind: z.enum(["answer", "clarify"]) })
const textPart = z.strictObject({ type: z.literal("text"), text: z.string().max(2000) })
export const conversationMessagesSchema = z.array(z.discriminatedUnion("role", [
  z.strictObject({ id: z.string(), role: z.literal("user"), parts: z.tuple([textPart]) }),
  z.strictObject({ id: z.string(), role: z.literal("assistant"), parts: z.tuple([
    textPart, z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("data-plan"), data: conversationPlanPartSchema }),
      z.strictObject({ type: z.literal("data-reply"), data: conversationReplyPartSchema }),
    ]),
  ]) }),
])).max(2)
export type ConversationMessage = UIMessage<unknown, { plan: z.infer<typeof conversationPlanPartSchema>; reply: z.infer<typeof conversationReplyPartSchema> }>

/** Stable IDs are run-owned; the browser cannot supply a different transcript. */
export function parseConversationMessages(value: unknown, runId: string): ConversationMessage[] {
  const messages = conversationMessagesSchema.parse(value)
  const roles = new Set<string>()
  for (const message of messages) {
    if (message.id !== `${runId}:${message.role}` || roles.has(message.role) ||
        (message.role === "assistant" && message.parts[1].data.runId !== runId)) throw new Error("Invalid chat message identity")
    roles.add(message.role)
  }
  return messages
}

export const conversationMessageText = (messages: ConversationMessage[], role: "user" | "assistant") =>
  messages.find(message => message.role === role)?.parts.flatMap(part => part.type === "text" ? [part.text] : []).join("\n") ?? ""
