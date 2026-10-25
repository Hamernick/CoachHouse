import "server-only"

import * as Y from "yjs"
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"
import { createMarkdownAdapter, markdownDocumentSchema } from "../lib/markdown-adapter"
import { decodeRoomBinary, encodeRoomUpdate, ROOM_CHECKPOINT_BYTES } from "../lib/room-contracts"
import { readDocumentRoom, readDocumentRoomTail, documentRoomError, DocumentRoomError } from "../lib/room-client"
import { readLocalDocument } from "./read-local-document"
import { readGenerationAnchor } from "./generation-anchor"
import { requireDocumentRoomActor } from "./room-access"
import type { DocumentSource } from "../types"

/** Only an explicit editor open may bootstrap. Existing rooms avoid downloading
 * and parsing their canonical file again. Parallel initializers share one seed. */
export async function openDocumentRoom(source: DocumentSource) {
  return openRoomForActor(await requireDocumentRoomActor(source))
}

/** One auth/file check supplies both the room and its stable recovery scope. */
export async function openDocumentEditor(source:DocumentSource) {
  const actor=await requireDocumentRoomActor(source)
  const result=await openRoomForActor(actor)
  return {...result,actorId:actor.userId,source:actor.source,
    recoveryRevision:result.room ? await readGenerationAnchor(actor.supabase,result.room) : null}
}
async function openRoomForActor(actor:Awaited<ReturnType<typeof requireDocumentRoomActor>>) {
  let room = await readDocumentRoom(actor.supabase, actor.source)
  let expectedUpdatedAt = actor.file.updated_at
  if (!room && actor.editable) {
    const snapshot = await readLocalDocument(actor.supabase, actor.source)
    expectedUpdatedAt = snapshot.updatedAt
    const content = createMarkdownAdapter().parse(snapshot.content)
    const queue = [content]
    let nodes = 0
    while (queue.length) {
      const node = queue.pop()
      if (++nodes > 5000) throw new DocumentRoomError("capacity", "This document exceeds the current shared rich-editor budget.")
      if (node?.content) queue.push(...node.content)
    }
    const seed = prosemirrorJSONToYDoc(markdownDocumentSchema(), content, "content")
    let checkpoint: string
    try { checkpoint = encodeRoomUpdate(Y.encodeStateAsUpdate(seed), ROOM_CHECKPOINT_BYTES) }
    finally { seed.destroy() }
    const admin = createSupabaseAdminClient({ actorId: actor.userId })
    const result = await admin.rpc("initialize_document_room", {
      p_file_id: actor.source.fileId, p_actor_id: actor.userId,
      p_base_revision: snapshot.revision, p_expected_updated_at: snapshot.updatedAt,
      p_checkpoint_base64: checkpoint,
    })
    if (result.error) throw documentRoomError(result.error)
    z.object({ roomId: z.uuid(), generation: z.uuid() }).strict().parse(result.data)
    room = await readDocumentRoom(actor.supabase, actor.source)
    if (!room) throw new DocumentRoomError("access", "The shared document could not be opened with your current permissions.")
  }
  if (room && new Date(room.base_updated_at).getTime() !== new Date(expectedUpdatedAt).getTime())
    throw new DocumentRoomError("conflict", "The original file changed. Preserve the shared draft before resetting its source.")
  return { room, editable: actor.editable }
}

/** Explicit/pressure-triggered maintenance, never a per-file interval. Both the
 * source access and the full recovery prefix are validated before compaction. */
export async function compactDocumentRoom(source: DocumentSource) {
  const actor = await requireDocumentRoomActor(source)
  if (!actor.editable) throw new DocumentRoomError("access", "You do not have editing access to this document.")
  const room = await readDocumentRoom(actor.supabase, actor.source)
  if (!room) throw new DocumentRoomError("unavailable", "This document session is unavailable.")
  if (new Date(room.base_updated_at).getTime() !== new Date(actor.file.updated_at).getTime())
    throw new DocumentRoomError("conflict", "The document source changed. Preserve the shared draft before checkpointing.")
  const updates: Uint8Array[] = [decodeRoomBinary(room.checkpoint)]
  let sequence = room.checkpoint_sequence
  while (sequence < room.last_sequence) {
    const page = await readDocumentRoomTail(actor.supabase, room, sequence)
    for (const update of page) updates.push(decodeRoomBinary(update.payload))
    sequence = page[page.length - 1].sequence
  }
  const document = new Y.Doc()
  let checkpoint: string
  try {
    for (const update of updates) Y.applyUpdate(document, update)
    // Materialize and GC a bounded checkpoint, not an ever-growing merged log.
    checkpoint = encodeRoomUpdate(Y.encodeStateAsUpdate(document), ROOM_CHECKPOINT_BYTES)
  } finally { document.destroy() }
  const admin = createSupabaseAdminClient({ actorId: actor.userId })
  const result = await admin.rpc("compact_document_room", {
    p_room_id: room.id, p_generation: room.generation,
    p_expected_sequence: room.last_sequence, p_checkpoint_base64: checkpoint,
  })
  if (result.error) throw documentRoomError(result.error)
  return { compacted: result.data === true }
}
