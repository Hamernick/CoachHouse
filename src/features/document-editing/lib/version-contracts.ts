import { z } from "zod"
import { documentSourceSchema } from "./contracts"

const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const documentCommitSchema = z.object({
  source: documentSourceSchema,
  requestId: z.uuid(), generation: z.uuid(),
  expectedRevision: z.string().min(1).max(256),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  sequence,
  restoreVersionId: z.uuid().optional(),
}).strict()
export type DocumentCommitInput = z.infer<typeof documentCommitSchema>
export const documentVersionSchema = z.object({
  id: z.uuid(), file_id: z.uuid(), org_id: z.uuid(),
  request_id: z.uuid().nullable(), actor_id: z.uuid(),
  storage_path: z.string().min(1).max(2048), name: z.string().min(1).max(1024),
  mime_type: z.string().min(1).max(255), size_bytes: z.number().int().min(0).max(1048576),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/), revision: z.string().min(1).max(256),
  source_updated_at: z.iso.datetime({ offset: true }),
  generation: z.uuid(), sequence, restored_from: z.uuid().nullable(),
  request_context: z.object({
    generation: z.uuid(), expectedRevision: z.string().min(1).max(256),
    expectedUpdatedAt: z.iso.datetime({ offset: true }), sequence,
    restoreVersionId: z.uuid().nullable(),
  }).strict().nullable(),
  created_at: z.iso.datetime({ offset: true }),
}).strict()
export type DocumentVersion = z.infer<typeof documentVersionSchema>
export const documentCommitReceiptSchema = z.object({
  versionId: z.uuid(), requestId: z.uuid(), fileId: z.uuid(),
  generation: z.uuid(), revision: z.string().min(1).max(256),
  updatedAt: z.iso.datetime({ offset: true }), sequence,
  restoredFrom: z.uuid().nullable(),
}).strict()
export type DocumentCommitReceipt = z.infer<typeof documentCommitReceiptSchema>

export function receiptFromVersion(version: DocumentVersion, input: DocumentCommitInput, actorId: string) {
  const context = version.request_context
  if (input.source.provider !== "coach_house" || version.org_id !== input.source.organizationId ||
    version.file_id !== input.source.fileId || version.actor_id !== actorId || version.request_id !== input.requestId ||
    !context || context.generation !== input.generation || context.expectedRevision !== input.expectedRevision ||
    new Date(context.expectedUpdatedAt).getTime() !== new Date(input.expectedUpdatedAt).getTime() ||
    context.sequence !== input.sequence || context.restoreVersionId !== (input.restoreVersionId ?? null))
    throw new Error("This Save receipt belongs to a different request. Keep the draft and retry its original request.")
  return documentCommitReceiptSchema.parse({versionId:version.id,requestId:version.request_id,fileId:version.file_id,
    generation:version.generation,revision:version.revision,updatedAt:version.source_updated_at,
    sequence:version.sequence,restoredFrom:version.restored_from})
}
