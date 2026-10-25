import { z } from "zod"

export const WORKSPACE_PAGE_PARTICLE_LIMIT = 50
/** Portable draft contract: safe in both client editors and server validators. */
export const workspacePageDraftSchema = z.strictObject({
  title: z.string().trim().max(240),
  description: z.string().max(2000),
  particleIds: z.array(z.uuid()).min(1).max(WORKSPACE_PAGE_PARTICLE_LIMIT)
    .refine((ids) => new Set(ids).size === ids.length, "Select each Particle once."),
})
