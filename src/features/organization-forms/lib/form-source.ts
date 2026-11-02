import { z } from "zod"
import { formTargetFields, validFormTarget } from "./form-review-access"
import { formDefinitionSchema } from "./form-schema"
export const formSourceContentSchema = z.strictObject({
  title: z.string().trim().min(1).max(240), description: z.string().max(10_000), definition: formDefinitionSchema,
})
const revision = z.string().regex(/^[a-f0-9]{64}$/)
export const formSourceSchema = formSourceContentSchema.extend({ formId: z.uuid(), revision })
export const formSourceReceiptSchema = z.strictObject({ formId: z.uuid(), operationId: z.uuid(), revision })
export const formSourceEntrySchema = z.strictObject({ formId: z.uuid(), title: z.string().max(240), canManageInvitations: z.boolean() })
export const formSourceDirectorySchema = z.strictObject({ forms: z.array(z.strictObject({ formId: z.uuid(), title: z.string().max(240) })).max(50), next: z.uuid().nullable() })
export const formSourceCommands = [
  z.strictObject({ action: z.literal("form_source_entry"), organizationId: z.uuid(), formId: z.uuid() }),
  z.strictObject({ action: z.literal("form_source_directory"), organizationId: z.uuid(), formId: z.uuid(), after: z.uuid().optional() }),
  z.strictObject({ action: z.literal("read_form_source"), ...formTargetFields }).refine(validFormTarget, "Choose one form target"),
  z.strictObject({ action: z.literal("save_form_source"), ...formTargetFields, operationId: z.uuid(), expectedRevision: revision, content: formSourceContentSchema }).refine(validFormTarget, "Choose one form target"),
] as const
export type FormSource = z.infer<typeof formSourceSchema>
export type FormSourceContent = z.infer<typeof formSourceContentSchema>
export type FormSourceCommand = z.infer<typeof formSourceCommands[number]>
