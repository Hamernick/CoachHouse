import { z } from "zod"
import { formDefinitionSchema } from "./form-schema"
export const formSourceContentSchema = z.strictObject({
  title: z.string().trim().min(1).max(240), description: z.string().max(10_000), definition: formDefinitionSchema,
})
const revision = z.string().regex(/^[a-f0-9]{64}$/)
export const formSourceSchema = formSourceContentSchema.extend({ formId: z.uuid(), revision })
export const formSourceReceiptSchema = z.strictObject({ formId: z.uuid(), operationId: z.uuid(), revision })
export const formSourceCommands = [
  z.strictObject({ action: z.literal("read_form_source"), versionId: z.uuid() }),
  z.strictObject({ action: z.literal("save_form_source"), versionId: z.uuid(), operationId: z.uuid(), expectedRevision: revision, content: formSourceContentSchema }),
] as const
export type FormSource = z.infer<typeof formSourceSchema>
export type FormSourceContent = z.infer<typeof formSourceContentSchema>
export type FormSourceCommand = z.infer<typeof formSourceCommands[number]>
