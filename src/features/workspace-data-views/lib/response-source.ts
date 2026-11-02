import { formResponseSchema, formVersionSchema, formAnswersSchema } from "@/features/organization-forms"
import { z } from "zod"

export const responseViewDirectoryCommandSchema = z.strictObject({ action: z.literal("response_views"), versionId: z.uuid() })
export const responseViewEditCommandSchema = z.strictObject({
  action: z.literal("edit_response_cell"), organizationId: z.uuid(), viewId: z.uuid(), requestId: z.uuid(),
  rowId: z.uuid(), revision: z.int().positive(), questionId: z.uuid(), value: formAnswersSchema.element.shape.value,
})
export const responseViewSourceSchema = z.strictObject({ kind: z.literal("responses"), versionId: z.uuid() })
export const responseViewPayloadSchema = z.strictObject({ version: formVersionSchema, responses: z.array(formResponseSchema).max(25) })
export const responseViewDirectorySchema = z.strictObject({
  organizationId: z.uuid(), versionId: z.uuid(), title: z.string(), canCreate: z.boolean(),
  views: z.array(z.strictObject({ id: z.uuid(), name: z.string() })).max(50),
})
export const responseQuestionKey = (id: string) => `q_${id.replaceAll("-", "")}`
