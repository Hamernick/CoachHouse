import "server-only"
import { resolveOrganizationDocumentStorageAccess } from "@/lib/organization/document-storage-access"
import type { KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"

/** Read supported text files only after explicit tool selection; never fetch arbitrary URLs. */
export async function readKnowledgeFile(context:ResearchContext,record:KnowledgeRecord):Promise<KnowledgeRecord> {
  if(!record.id.startsWith("file:"))return record
  const {supabase,target}=context
  const access=await resolveOrganizationDocumentStorageAccess({supabase,orgId:target.organizationId})
  if("error" in access||!access.hasStorageAccess)throw new Error("Document access is unavailable.")
  const {data:file,error}=await supabase.from("organization_document_files").select("id,name,mime_type,size_bytes,storage_path,updated_at")
    .eq("org_id",target.organizationId).eq("id",record.id.slice(5)).is("document_kind",null).is("deleted_at",null).abortSignal(AbortSignal.timeout(10000)).single()
  if(error||!file||!file.storage_path.startsWith(`${target.organizationId}/library/`)||file.storage_path.split("/").includes(".."))throw new Error("File is unavailable.")
  if(file.updated_at!==record.revision)throw new Error("File changed. Search again to use its current revision.")
  if(file.size_bytes>256000||!(["text/plain","text/markdown","text/csv","application/json"].includes(file.mime_type)))return {...record,contentAvailable:false,content:`${record.content} Full-text extraction is unavailable for this format or size; do not infer its contents.`}
  const {data,error:downloadError}=await supabase.storage.from("org-documents").download(file.storage_path)
  if(downloadError||!data||data.size>256000)throw new Error("File contents are unavailable.")
  const content=(await data.text()).slice(0,20000)
  return {...record,content,contentAvailable:true}
}
