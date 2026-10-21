import { z } from "zod"
import { assertYjsUpdate, encodeRoomUpdate, ROOM_CHECKPOINT_BYTES } from "./room-contracts"
import type { DocumentUpdateBatch } from "./document-replica"

export type DocumentRecoveryState = { batch: DocumentUpdateBatch | null; tail: Uint8Array | null }
export const recoveryScopeSchema = z.object({
  actorId: z.uuid(), organizationId: z.uuid(), fileId: z.uuid(), generation: z.uuid(),
  sessionId: z.uuid(), baseRevision: z.string().min(1).max(256),
}).strict()
export type DocumentRecoveryScope = z.infer<typeof recoveryScopeSchema>
const encoded = z.string().min(1).max(2796204).regex(/^[A-Za-z0-9+/]+={0,2}$/)
const recoverySchema = z.object({
  version: z.literal(1), batch: z.object({ id: z.uuid(), payload: encoded }).strict().nullable(), tail: encoded.nullable(),
}).strict()
export function validateDocumentRecovery(value: DocumentRecoveryState) {
  if (value.batch) { z.uuid().parse(value.batch.id); assertYjsUpdate(value.batch.update, ROOM_CHECKPOINT_BYTES) }
  if (value.tail) assertYjsUpdate(value.tail, ROOM_CHECKPOINT_BYTES)
}
export function encodeDocumentRecovery(value: DocumentRecoveryState) {
  validateDocumentRecovery(value)
  return new TextEncoder().encode(JSON.stringify({ version: 1,
    batch: value.batch ? { id: value.batch.id, payload: encodeRoomUpdate(value.batch.update, ROOM_CHECKPOINT_BYTES) } : null,
    tail: value.tail ? encodeRoomUpdate(value.tail, ROOM_CHECKPOINT_BYTES) : null,
  }))
}
export function decodeDocumentRecovery(bytes: Uint8Array) {
  const value = recoverySchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
  function decode(payload: string) {
    const binary = atob(payload)
    const update = Uint8Array.from(binary, character => character.charCodeAt(0))
    assertYjsUpdate(update, ROOM_CHECKPOINT_BYTES)
    return update
  }
  return { batch: value.batch ? { id: value.batch.id, update: decode(value.batch.payload) } : null, tail: value.tail ? decode(value.tail) : null }
}
