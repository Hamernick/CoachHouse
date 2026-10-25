import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentSource } from "../types"
import {
  roomSchema, roomUpdateSchema, roomReceiptSchema, encodeRoomUpdate,
  decodeRoomBinary, ROOM_TAIL_PAGE, type DocumentRoom,
} from "./room-contracts"
import { z } from "zod"
import { documentSourceSchema } from "./contracts"

export class DocumentRoomError extends Error {
  constructor(public code: "access" | "conflict" | "capacity" | "unavailable" | "invalid", message: string) {
    super(message); this.name = "DocumentRoomError"
  }
}
export function documentRoomError(error: { code?: string }) {
  const code = error.code
  if (code === "42501") return new DocumentRoomError("access", "Document access changed. Your pending edits are retained.")
  if (code === "40001") return new DocumentRoomError("conflict", "The document source or session changed. Keep your draft and reload its shared state.")
  if (code === "54000") return new DocumentRoomError("capacity", "The shared recovery limit was reached. Keep your draft while the room is checkpointed.")
  if (code === "22023") return new DocumentRoomError("invalid", "This edit could not be accepted. Your pending edits are retained.")
  return new DocumentRoomError("unavailable", "Shared editing is unavailable. Your pending edits are retained.")
}
const ROOM_COLUMNS = "id,org_id,file_id,generation,base_revision,base_updated_at,checkpoint,checkpoint_sequence,last_sequence,canonical_sequence,recovery_bytes"
const UPDATE_COLUMNS = "room_id,generation,sequence,batch_id,actor_id,payload"

/** Client uses its existing JWT; file RLS governs every query and RPC. */
export async function readDocumentRoom(client: SupabaseClient<Database>, source: Extract<DocumentSource, { provider: "coach_house" }>) {
  documentSourceSchema.parse(source)
  const { data, error } = await client.from("document_collaboration_rooms")
    .select(ROOM_COLUMNS).eq("org_id", source.organizationId).eq("file_id", source.fileId)
    .abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if (error) throw documentRoomError(error)
  if (!data) return null
  const room = roomSchema.parse(data)
  if (room.org_id !== source.organizationId || room.file_id !== source.fileId)
    throw new DocumentRoomError("access", "This room belongs to another document.")
  decodeRoomBinary(room.checkpoint)
  return room
}
export async function readDocumentRoomTail(client: SupabaseClient<Database>, room: DocumentRoom, after: number) {
  roomSchema.parse(room)
  z.number().int().min(room.checkpoint_sequence).max(room.last_sequence).parse(after)
  if (after === room.last_sequence) return []
  const { data, error } = await client.from("document_collaboration_updates")
    .select(UPDATE_COLUMNS).eq("room_id", room.id).eq("generation", room.generation)
    .gt("sequence", after).lte("sequence", room.last_sequence).not("payload", "is", null)
    .order("sequence", { ascending: true }).limit(ROOM_TAIL_PAGE)
    .abortSignal(AbortSignal.timeout(15000))
  if (error) throw documentRoomError(error)
  const updates = z.array(roomUpdateSchema).max(ROOM_TAIL_PAGE).parse(data ?? [])
  for (const [index, update] of updates.entries()) {
    if (update.room_id !== room.id || update.generation !== room.generation || update.sequence !== after + index + 1)
      throw new DocumentRoomError("conflict", "The shared tail changed. Reload the checkpoint before applying further edits.")
    decodeRoomBinary(update.payload)
  }
  if (!updates.length && after < room.last_sequence)
    throw new DocumentRoomError("conflict", "The shared tail was compacted. Reload the checkpoint.")
  return updates
}
export async function appendDocumentRoomUpdate(client: SupabaseClient<Database>, room: Pick<DocumentRoom, "id" | "generation">, batch: { id: string; update: Uint8Array }) {
  z.uuid().parse(room.id); z.uuid().parse(room.generation); z.uuid().parse(batch.id)
  const encoded = encodeRoomUpdate(batch.update)
  const { data, error } = await client.rpc("append_document_room_update", {
    p_room_id: room.id, p_generation: room.generation, p_batch_id: batch.id, p_update_base64: encoded,
  }).abortSignal(AbortSignal.timeout(15000))
  if (error) throw documentRoomError(error)
  const receipt = roomReceiptSchema.parse(data)
  if (receipt.batchId !== batch.id || receipt.generation !== room.generation)
    throw new DocumentRoomError("conflict", "The save receipt belongs to another document session. Pending edits are retained.")
  return receipt
}
