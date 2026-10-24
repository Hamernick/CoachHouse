import type { z } from "zod"
import type {
  formDefinitionSchema,
  formQuestionSchema,
  formQuestionTypeSchema,
} from "./lib/form-schema"
export type FormDefinition = z.infer<typeof formDefinitionSchema>
export type FormQuestion = z.infer<typeof formQuestionSchema>
export type FormQuestionType = z.infer<typeof formQuestionTypeSchema>
