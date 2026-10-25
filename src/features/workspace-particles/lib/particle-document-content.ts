import { z } from "zod"
export const MAX_PREVIEW_CHARACTERS = 100_000
export const documentContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z.string().max(MAX_PREVIEW_CHARACTERS),
    truncated: z.boolean(),
  }),
  z.object({
    kind: z.literal("table"),
    rows: z.array(z.array(z.string().max(2000)).max(50)).max(1000),
    truncated: z.boolean(),
  }),
])
export type DocumentContent = z.infer<typeof documentContentSchema>
export function boundedDocumentText(text: string): DocumentContent {
  return {
    kind: "text",
    text: text.slice(0, MAX_PREVIEW_CHARACTERS),
    truncated: text.length > MAX_PREVIEW_CHARACTERS,
  }
}
