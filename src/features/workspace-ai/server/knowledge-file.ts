import "server-only"
import { resolveOrganizationDocumentStorageAccess } from "@/lib/organization/document-storage-access"
import type { KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import { extractKnowledgeDocx, MAX_KNOWLEDGE_DOCX_BYTES } from "./knowledge-docx"

/** Read supported files only after explicit tool selection; never fetch arbitrary URLs. */
export async function readKnowledgeFile(context:ResearchContext,record:KnowledgeRecord):Promise<KnowledgeRecord> {
  if(!record.id.startsWith("file:"))return record
  const {supabase,target}=context
  const access=await resolveOrganizationDocumentStorageAccess({supabase,orgId:target.organizationId})
  if("error" in access||!access.hasStorageAccess)throw new Error("Document access is unavailable.")
  const readFile=()=>supabase.from("organization_document_files").select("id,name,mime_type,size_bytes,storage_path,updated_at")
    .eq("org_id",target.organizationId).eq("id",record.id.slice(5)).is("document_kind",null).is("deleted_at",null).abortSignal(AbortSignal.timeout(10000)).single()
  const {data:file,error}=await readFile()
  if(error||!file||!file.storage_path.startsWith(`${target.organizationId}/library/`)||file.storage_path.split("/").includes(".."))throw new Error("File is unavailable.")
  if(file.updated_at!==record.revision)throw new Error("File changed. Search again to use its current revision.")
  const docx=file.mime_type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  const limit=docx?MAX_KNOWLEDGE_DOCX_BYTES:256000
  const unavailable=(reason:string):KnowledgeRecord=>({...record,contentAvailable:false,contentTruncated:false,content:`${record.title}: ${reason} Do not infer its contents.`})
  if(file.size_bytes<=0||file.size_bytes>limit||(!docx&&!["text/plain","text/markdown","text/csv","application/json"].includes(file.mime_type)))return unavailable("Full-text extraction is unavailable for this format or size.")
  const {data,error:downloadError}=await supabase.storage.from("org-documents").download(file.storage_path,undefined,{signal:AbortSignal.timeout(10000)})
  if(downloadError||!data||data.size>limit||data.size!==file.size_bytes)throw new Error("File contents are unavailable.")
  let content:string
  try {
    const bytes=await data.arrayBuffer()
    content=docx?await extractKnowledgeDocx(Buffer.from(bytes)):new TextDecoder("utf-8",{fatal:true}).decode(bytes)
    if(content.includes("\u0000"))return unavailable("This file does not contain supported text.")
  }catch{return unavailable("Text extraction failed or exceeded its limits.")}
  // Recheck deletion, permissions and revision after downloading/parsing, before returning private text.
  const [{data:current,error:currentError},currentAccess]=await Promise.all([readFile(),resolveOrganizationDocumentStorageAccess({supabase,orgId:target.organizationId})])
  if(currentError||!current||current.updated_at!==file.updated_at||current.storage_path!==file.storage_path||current.mime_type!==file.mime_type||current.size_bytes!==file.size_bytes)throw new Error("File changed. Search again to use its current revision.")
  if("error" in currentAccess||!currentAccess.hasStorageAccess)throw new Error("Document access is unavailable.")
  if(!content.trim())return unavailable("No readable text was found; images and scanned pages are not transcribed.")
  return {...record,content:content.slice(0,20000),contentAvailable:true,contentTruncated:content.length>20000,contentScope:docx?"document_body":"text"}
}
