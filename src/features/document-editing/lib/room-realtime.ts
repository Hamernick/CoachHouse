import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import type { Database } from "@/lib/supabase"
import type { DocumentSource } from "../types"
import type { DocumentRoom } from "./room-contracts"
import { roomSchema } from "./room-contracts"
import { documentSourceSchema } from "./contracts"
import type { DocumentRoomTransport } from "./room-sync"
import { readCanonicalReceipt } from "./canonical-read"
import { readDocumentRoom, readDocumentRoomTail, documentRoomError, DocumentRoomError } from "./room-client"

/** Authenticated client's current RLS protects delivered INSERTs. Do not
 * subscribe to room snapshots (up to 2MiB), compaction UPDATEs or DELETEs. */
export function createSupabaseDocumentTransport({ client, source, room, actorId, watchVersions=false }: {
  client: SupabaseClient<Database>
  source: Extract<DocumentSource, { provider: "coach_house" }>
  room: DocumentRoom
  actorId: string
  watchVersions?: boolean
}): DocumentRoomTransport {
  z.uuid().parse(actorId)
  roomSchema.parse(room); documentSourceSchema.parse(source)
  if (source.organizationId !== room.org_id || source.fileId !== room.file_id)
    throw new DocumentRoomError("access", "This room belongs to another document.")
  return {
    subscribe(handlers) {
      let closed = false
      let queued=false
      const channel = client.channel(`document:${room.id}:${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "document_collaboration_updates", filter: `room_id=eq.${room.id}` }, payload => {
          if (closed) return
          const value = payload.new
          handlers.update({ room_id: value.room_id, generation: value.generation, sequence: value.sequence,
            batch_id: value.batch_id, actor_id: value.actor_id, payload: value.payload })
        })
      if(watchVersions) channel.on("postgres_changes",{event:"INSERT",schema:"public",table:"document_file_versions",filter:`file_id=eq.${source.fileId}`},payload=>{
        if(closed || queued || payload.new.file_id!==source.fileId || payload.new.org_id!==source.organizationId || !payload.new.request_id)return
        queued=true
        queueMicrotask(()=>{queued=false;if(!closed)handlers.changed?.()})
      })
      channel.subscribe(status => {
          if (closed) return
          if (status === "SUBSCRIBED") handlers.connected()
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") handlers.offline()
        })
      const auth = client.auth.onAuthStateChange((_event, session) => {
        // Never fetch or await another auth method inside this SDK callback.
        if (!closed && session?.user.id !== actorId) handlers.locked()
      })
      return () => {
        if (closed) return
        closed = true
        auth.data.subscription.unsubscribe()
        void client.removeChannel(channel).catch(() => {})
      }
    },
    async read() {
      const current = await readDocumentRoom(client, source)
      if (!current) throw new DocumentRoomError("access", "This shared document is no longer accessible.")
      const [file, permission] = await Promise.all([
        client.from("organization_document_files").select("updated_at,deleted_at")
          .eq("id", source.fileId).eq("org_id", source.organizationId)
          .abortSignal(AbortSignal.timeout(15000)).maybeSingle(),
        client.rpc("can_edit_document_room", { p_room_id: room.id }).abortSignal(AbortSignal.timeout(15000)),
      ])
      if (file.error) throw documentRoomError(file.error)
      if (permission.error) throw documentRoomError(permission.error)
      if (!file.data || file.data.deleted_at) throw new DocumentRoomError("access", "This document was removed or its access changed.")
      if (new Date(file.data.updated_at).getTime() !== new Date(current.base_updated_at).getTime())
        throw new DocumentRoomError("conflict", "The original file changed. Preserve the shared draft before resetting its source.")
      const canonical=watchVersions ? await readCanonicalReceipt(client,current) : undefined
      return { room: current, editable: permission.data === true, ...(canonical ? {canonical} : {}) }
    },
    tail: (current, after) => readDocumentRoomTail(client, current, after),
  }
}
