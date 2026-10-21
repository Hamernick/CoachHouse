import { z } from "zod"
import type { DocumentRoom } from "./room-contracts"
import { DocumentRoomError } from "./room-client"

export const canonicalReceiptSchema=z.object({
  versionId:z.uuid(),orgId:z.uuid(),fileId:z.uuid(),generation:z.uuid(),
  revision:z.string().min(1).max(256),updatedAt:z.string().min(1),
  sequence:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict()
export type DocumentCanonicalReceipt=z.infer<typeof canonicalReceiptSchema>
/** Only an authenticated, RLS-read version row may authorize a source advance.
 * A changed canonical object never seeds or replaces the existing replica. */
export function validateCanonicalAdvance(previous:DocumentRoom,current:DocumentRoom,receipt?:DocumentCanonicalReceipt) {
  if(current.id!==previous.id || current.org_id!==previous.org_id || current.file_id!==previous.file_id || current.generation!==previous.generation)
    throw new DocumentRoomError("conflict","The shared document generation changed. Preserve pending edits before reopening.")
  if(current.canonical_sequence<previous.canonical_sequence || current.last_sequence<previous.last_sequence)
    throw new DocumentRoomError("conflict","The shared document sequence moved backwards.")
  const changed=current.base_revision!==previous.base_revision || current.base_updated_at!==previous.base_updated_at || current.canonical_sequence!==previous.canonical_sequence
  if(!changed)return
  const proof=canonicalReceiptSchema.safeParse(receipt)
  if(!proof.success || proof.data.orgId!==current.org_id || proof.data.fileId!==current.file_id || proof.data.generation!==current.generation ||
    proof.data.revision!==current.base_revision || proof.data.sequence!==current.canonical_sequence ||
    new Date(proof.data.updatedAt).getTime()!==new Date(current.base_updated_at).getTime())
    throw new DocumentRoomError("conflict","The canonical source changed without a verified version. Preserve the shared draft.")
}
