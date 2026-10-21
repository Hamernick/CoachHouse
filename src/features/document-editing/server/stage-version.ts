import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { contentHash, readVersionContent } from "./version-reader"
import { DocumentRoomError } from "../lib/room-client"

/** Immutable Storage API upload. Verify a retry's existing object instead of
 * overwriting it. No direct storage.objects writes or fabricated success. */
export async function stageVersionObject(client: SupabaseClient<Database>, orgId: string, path: string, content: string) {
  if(!path.startsWith(`${orgId}/library/versions/`) || path.split("/").includes(".."))
    throw new DocumentRoomError("access","This stage is outside the document library.")
  const bytes=new TextEncoder().encode(content)
  const hash=contentHash(content)
  const uploaded=await client.storage.from("org-documents").upload(path,bytes,{contentType:"text/markdown",upsert:false,cacheControl:"0"})
  if(uploaded.error) {
    if(String(uploaded.error.statusCode)!=="409")
      throw new DocumentRoomError("unavailable","Could not stage this Save. Retry the same request; the original is unchanged.")
    await readVersionContent(client,{storage_path:path,org_id:orgId,size_bytes:bytes.byteLength,content_hash:hash})
  }
  return {hash,size:bytes.byteLength}
}
