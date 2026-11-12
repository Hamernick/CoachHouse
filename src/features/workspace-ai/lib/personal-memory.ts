import { z } from "zod"

export const personalMemoryEntrySchema = z.strictObject({
  id: z.uuid(), value: z.string().trim().min(1).max(500), revision: z.number().int().positive(),
  createdAt: z.string(), updatedAt: z.string(),
})
export const personalMemorySchema = z.strictObject({
  version: z.literal(1), organizationId: z.uuid(), userId: z.uuid(),
  enabled: z.boolean(), revision: z.number().int().nonnegative(), updatedAt: z.string().nullable(),
  basis: z.literal("user_authored"), retention: z.literal("until_deleted"),
  entries: z.array(personalMemoryEntrySchema).max(20),
})
export const personalMemoryDependencySchema = z.strictObject({
  organizationId: z.uuid(), userId: z.uuid(), revision: z.number().int().positive(),
})
const revision = { organizationId: z.uuid(), revision: z.number().int().nonnegative() }
export const personalMemoryMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...revision, action: z.literal("enable"), enabled: z.boolean() }),
  z.strictObject({ ...revision, action: z.literal("save"), id: z.uuid(), value: z.string().trim().min(1).max(500) }),
  z.strictObject({ ...revision, action: z.literal("delete"), id: z.uuid() }),
  z.strictObject({ ...revision, action: z.literal("clear") }),
])
export type PersonalMemory = z.infer<typeof personalMemorySchema>
export type PersonalMemoryMutation = z.infer<typeof personalMemoryMutationSchema>
export type PersonalMemoryDependency = z.infer<typeof personalMemoryDependencySchema>

export const organizationMemorySchema = personalMemorySchema.omit({ userId: true, basis: true }).extend({
  scope: z.literal("organization"), actorId: z.uuid(), canManage: z.boolean(),
  basis: z.literal("organization_authored"),
  entries: z.array(personalMemoryEntrySchema.extend({ createdBy: z.uuid(), updatedBy: z.uuid() })).max(20),
})
export const organizationMemoryDependencySchema = personalMemoryDependencySchema.omit({ userId: true }).extend({ actorId: z.uuid() })
export type OrganizationMemory = z.infer<typeof organizationMemorySchema>
export type OrganizationMemoryDependency = z.infer<typeof organizationMemoryDependencySchema>
export type MemoryScope = "personal" | "organization"
export type WorkspaceMemory = PersonalMemory | OrganizationMemory
