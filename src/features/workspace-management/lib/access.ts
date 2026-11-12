import { z } from "zod"

export const workspaceAccessTargetSchema = z.object({ orgId: z.string().uuid(), canvasId: z.string().uuid().nullable() }).strict()
const capability = z.enum(["view", "edit", "manage"])
export const workspaceAccessChangeSchema = workspaceAccessTargetSchema.extend({
  revision: z.number().int().nonnegative().safe(),
  members: z.array(z.object({ memberId: z.string().uuid(), capability }).strict()).max(500)
    .refine(rows => new Set(rows.map(row => row.memberId)).size === rows.length, "Choose each person once."),
}).strict()
export { accessDataSchema as workspaceAccessDataSchema, type AccessData as WorkspaceAccessData } from "@/lib/workspace/access"
export type WorkspaceAccessTarget = z.infer<typeof workspaceAccessTargetSchema>
export type WorkspaceAccessChange = z.infer<typeof workspaceAccessChangeSchema>
