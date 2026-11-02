import { z } from "zod"
export const formReviewAccessSchema = z.strictObject({
  formId: z.uuid(), revision: z.int().positive(), canGrantManage: z.boolean(),
  reviewers: z.array(z.strictObject({ id: z.uuid(), email: z.string().max(320), role: z.enum(["view", "edit", "manage"]) })).max(50),
})
export const formSourceAccessSchema = z.strictObject({ formId: z.uuid(), canEdit: z.boolean(), canManageAccess: z.boolean() })
export type FormAccessTarget = { versionId: string; organizationId?: never; formId?: never } | { organizationId: string; formId: string; versionId?: never }
const targetFields = { versionId: z.uuid().optional(), organizationId: z.uuid().optional(), formId: z.uuid().optional() }
const validTarget = (value: { versionId?: string; organizationId?: string; formId?: string }) =>
  value.versionId !== undefined ? value.organizationId === undefined && value.formId === undefined : value.organizationId !== undefined && value.formId !== undefined
export const formReviewAccessCommands = [
  z.strictObject({ action: z.literal("source_access"), organizationId: z.uuid(), formId: z.uuid() }),
  z.strictObject({ action: z.literal("review_access"), ...targetFields }).refine(validTarget, "Choose one form target"),
  z.strictObject({ action: z.literal("grant_reviewer"), ...targetFields, email: z.email().max(320), role: z.enum(["view", "edit", "manage"]).optional(), operationId: z.uuid(), expectedRevision: z.int().positive() }).refine(validTarget, "Choose one form target"),
  z.strictObject({ action: z.literal("revoke_reviewer"), ...targetFields, memberId: z.uuid(), operationId: z.uuid(), expectedRevision: z.int().positive() }).refine(validTarget, "Choose one form target"),
] as const
