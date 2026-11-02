import { z } from "zod"

export const pageDirectoryRequestSchema = z.strictObject({
  after: z.uuid().optional(),
})
export const pageDirectoryItemSchema = z.strictObject({
  id: z.uuid(), title: z.string().max(240), visibility: z.enum(["private", "public"]),
})
export const pageDirectorySchema = z.strictObject({
  workspaceId: z.uuid(), pages: z.array(pageDirectoryItemSchema).max(25), next: z.uuid().nullable(),
})
export type PageDirectory = z.infer<typeof pageDirectorySchema>
