import { z } from "zod"
export const folderAccessTargetSchema = z.object({
  projectId: z.string().uuid(), folderId: z.string().uuid(), actionScope: z.enum(["workspace", "platform"]),
}).strict()
export const folderAccessChangeSchema = folderAccessTargetSchema.extend({
  workspaceChanges: z.array(z.object({
    canvasId: z.union([z.literal("default"), z.string().uuid()]),
    revision: z.number().int().nonnegative().safe(), capability: z.enum(["view", "edit", "manage"]).nullable(),
  }).strict()).max(50).refine(rows => new Set(rows.map(row => row.canvasId)).size === rows.length, "Choose each workspace once.").optional(),
  revision: z.number().int().nonnegative().safe(),
  members: z.array(z.object({ memberId: z.string().uuid(), capability: z.enum(["view", "edit", "manage"]) }).strict()).max(100)
    .refine(rows => new Set(rows.map(row => row.memberId)).size === rows.length, "Choose each person once."),
}).strict()
export type FolderAccessTarget = z.infer<typeof folderAccessTargetSchema>
export type FolderAccessChange = z.infer<typeof folderAccessChangeSchema>
