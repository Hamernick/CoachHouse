import { z } from "zod"
import { formAnswersSchema, formSubmissionSchema } from "./form-answers"
import { formSourceCommands } from "./form-source"
import { formViewerCommands } from "./form-viewer-access"
import { formReviewAccessCommands } from "./form-review-access"
import { formVersionSchema } from "./form-version"

export const formIntakeAudienceSchema = z.enum(["public", "guest"])
export const formReceiptSchema = z.strictObject({
  id: z.uuid(), versionId: z.uuid(), submittedAt: z.iso.datetime({ offset: true }),
})
export const formDeletionReceiptSchema = z.strictObject({
  id: z.uuid(), versionId: z.uuid(), operationId: z.uuid(), deletedAt: z.iso.datetime({ offset: true }),
})
export const formResponseSchema = z.strictObject({
  id: z.uuid(), versionId: z.uuid(), revision: z.int().positive(),
  submittedAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
  answers: formAnswersSchema,
})
export const formResponsePageSchema = z.strictObject({
  version: formVersionSchema, permissions: z.strictObject({ canDelete: z.boolean().default(false), canCorrect: z.boolean(), canEditDefinition: z.boolean().default(false), canManageAccess: z.boolean(), canManageInvitations: z.boolean().default(false), hasPendingInvitation: z.boolean().default(false) }), responses: z.array(formResponseSchema).max(50),
  next: z.uuid().nullable(),
})
export const formVersionListSchema = z.strictObject({
  versions: z.array(z.strictObject({ id: z.uuid(), title: z.string(), revision: z.int().positive(), createdAt: z.iso.datetime({ offset: true }) })).max(50),
  next: z.uuid().nullable(),
})
export const formRecoveryListSchema = z.strictObject({
  forms: z.array(z.strictObject({ id: z.uuid(), title: z.string(), revision: z.int().positive() })).max(50),
  next: z.uuid().nullable(),
})
export const formRecoveryReceiptSchema = z.strictObject({ formId: z.uuid(), operationId: z.uuid(), revision: z.int().positive() })
export type FormRecoveryTarget = { pageId: string; organizationId?: never; formId?: never } | { organizationId: string; formId: string; pageId?: never }
const recoveryTarget = { pageId: z.uuid().optional(), organizationId: z.uuid().optional() }
const validRecoveryTarget = (value: { pageId?: string; organizationId?: string; formId?: string }) =>
  value.pageId !== undefined ? value.organizationId === undefined : value.organizationId !== undefined && value.formId !== undefined
export const formIntakeCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("delete_response"), versionId: z.uuid(), id: z.uuid(), operationId: z.uuid(), expectedRevision: z.int().positive() }),
  ...formSourceCommands,
  ...formReviewAccessCommands,
  ...formViewerCommands,
  z.strictObject({ action: z.literal("response_forms"), versionId: z.uuid(), after: z.uuid().optional() }),
  z.strictObject({ action: z.literal("recoverable_forms"), ...recoveryTarget, formId: z.uuid().optional(), after: z.uuid().optional() }).refine(validRecoveryTarget, "Choose one recovery target"),
  z.strictObject({ action: z.literal("recover_form"), ...recoveryTarget, formId: z.uuid(), operationId: z.uuid(), expectedRevision: z.int().positive() }).refine(validRecoveryTarget, "Choose one recovery target"),
  z.strictObject({ action: z.literal("response_versions"), versionId: z.uuid(), before: z.uuid().optional() }),
  z.strictObject({ action: z.literal("versions"), pageId: z.uuid(), before: z.uuid().optional() }),
  z.strictObject({ action: z.literal("submit"), audience: formIntakeAudienceSchema, submission: formSubmissionSchema }),
  z.strictObject({ action: z.literal("responses"), versionId: z.uuid(), before: z.uuid().optional() }),
  z.strictObject({ action: z.literal("response"), versionId: z.uuid(), id: z.uuid() }),
  z.strictObject({ action: z.literal("correct"), versionId: z.uuid(), id: z.uuid(), operationId: z.uuid(),
    expectedRevision: z.int().positive(), questionId: z.uuid(), value: formAnswersSchema.element.shape.value }),
])
export type FormReceipt = z.infer<typeof formReceiptSchema>
export type FormResponse = z.infer<typeof formResponseSchema>
export type FormResponsePage = z.infer<typeof formResponsePageSchema>
export type FormIntakeCommand = z.infer<typeof formIntakeCommandSchema>
