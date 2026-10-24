import { z } from "zod"

export const FORM_QUESTION_TYPES = [
  "text",
  "paragraph",
  "email",
  "number",
  "single_choice",
  "multiple_choice",
] as const
export const FORM_QUESTION_LABELS = {
  text: "Short answer",
  paragraph: "Long answer",
  email: "Email",
  number: "Number",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
} as const
export const formQuestionTypeSchema = z.enum(FORM_QUESTION_TYPES)
const common = {
  id: z.uuid(),
  label: z.string().max(240),
  required: z.boolean(),
}
export const formQuestionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...common,
    type: z.enum(["text", "paragraph", "email", "number"]),
  }),
  z.strictObject({
    ...common,
    type: z.enum(["single_choice", "multiple_choice"]),
    options: z.array(z.string().max(240)).max(50),
  }),
])
/** Drafts may be incomplete. Publishing must pass publishedFormDefinitionSchema. */
export const formDefinitionSchema = z
  .strictObject({
    questions: z.array(formQuestionSchema).max(50),
  })
  .refine(
    (value) =>
      new Set(value.questions.map((q) => q.id)).size === value.questions.length,
    "Question IDs must be unique."
  )
export const publishedFormDefinitionSchema = formDefinitionSchema.superRefine(
  (value, context) => {
    if (!value.questions.length)
      context.addIssue({
        code: "custom",
        message: "Add at least one question.",
        path: ["questions"],
      })
    value.questions.forEach((q, index) => {
      if (!q.label.trim())
        context.addIssue({
          code: "custom",
          message: "Name this question.",
          path: ["questions", index, "label"],
        })
      if ("options" in q) {
        const unique = new Set(
          q.options.map((option) => option.trim().toLowerCase()).filter(Boolean)
        )
        if (unique.size < 2 || unique.size !== q.options.length)
          context.addIssue({
            code: "custom",
            message: "Add at least two distinct, nonempty options.",
            path: ["questions", index, "options"],
          })
      }
    })
  }
)
