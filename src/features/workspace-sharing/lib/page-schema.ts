import { z } from "zod"
import { publicParticleContentSchema } from "@/features/workspace-particles"

import { WORKSPACE_PAGE_PARTICLE_LIMIT, workspacePageDraftSchema } from "./page-draft"
export { WORKSPACE_PAGE_PARTICLE_LIMIT, workspacePageDraftSchema } from "./page-draft"

const title = z.string().trim().max(240)
const description = z.string().max(2000)

/** Entirely allowlisted, committed content. Never embed a board or source row.
 * Brand assets require the explicit public-asset boundary before being added.
 */
export const workspacePageSnapshotSchema = z.strictObject({
  version: z.literal(1),
  brand: z.strictObject({
    name: z.string().trim().min(1).max(240),
    organizationSlug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }),
  title,
  description,
  items: z.array(publicParticleContentSchema).min(1).max(WORKSPACE_PAGE_PARTICLE_LIMIT)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length,
      "Publish each Particle once."),
})

/** Draft and snapshot may deliberately differ after a private edit. */
export const workspacePageSchema = z.strictObject({
  id: z.uuid(),
  orgId: z.uuid(),
  linkId: z.uuid(),
  revision: z.int().min(1).max(2147483647),
  draft: workspacePageDraftSchema,
  visibility: z.enum(["private", "public"]),
  publishedSnapshot: workspacePageSnapshotSchema.nullable(),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}).superRefine((page, context) => {
  if ((page.publishedSnapshot === null) !== (page.publishedAt === null)) {
    context.addIssue({ code: "custom", message: "Publication content and timestamp must agree." })
  }
  if (page.visibility === "public" && !page.publishedSnapshot) {
    context.addIssue({ code: "custom", message: "Publish saved content before sharing this page." })
  }
})
