import { z } from "zod"

const capability = z.enum(["view", "edit", "manage"])
export const accessDataSchema = z.object({
  name: z.string().min(1), deleted: z.boolean(), restricted: z.boolean(), canManage: z.boolean(),
  revision: z.number().int().nonnegative().safe(),
  workspaces: z.array(z.object({
    id: z.string(), name: z.string(), revision: z.number().int().nonnegative().safe(),
    capability: capability.nullable(), canManage: z.boolean(),
  })).max(10000).optional(),
  members: z.array(z.object({ id: z.string().uuid(), name: z.string(), owner: z.boolean(), retained: z.literal("Creator").optional(), inheritedCapability: capability.nullable().optional(), capability: capability.nullable() })).max(10000),
})
export type AccessData = z.infer<typeof accessDataSchema>
export type WorkspaceAccessChange = { canvasId: string; revision: number; capability: "view" | "edit" | "manage" | null }
export type AccessChange = { workspaceChanges?: WorkspaceAccessChange[]; revision: number; members: { memberId: string; capability: "view" | "edit" | "manage" }[] }
export type AccessResult = { data: AccessData; error?: never; code?: never } | { error: string; code: "denied" | "conflict" | "unavailable" | "invalid" }
