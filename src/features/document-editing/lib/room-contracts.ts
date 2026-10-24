import { z } from "zod"
import * as Y from "yjs"

export const ROOM_CHECKPOINT_BYTES = 2 * 1024 * 1024
export const ROOM_UPDATE_BYTES = 128 * 1024
export const ROOM_TAIL_PAGE = 100
export const ROOM_FLUSH_DELAY_MS = 750
export const ROOM_FLUSH_MAX_WAIT_MS = 2000
const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const binary = (max: number) => z.string().regex(/^\\x(?:[0-9a-f]{2})+$/i).max(2 + max * 2)
export const roomSchema = z.object({
  id: z.uuid(), org_id: z.uuid(), file_id: z.uuid(), generation: z.uuid(),
  base_revision: z.string().min(1).max(256), base_updated_at: z.string(),
  checkpoint: binary(ROOM_CHECKPOINT_BYTES), checkpoint_sequence: sequence,
  last_sequence: sequence, canonical_sequence: sequence, recovery_bytes: z.number().int().min(0).max(8 * 1024 * 1024),
}).strict().refine((room) => room.checkpoint_sequence <= room.last_sequence && room.canonical_sequence <= room.last_sequence)
export const roomUpdateSchema = z.object({
  room_id: z.uuid(), generation: z.uuid(), sequence: sequence.refine((value) => value > 0),
  batch_id: z.uuid(), actor_id: z.uuid(), payload: binary(ROOM_UPDATE_BYTES),
}).strict()
export const roomReceiptSchema = z.object({
  batchId: z.uuid(), generation: z.uuid(), sequence: sequence.refine((value) => value > 0),
}).strict()
export type DocumentRoom = z.infer<typeof roomSchema>
export type DocumentRoomUpdate = z.infer<typeof roomUpdateSchema>
export type DocumentRoomReceipt = z.infer<typeof roomReceiptSchema>

export function decodeRoomBinary(value: string, limit = ROOM_CHECKPOINT_BYTES) {
  binary(limit).parse(value)
  const bytes = new Uint8Array((value.length - 2) / 2)
  for (let index = 0; index < bytes.length; index++)
    bytes[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16)
  assertYjsUpdate(bytes, limit)
  return bytes
}
export function assertYjsUpdate(update: Uint8Array, limit = ROOM_UPDATE_BYTES) {
  if (!update.byteLength || update.byteLength > limit)
    throw new Error("This edit exceeds the shared update budget. Your pending edits are retained.")
  try { Y.decodeUpdate(update) }
  catch { throw new Error("This shared document update is invalid. Keep your draft and recover the session.") }
}
export function encodeRoomUpdate(update: Uint8Array, limit = ROOM_UPDATE_BYTES) {
  assertYjsUpdate(update, limit)
  let binary = ""
  for (let offset = 0; offset < update.length; offset += 8192)
    binary += String.fromCharCode(...update.subarray(offset, offset + 8192))
  return btoa(binary)
}
