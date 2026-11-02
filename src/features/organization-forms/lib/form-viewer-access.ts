import { z } from "zod"
export const responsePermissionSchema = z.enum(["view", "correct", "edit", "manage"])
const address = { versionId: z.uuid() }
const operation = { ...address, operationId: z.uuid(), expectedRevision: z.int().positive() }
export const formViewerCommands = [
  z.strictObject({ action: z.literal("viewer_invitations"), ...address }),
  z.strictObject({ action: z.literal("viewer_offer"), ...address }),
  z.strictObject({ action: z.literal("accept_viewer"), ...address, invitationId: z.uuid() }),
  z.strictObject({ action: z.literal("invite_viewer"), ...operation, email: z.email().max(320), responsePermission: responsePermissionSchema.optional() }),
  z.strictObject({ action: z.literal("revoke_viewer"), ...operation, invitationId: z.uuid() }),
] as const
export const formViewerListSchema = z.strictObject({
  formId: z.uuid(), revision: z.int().positive(), canGrantManage: z.boolean().default(false), invitations: z.array(z.strictObject({
    id: z.uuid(), email: z.string().max(320), accepted: z.boolean(), expiresAt: z.iso.datetime({ offset: true }), responsePermission: responsePermissionSchema.default("view"),
  })).max(50),
})
export const formViewerOfferSchema = z.strictObject({
  invitationId: z.uuid(), versionId: z.uuid(), title: z.string().max(240), accepted: z.boolean(), expiresAt: z.iso.datetime({ offset: true }), responsePermission: responsePermissionSchema.default("view"),
})
export const formViewerAcceptanceSchema = z.strictObject({ invitationId: z.uuid(), versionId: z.uuid(), accepted: z.literal(true) })
export const formViewerReceiptSchema = z.strictObject({ formId: z.uuid(), invitationId: z.uuid(), operationId: z.uuid(), revision: z.int().positive() })
export type FormViewerCommand = z.infer<typeof formViewerCommands[number]>
