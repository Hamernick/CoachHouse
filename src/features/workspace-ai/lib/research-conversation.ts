import { z } from "zod"
import { researchTargetSchema, researchDependenciesSchema, type ResearchDependencies, type ResearchResult } from "../research-types"
import type { ConversationMessage } from "./conversation-messages"

export const researchConversationLinkSchema = z.strictObject({
  id: z.uuid(), parentId: z.uuid().nullable(), turn: z.number().int().min(1).max(2147483647),
  draftRevision: z.number().int().nonnegative(),
})
export type ResearchConversationLink = z.infer<typeof researchConversationLinkSchema>
export const researchConversationEntrySchema = z.strictObject({
  responseKind: z.enum(["proposal", "answer", "clarify"]).optional(),
  target: researchTargetSchema.optional(),
  id: z.uuid(), rootId: z.uuid(), turn: z.number().int().min(1).max(2147483647),
  customTitle: z.string().nullable().optional(), pinned: z.boolean().optional(), metadataRevision: z.number().int().nonnegative().optional(),
  createdAt: z.string(), status: z.string(), title: z.string().nullable().optional(),
})
export type ResearchConversationEntry = z.infer<typeof researchConversationEntrySchema>
export type ResearchConversationTurn = ResearchConversationEntry & {
  messages?: ConversationMessage[]
  sources?: ResearchResult["sources"]
  savedPlan?: { id: string; title: string; description: string | null }
  prompt: string; summary: string | null; title: string | null; applied: boolean; unavailable: boolean
}

/** Retain every observed field across turns; a newer read never erases a dependency. */
export function mergeConversationDependencies(values: ResearchDependencies[]) {
  const first = values[0]
  if (!first) throw new Error("Conversation dependencies unavailable")
  const records = new Map<string, ResearchDependencies["records"][number]>()
  const views = new Map<string, NonNullable<ResearchDependencies["dataViews"]>[number]>()
  const contextParticleIds = new Set(values.flatMap(value => value.contextParticleIds ?? []))
  const nativeFileIds = new Set(values.flatMap(value => value.nativeFileIds ?? []))
  const memories = values.flatMap(value => value.personalMemory ? [value.personalMemory] : [])
  if (memories.some(value => value.organizationId !== memories[0].organizationId || value.userId !== memories[0].userId || value.revision !== memories[0].revision))
    throw new Error("Conversation memory changed")
  const sharedMemories = values.flatMap(value => value.organizationMemory ? [value.organizationMemory] : [])
  if (sharedMemories.some(value => value.organizationId !== sharedMemories[0].organizationId || value.actorId !== sharedMemories[0].actorId || value.revision !== sharedMemories[0].revision))
    throw new Error("Conversation organization memory changed")
  for (const value of values) {
    if (value.contextFingerprint !== first.contextFingerprint) throw new Error("Conversation context changed")
    for (const view of value.dataViews ?? []) {
      if (views.has(view.viewId) && views.get(view.viewId)!.fingerprint !== view.fingerprint) throw new Error("Conversation source changed")
      views.set(view.viewId, view)
    }
    for (const record of value.records) {
      const prior = records.get(record.id)
      if (prior && (prior.kind !== record.kind || prior.fingerprint !== record.fingerprint ||
        (prior.detailFingerprint && record.detailFingerprint && prior.detailFingerprint !== record.detailFingerprint))) throw new Error("Conversation source changed")
      const fields = new Map((prior?.contactFields ?? []).map(field => [field.field, field]))
      for (const field of record.contactFields ?? []) {
        if (fields.has(field.field) && fields.get(field.field)!.fingerprint !== field.fingerprint) throw new Error("Conversation contact changed")
        fields.set(field.field, field)
      }
      records.set(record.id, { ...prior, ...record, ...(fields.size ? { contactFields: [...fields.values()] } : {}) })
    }
  }
  return researchDependenciesSchema.parse({ ...first, ...(values.some(value => value.contextParticleIds !== undefined) ? { contextParticleIds: [...contextParticleIds].sort() } : {}), records: [...records.values()], ...(views.size ? { dataViews: [...views.values()] } : {}),
    ...(sharedMemories.length ? { organizationMemory: sharedMemories[0] } : {}),
    ...(memories.length ? { personalMemory: memories[0] } : {}),
    ...(nativeFileIds.size ? { nativeFileIds: [...nativeFileIds].sort() } : {}) })
}

export const chatMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), rootId: z.uuid(), revision: z.number().int().nonnegative(), title: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal("pin"), rootId: z.uuid(), revision: z.number().int().nonnegative(), pinned: z.boolean() }),
  z.object({ action: z.literal("delete"), rootId: z.uuid(), revision: z.number().int().nonnegative() }),
])
export type ChatMutation = z.infer<typeof chatMutationSchema>
