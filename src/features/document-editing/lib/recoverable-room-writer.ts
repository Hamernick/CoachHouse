import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { appendDocumentRoomUpdate } from "./room-client"
import type { DocumentRoom } from "./room-contracts"
import type { createDocumentReplica } from "./document-replica"
import type { createDocumentRecoveryJournal } from "./recovery-journal"
import { createDocumentRoomWriter, type RoomWriteState } from "./room-writer"

/** The editor uses this writer: persist the immutable retry ID and native
 * bytes locally before sending them. Failed storage never sends a batch. */
export function createRecoverableDocumentRoomWriter({ client, room, replica, recovery, onState }: {
  client: SupabaseClient<Database>
  room: DocumentRoom
  replica: ReturnType<typeof createDocumentReplica>
  recovery: Pick<ReturnType<typeof createDocumentRecoveryJournal>, "flush">
  onState: (state: RoomWriteState, error?: unknown) => void
}) {
  return createDocumentRoomWriter({ replica, room, onState,
    commit: async batch => {
      await recovery.flush()
      return appendDocumentRoomUpdate(client, room, batch)
    },
  })
}
