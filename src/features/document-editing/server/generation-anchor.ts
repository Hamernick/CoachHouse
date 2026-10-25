import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { z } from "zod"
import type { DocumentRoom } from "../lib/room-contracts"
import { documentRoomError, DocumentRoomError } from "../lib/room-client"

/** Native operations belong to a Yjs generation. Its original source revision
 * stays fixed across ordinary Saves, avoiding unnecessary recovery rewrites.
 * Restore changes generation and cannot silently replay a previous outbox. */
export async function readGenerationAnchor(client:SupabaseClient<Database>,room:DocumentRoom) {
  const {data,error}=await client.from("document_file_versions")
    .select("org_id,file_id,generation,revision,sequence")
    .eq("org_id",room.org_id).eq("file_id",room.file_id).eq("generation",room.generation).eq("sequence",0)
    .order("created_at",{ascending:true}).order("request_id",{ascending:true,nullsFirst:true}).limit(1)
    .abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if(error)throw documentRoomError(error)
  if(!data) {
    if(room.canonical_sequence>0)throw new DocumentRoomError("conflict","The shared generation has no verified recovery anchor.")
    return room.base_revision
  }
  return z.object({org_id:z.literal(room.org_id),file_id:z.literal(room.file_id),generation:z.literal(room.generation),
    sequence:z.literal(0),revision:z.string().min(1).max(256)}).strict().parse(data).revision
}
