import "server-only"
import { NATIVE_DOCUMENT_READER_CHARACTERS } from "@/lib/workspace/research-source-schema"
import { createHash } from "node:crypto"
import { readKnowledgeTableMetadata } from "./knowledge-table-analysis"
import { assertPrivateOrganizationReadWindow } from "@/lib/organization/private-storage-link"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { KnowledgeChangedError } from "./knowledge-failure"
import type { KnowledgeAvailability } from "../lib/knowledge-availability"
import { resolveOrganizationDocumentStorageAccess } from "@/lib/organization/document-storage-access"
import { filterDocumentFileAudience } from "@/lib/organization/document-file-audience"
import type { KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import { extractKnowledgeDocx, MAX_KNOWLEDGE_DOCX_BYTES } from "./knowledge-docx"

import { extractKnowledgePdf, KnowledgePdfError, MAX_KNOWLEDGE_PDF_BYTES } from "./knowledge-pdf"

type FileDetail = KnowledgeRecord & { csvBytes?: { contentHash:string; byteLength:number } }

/** Enforce actual PDF bytes while downloading, before buffering or parsing them. */
async function readPdfDownload(stream: ReadableStream<Uint8Array>, expectedBytes: number, signal: AbortSignal) {
  const reader = stream.getReader(), chunks: Buffer[] = []
  let length = 0
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener("abort", cancel, { once: true })
  try {
    signal.throwIfAborted()
    for (;;) {
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      length += value.byteLength
      if (length > MAX_KNOWLEDGE_PDF_BYTES) throw new KnowledgePdfError("limit")
      if (length > expectedBytes) throw new Error("File contents are unavailable.")
      chunks.push(Buffer.from(value))
    }
    if (length !== expectedBytes) throw new Error("File contents are unavailable.")
    return Buffer.concat(chunks, length)
  } finally {
    signal.removeEventListener("abort", cancel)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/** Preserve ordinary file text reads; calculations request complete CSV separately. */
export async function readKnowledgeFile(context:ResearchContext,record:KnowledgeRecord,cache?:Map<string,KnowledgeRecord>,signal?:AbortSignal,pdfStartPage?:number):Promise<KnowledgeRecord> {
  return readKnowledgeFileContent(context,record,cache,signal,false,pdfStartPage)
}
export async function readKnowledgeCsvFile(context:ResearchContext,record:KnowledgeRecord,signal?:AbortSignal) {
  const detail = await readKnowledgeFileContent(context,record,undefined,signal,true)
  if (!detail.csvBytes || !detail.contentAvailable || detail.contentTruncated || !detail.revision) throw Error("Complete CSV unavailable")
  return {content:detail.content,revision:detail.revision,...detail.csvBytes}
}

/** Read supported files only after explicit tool selection; never fetch arbitrary URLs. */
async function readKnowledgeFileContent(context:ResearchContext,record:KnowledgeRecord, cache?:Map<string,KnowledgeRecord>, signal?:AbortSignal, requireCsv=false,pdfStartPage?:number):Promise<FileDetail> {
  signal?.throwIfAborted()
  if(!record.id.startsWith("file:")) {
    if(pdfStartPage !== undefined) throw Error("PDF window requires a PDF file")
    if(requireCsv) throw Error("CSV requires a file reference")
    return readKnowledgeTableMetadata(context,record)
  }
  const {supabase,target}=context
  const access=await resolveOrganizationDocumentStorageAccess({supabase,orgId:target.organizationId})
  if("error" in access||!access.hasStorageAccess)throw new Error("Document access is unavailable.")
  const readFile=()=>supabase.from("organization_document_files").select("id,name,mime_type,size_bytes,storage_path,updated_at")
    .eq("org_id",target.organizationId).eq("id",record.id.slice(5)).is("document_kind",null).is("deleted_at",null).abortSignal(AbortSignal.timeout(10000)).single()
  const {data:file,error}=await readFile()
  if(error||!file||file.id!==record.id.slice(5)||!file.storage_path.startsWith(`${target.organizationId}/library/`)||file.storage_path.split("/").includes(".."))throw new Error("File is unavailable.")
  if(!(await filterDocumentFileAudience([file],context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })).length)throw new Error("File is unavailable.")
  if(file.updated_at!==record.revision)throw new KnowledgeChangedError()
  // Cache extraction only, never authority: every hit follows fresh access and
  // exact file metadata checks. Storage paths remain server-side cache keys.
  const csv=file.mime_type==="text/csv"
  if(requireCsv && !csv) throw Error("CSV format unavailable")
  if(pdfStartPage !== undefined && file.mime_type !== "application/pdf") throw Error("PDF window requires a PDF file")
  const cacheKey=JSON.stringify([file,pdfStartPage ?? 1])
  const cached=requireCsv?undefined:cache?.get(cacheKey)
  if(cached){ signal?.throwIfAborted(); return cached }
  const docx=file.mime_type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  const pdf=file.mime_type==="application/pdf"
  const limit=pdf?MAX_KNOWLEDGE_PDF_BYTES:docx?MAX_KNOWLEDGE_DOCX_BYTES:256000
  const unavailable=(reason:string,availability:KnowledgeAvailability="unavailable"):KnowledgeRecord=>({...record,availability,contentAvailable:false,contentTruncated:false,content:`${record.title}: ${reason} Do not infer its contents.`})
  if(!Number.isSafeInteger(file.size_bytes))throw new Error("File contents are unavailable.")
  if(file.size_bytes<=0)return unavailable("The file is empty.","empty")
  if(file.size_bytes>limit)return unavailable("Full-text extraction exceeds the supported byte limit.","exhausted_budget")
  if(!docx&&!pdf&&!["text/plain","text/markdown","text/csv","application/json"].includes(file.mime_type))return unavailable("Full-text extraction is unsupported for this format.","unsupported_format")
  signal?.throwIfAborted()
  await assertPrivateOrganizationReadWindow(target.organizationId)
  const downloadSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)
  const download=createSupabaseAdminClient({ actorId: context.user.id, requestTimeoutMs: 10000 }).storage.from("org-documents").download(file.storage_path,undefined,{signal:downloadSignal})
  const ordinaryData=pdf?undefined:await (async()=>{
    const {data,error:downloadError}=await download
    if(downloadError||!data||data.size>limit||data.size!==file.size_bytes)throw new Error("File contents are unavailable.")
    return data
  })()
  let pdfText: KnowledgeRecord["pdfText"]
  let content:string
  let csvBytes:FileDetail["csvBytes"]
  let fileText:KnowledgeRecord["fileText"]
  try {
    let bytes: Buffer
    if(pdf) {
      const {data,error:downloadError}=await download.asStream()
      if(downloadError||!data)throw new Error("File contents are unavailable.")
      bytes=await readPdfDownload(data,file.size_bytes,downloadSignal)
    } else bytes=Buffer.from(await ordinaryData!.arrayBuffer())
    if(requireCsv) csvBytes={contentHash:createHash("sha256").update(bytes).digest("hex"),byteLength:bytes.byteLength}
    if(pdf) {
      const extracted=await extractKnowledgePdf(bytes,signal,pdfStartPage)
      pdfText={...(extracted.startPage > 1 ? {startPage:extracted.startPage}:{}),totalPages:extracted.totalPages,pages:extracted.pages};content=extracted.content
    } else content=docx?await extractKnowledgeDocx(bytes):new TextDecoder("utf-8",{fatal:true}).decode(bytes)
    if(content.includes("\u0000"))return unavailable("This file does not contain supported text.","unsupported_format")
    if(pdf || docx || ["text/plain","text/markdown"].includes(file.mime_type)) {
      // Offsets refer to extracted UTF-16 text with CRLF/CR normalized to LF.
      // DOCX covers only parser-extracted body text, never pages or images.
      content=content.replace(/\r\n?/g,"\n")
      fileText={byteHash:createHash("sha256").update(bytes).digest("hex"),byteLength:bytes.byteLength,
        textHash:createHash("sha256").update(content).digest("hex"),totalCharacters:content.length}
    }
  }catch(error){signal?.throwIfAborted();return unavailable(error instanceof KnowledgePdfError ? error.message : "Text extraction failed or exceeded its limits.", error instanceof KnowledgePdfError ? error.reason === "limit" ? "exhausted_budget" : "unsupported_format" : "unavailable")}
  signal?.throwIfAborted()
  // Recheck deletion, permissions and revision after downloading/parsing, before returning private text.
  const [{data:current,error:currentError},currentAccess]=await Promise.all([readFile(),resolveOrganizationDocumentStorageAccess({supabase,orgId:target.organizationId})])
  if(currentError||!current||current.id!==file.id)throw new Error("File contents are unavailable.")
  if(!(await filterDocumentFileAudience([current],context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })).length)throw new Error("File contents are unavailable.")
  if("error" in currentAccess||!currentAccess.hasStorageAccess)throw new Error("Document access is unavailable.")
  if(current.updated_at!==file.updated_at||current.storage_path!==file.storage_path||current.mime_type!==file.mime_type||current.size_bytes!==file.size_bytes||(csv&&current.name!==file.name))throw new KnowledgeChangedError()
  await assertPrivateOrganizationReadWindow(target.organizationId)
  if(!content.trim())return {...unavailable("No readable text was found; images and scanned pages are not transcribed.","empty"),...(pdfText?{content:"",contentScope:"text" as const,pdfText,fileText}:{})}
  let end=fileText?NATIVE_DOCUMENT_READER_CHARACTERS:20000
  if(fileText && /[\uD800-\uDBFF]/.test(content[end-1]??""))end--
  const result:FileDetail={...record,content:requireCsv?content:content.slice(0,end),contentAvailable:true,contentTruncated:!requireCsv&&content.length>end,contentScope:docx?"document_body":"text",...(fileText?{fileText}:{}),...(pdfText?{pdfText}:{}),...(csvBytes?{csvBytes}:{})}
  signal?.throwIfAborted()
  if(!requireCsv) cache?.set(cacheKey,result)
  return result
}
