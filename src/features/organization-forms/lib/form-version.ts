import { z } from "zod"
import { publishedFormDefinitionSchema } from "./form-schema"
import type { FormDefinition } from "../types"

const question = {
  id: z.uuid(),
  label: z.string().trim().min(1).max(240),
  required: z.boolean(),
}
const option = z
  .strictObject({
    id: z.string().regex(/^option-([1-9]|[1-4][0-9]|50)$/),
    label: z.string().trim().min(1).max(240),
  })
  .readonly()
export const formSnapshotQuestionSchema = z
  .discriminatedUnion("type", [
    z.strictObject({
      ...question,
      type: z.enum(["text", "paragraph", "email", "number"]),
    }),
    z.strictObject({
      ...question,
      type: z.enum(["single_choice", "multiple_choice"]),
      options: z.array(option).min(2).max(50).readonly(),
    }),
  ])
  .readonly()

/** Public-safe definition only. Option identity is scoped to version + question. */
export const formSnapshotSchema = z
  .strictObject({
    questions: z.array(formSnapshotQuestionSchema).min(1).max(50).readonly(),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.questions.map((item) => item.id)).size !==
      value.questions.length
    )
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Question IDs must be unique.",
      })
    value.questions.forEach((item, index) => {
      if (!("options" in item)) return
      const ids = new Set(item.options.map((entry) => entry.id))
      const labels = new Set(
        item.options.map((entry) => entry.label.toLowerCase())
      )
      if (
        ids.size !== item.options.length ||
        labels.size !== item.options.length
      )
        context.addIssue({
          code: "custom",
          path: ["questions", index, "options"],
          message: "Choice IDs and labels must be unique.",
        })
    })
  })
  .readonly()

export const formVersionSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    formId: z.uuid(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    title: z.string().trim().min(1).max(240),
    description: z.string().max(10_000),
    definition: formSnapshotSchema,
  })
  .readonly()

/** Detached, deeply readonly snapshot; later draft changes cannot reinterpret it. */
export function createFormSnapshot(definition: FormDefinition) {
  const draft = publishedFormDefinitionSchema.parse(definition)
  return formSnapshotSchema.parse({
    questions: draft.questions.map((item) =>
      "options" in item
        ? {
            ...item,
            options: item.options.map((label, index) => ({
              id: `option-${index + 1}`,
              label,
            })),
          }
        : item
    ),
  })
}

/** The future authorized publisher assigns IDs/revisions and stores once atomically. */
export function createFormVersion(input: {
  id: string
  formId: string
  revision: number
  title: string
  description: string
  definition: FormDefinition
}) {
  return formVersionSchema.parse({
    ...input,
    schemaVersion: 1,
    definition: createFormSnapshot(input.definition),
  })
}

export type FormSnapshot = z.infer<typeof formSnapshotSchema>
export type FormSnapshotQuestion = z.infer<typeof formSnapshotQuestionSchema>
export type FormVersion = z.infer<typeof formVersionSchema>
