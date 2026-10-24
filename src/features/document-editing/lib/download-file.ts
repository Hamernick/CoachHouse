import { z } from "zod"
import type { DocumentSource } from "../types"
import { documentSourceSchema } from "./contracts"

/** Explicit download reuses canonical file access and short-lived signing.
 * It does not download/convert the content through a Vercel editor action. */
export async function getDocumentDownload(source: DocumentSource, signal?: AbortSignal) {
  documentSourceSchema.parse(source)
  if(source.provider!=="coach_house")throw new Error("Open the original file in Drive.")
  const query=new URLSearchParams({organizationId:source.organizationId,id:source.fileId,download:"true"})
  const timeout=AbortSignal.timeout(15000)
  const response=await fetch(`/api/account/organization-document-files?${query}`,{cache:"no-store",signal:signal?AbortSignal.any([signal,timeout]):timeout})
  if(!response.ok)throw new Error("Could not download this file.")
  const body:unknown=await response.json()
  return z.object({url:z.url().refine(url=>new URL(url).protocol==="https:")}).parse(body).url
}
