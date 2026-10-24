import { z } from "zod"
import { workspacePageDraftSchema } from "./page-schema"

const identity = {
  pageId: z.uuid(),
  expectedRevision: z.int().min(0).max(2147483646),
}
export const workspacePageReviewInputSchema = z.strictObject({
  ...identity,
  draft: workspacePageDraftSchema,
})
const request = { ...identity, operationId: z.uuid() }
export const workspacePageCommandSchema = z.discriminatedUnion("intent", [
  z.strictObject({ ...request, intent: z.literal("save_draft"), draft: workspacePageDraftSchema }),
  z.strictObject({ ...request, intent: z.literal("publish"), draft: workspacePageDraftSchema,
    reviewToken: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ ...request, intent: z.literal("make_private"), expectedRevision: z.int().min(1).max(2147483646) }),
])
export type WorkspacePageCommand = z.infer<typeof workspacePageCommandSchema>
export type WorkspacePageReviewInput = z.infer<typeof workspacePageReviewInputSchema>
