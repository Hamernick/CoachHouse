import { z } from "zod"
import { formDefinitionSchema, formQuestionSchema } from "@/features/organization-forms"

/** Reuse the canonical draft schema. The provider must spell out allowOther;
 * no repaired, unknown or silently removed question fields are accepted. */
export const providerResearchFormSchema = formDefinitionSchema.safeExtend({
  questions: z.array(z.discriminatedUnion("type", [
    formQuestionSchema.options[0], formQuestionSchema.options[1], formQuestionSchema.options[2],
    formQuestionSchema.options[3], formQuestionSchema.options[4].extend({ allowOther: z.boolean() }),
    formQuestionSchema.options[5],
  ])).max(50),
})

export function validateResearchForms(items: readonly { kind: string; form?: z.infer<typeof formDefinitionSchema> | null }[], allowIncomplete = false) {
  for (const item of items) {
    if (item.kind === "form") {
      if (!item.form || (!allowIncomplete && !item.form.questions.length)) throw new Error("A form draft requires actual questions.")
      formDefinitionSchema.parse(item.form)
    } else if (item.form !== undefined && item.form !== null) throw new Error("Only a form item can contain a form draft.")
  }
}
