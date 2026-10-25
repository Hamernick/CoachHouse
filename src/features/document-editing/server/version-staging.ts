import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { documentRoomError, DocumentRoomError } from "../lib/room-client"

type CommitArgs=Database["public"]["Functions"]["commit_uploaded_document_version"]["Args"]
/** Register byte/hash identity and reserve bounded staging capacity before IO. */
export async function reserveVersionCommit(client: SupabaseClient<Database>, args: CommitArgs) {
  const reservation={...args}
  delete reservation.p_restore_checkpoint_base64
  const result=await client.rpc("reserve_uploaded_document_version",reservation).abortSignal(AbortSignal.timeout(15000))
  if(result.error) throw documentRoomError(result.error)
  if(typeof result.data!=="boolean") throw new DocumentRoomError("invalid","Invalid document stage receipt.")
  return result.data
}
/** A database tombstone fences every later commit for this request before
 * service-role Storage deletion. Unknown outcomes keep their bounded reserve. */
export async function abandonVersionStage(client: SupabaseClient<Database>, args: CommitArgs, paths: string[]) {
  const request={p_file_id:args.p_file_id,p_actor_id:args.p_actor_id,p_request_id:args.p_request_id}
  const abandoned=await client.rpc("abandon_uploaded_document_version",request).abortSignal(AbortSignal.timeout(15000))
  if(abandoned.error || abandoned.data!==true) return false
  const removed=await client.storage.from("org-documents").remove(paths)
  if(removed.error) return false
  // Failed completion retains capacity rather than permitting unbounded orphans.
  const finished=await client.rpc("finish_abandoned_document_version",request).abortSignal(AbortSignal.timeout(15000))
  return !finished.error && finished.data===true
}
