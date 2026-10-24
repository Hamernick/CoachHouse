import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentRoom } from "./room-contracts"
import { canonicalReceiptSchema } from "./canonical-advance"
import { documentRoomError, DocumentRoomError } from "./room-client"

/** Tiny authoritative receipt only; never download source bytes or room history
 * to decide whether a saved revision can advance the same generation. */
export async function readCanonicalReceipt(client:SupabaseClient<Database>,room:DocumentRoom) {
  const {data,error}=await client.from("document_file_versions")
    .select("id,org_id,file_id,generation,revision,source_updated_at,sequence")
    .eq("org_id",room.org_id).eq("file_id",room.file_id).eq("generation",room.generation)
    .eq("revision",room.base_revision).eq("sequence",room.canonical_sequence)
    .abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if(error)throw documentRoomError(error)
  if(!data)return undefined
  const receipt=canonicalReceiptSchema.parse({versionId:data.id,orgId:data.org_id,fileId:data.file_id,
    generation:data.generation,revision:data.revision,updatedAt:data.source_updated_at,sequence:data.sequence})
  if(receipt.orgId!==room.org_id || receipt.fileId!==room.file_id || receipt.generation!==room.generation || receipt.revision!==room.base_revision || receipt.sequence!==room.canonical_sequence)
    throw new DocumentRoomError("conflict","The saved version belongs to another source or prefix.")
  if(new Date(receipt.updatedAt).getTime()!==new Date(room.base_updated_at).getTime())
    throw new DocumentRoomError("conflict","The saved version timestamp does not match the shared source.")
  return receipt
}
