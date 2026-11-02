import { z } from "zod"
import { workspacePageSnapshotSchema } from "./page-schema"

const address = { pageId: z.uuid() }
const mutation = { ...address, operationId: z.uuid() }
export const pagePermissionSchema = z.enum(["view", "edit", "manage"])
export const pageAccessCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...address, action: z.literal("read") }),
  z.strictObject({ ...address, action: z.literal("accept"), invitationId: z.uuid() }),
  z.strictObject({ ...mutation, action: z.literal("invite"), invitationId: z.uuid(),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()), permission: pagePermissionSchema }),
  z.strictObject({ ...mutation, action: z.literal("revoke"), invitationId: z.uuid() }),
  z.strictObject({ ...mutation, action: z.literal("edit"), expectedRevision: z.int().min(1).max(2147483646),
    title: z.string().trim().max(240), description: z.string().max(2000) }),
])
export const pageAccessDataSchema = z.strictObject({
  pageId: z.uuid(), permission: pagePermissionSchema, canGrantManage: z.boolean(),
  snapshot: workspacePageSnapshotSchema, revision: z.int().positive(),
  draft: z.strictObject({ title: z.string().max(240), description: z.string().max(2000) }).nullable(),
  invitations: z.array(z.strictObject({ id: z.uuid(), email: z.email(), permission: pagePermissionSchema,
    accepted: z.boolean(), revoked: z.boolean(), expiresAt: z.iso.datetime({ offset: true }) })),
  replayed: z.boolean(),
})
export type PageAccessCommand = z.infer<typeof pageAccessCommandSchema>
export type PageAccessData = z.infer<typeof pageAccessDataSchema>
