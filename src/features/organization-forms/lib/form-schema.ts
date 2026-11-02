import { z } from "zod"
import { formGridFields, formGridSnapshotFields } from "./form-grid-schema"

export const FORM_QUESTION_TYPES = [
  "text",
  "paragraph",
  "email",
  "number",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "date",
  "time",
  "linear_scale",
  "rating",
  "multiple_choice_grid",
  "checkbox_grid",
] as const
export const FORM_QUESTION_LABELS = {
  text: "Short answer",
  paragraph: "Long answer",
  email: "Email",
  number: "Number",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
  date: "Date",
  time: "Time",
  linear_scale: "Linear scale",
  rating: "Rating",
  multiple_choice_grid: "Multiple choice grid",
  checkbox_grid: "Checkbox grid",
} as const
export const formQuestionTypeSchema = z.enum(FORM_QUESTION_TYPES)
const common = {
  id: z.uuid(),
  label: z.string().max(240),
  required: z.boolean(),
}
export const formScaleFields = {
  max: z.number().int().min(2).max(10),
  lowerLabel: z.string().max(120),
  upperLabel: z.string().max(120),
}
export const formQuestionSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...common, ...formGridFields, type: z.enum(["multiple_choice_grid", "checkbox_grid"]) }),
  z.strictObject({ ...common, ...formScaleFields, type: z.literal("linear_scale"), min: z.union([z.literal(0), z.literal(1)]) }),
  z.strictObject({ ...common, ...formScaleFields, type: z.literal("rating"), min: z.literal(1) }),
  z.strictObject({
    ...common,
    type: z.enum(["text", "paragraph", "email", "number", "date", "time"]),
  }),
  z.strictObject({
    ...common,
    type: z.enum(["single_choice", "multiple_choice"]),
    allowOther: z.boolean().optional(),
    options: z.array(z.string().max(240)).max(50),
  }),
  z.strictObject({ ...common, type: z.literal("dropdown"), options: z.array(z.string().max(240)).max(50) }),
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
      if ("rows" in q) {
        for (const key of ["rows", "columns"] as const) {
          if (!formGridSnapshotFields[key].safeParse(q[key]).success)
            context.addIssue({ code: "custom", message: key === "rows" ? "Add distinct, named rows." : "Add at least two distinct, named columns.", path: ["questions", index, key] })
        }
      }
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
