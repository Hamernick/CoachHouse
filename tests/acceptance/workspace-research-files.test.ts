import { beforeEach, describe, expect, it, vi } from "vitest"
import { PDFDocument, StandardFonts, PDFHexString, PDFName, drawObject } from "pdf-lib"
import { extractKnowledgePdf, PDF_LIMITS, MAX_KNOWLEDGE_PDF_BYTES } from "@/features/workspace-ai/server/knowledge-pdf"
import { createHash } from "node:crypto"
import { deflateRawSync, deflateSync } from "node:zlib"
import { createZipArchive } from "@/lib/files/simple-zip"
import { extractKnowledgeDocx } from "@/features/workspace-ai/server/knowledge-docx"
import { readKnowledgeFile } from "@/features/workspace-ai/server/knowledge-file"
import { createKnowledgeTools } from "@/features/workspace-ai/server/knowledge-tools"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { UploadedKnowledgePage } from "@/features/workspace-ai/server/knowledge-records"
import { knowledgeSearchResultSchema } from "@/features/workspace-ai/lib/knowledge-tool-contract"
import type { KnowledgeRecord } from "@/features/workspace-ai/research-types"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"

const mock=vi.hoisted(()=>({access:vi.fn(),row:vi.fn(),download:vi.fn(),load:vi.fn(),context:vi.fn(),audience:vi.fn(),provider:vi.fn()}))
vi.mock("openai",()=>({default:class { responses={create:mock.provider} }}))
vi.mock("@/lib/organization/document-file-audience",()=>({filterDocumentFileAudience:mock.audience}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:mock.access}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async importOriginal=>({...await importOriginal<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mock.load}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mock.context}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ storage: { from: () => ({ download: (...args:unknown[]) => { const request=mock.download(...args); if(typeof request.asStream==="function")return request; return Object.assign(request,{asStream:async()=>{const result=await request;return {...result,data:result.data instanceof Blob?result.data.stream():result.data}}}) } }) }, rpc: async (_name:string,args:{p_file_ids:string[]}) => ({data:{fileIds:args.p_file_ids,sectionIds:[]},error:null}) }) }))
vi.mock("@/lib/organization/private-storage-link", () => ({ assertPrivateOrganizationReadWindow: vi.fn().mockResolvedValue(undefined) }))
const xml=(text:string)=>`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph.</w:t></w:r></w:p></w:body></w:document>`
const archive=(text="Private proposal &amp; budget")=>createZipArchive([{name:"word/document.xml",data:xml(text)}])
function compressedArchive(text:string,claimedSize?:number) {
 const stored=archive(text),end=stored.length-22,central=stored.readUInt32LE(end+16),start=30+stored.readUInt16LE(26)
 const data=stored.subarray(start,central),packed=deflateRawSync(data),header=Buffer.from(stored.subarray(0,start)),directory=Buffer.from(stored.subarray(central,end)),tail=Buffer.from(stored.subarray(end))
 header.writeUInt16LE(8,8);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(claimedSize??data.length,22)
 directory.writeUInt16LE(8,10);directory.writeUInt32LE(packed.length,20);directory.writeUInt32LE(claimedSize??data.length,24)
 tail.writeUInt32LE(header.length+packed.length,16)
 return Buffer.concat([header,packed,directory,tail])
}
const record:KnowledgeRecord={id:`file:${ID(10)}`,kind:"document",title:"Private proposal",content:"File metadata only",href:"/workspace",revision:"2026-10-25T12:00:00Z",contentAvailable:false}
const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),single:mock.row}
const context={user:{id:ID(90)},canvasId:null,objective:particle(1,"objective"),target:{organizationId:WORKSPACE,objectiveId:ID(1),revision:0},graph:graph(),supabase:{from:vi.fn(()=>query),storage:{from:vi.fn(()=>({download:mock.download}))}}} as unknown as ResearchContext
const file=(data:Buffer,mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document")=>({id:ID(10),name:record.title,mime_type:mime,size_bytes:data.length,storage_path:`${WORKSPACE}/library/proposal.docx`,updated_at:record.revision})
beforeEach(()=>{
 vi.clearAllMocks();mock.audience.mockImplementation(async rows=>rows);mock.context.mockResolvedValue(context);mock.access.mockResolvedValue({hasStorageAccess:true})
 const data=archive();mock.row.mockResolvedValue({data:file(data),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(data)]),error:null})
 mock.load.mockResolvedValue([record])
})

describe("bounded DOCX extraction",()=>{
 it("extracts stored and deflated document body text using the existing parser",async()=>{
  expect(await extractKnowledgeDocx(archive())).toContain("Private proposal & budget\n\nSecond paragraph.")
  expect(await extractKnowledgeDocx(compressedArchive("Compressed proposal"))).toContain("Compressed proposal")
 })
 it("rejects missing, duplicate and traversing archive entries",async()=>{
  for(const entries of [[{name:"missing.xml",data:"x"}],[{name:"word/document.xml",data:xml("a")},{name:"word/document.xml",data:xml("b")}],[{name:"../word/document.xml",data:xml("a")}]])
   await expect(extractKnowledgeDocx(createZipArchive(entries))).rejects.toThrow()
 })
 it("enforces actual decompression limits even when the archive lies about its size",async()=>{
  await expect(extractKnowledgeDocx(compressedArchive("x".repeat(600000),1))).rejects.toThrow()
 })
 it("rejects corrupt data, encryption, entity declarations, deep XML and truncated ZIP records",async()=>{
  const corrupt=archive();corrupt[60]^=1
  const encrypted=archive();encrypted.writeUInt16LE(1,6);encrypted.writeUInt16LE(1,encrypted.readUInt32LE(encrypted.length-6)+8)
  const entity=createZipArchive([{name:"word/document.xml",data:'<!DOCTYPE a [<!ENTITY x "private">]>'+xml("&x;")}])
  const deep=archive("<w:r>".repeat(130)+"deep"+"</w:r>".repeat(130))
  for(const input of [corrupt,encrypted,entity,deep,archive().subarray(0,50)])await expect(extractKnowledgeDocx(input)).rejects.toThrow()
 })
})

describe("authorized research file reads",()=>{
 it("feeds actual DOCX body text through search then read without an extra provider call",async()=>{
  const tools=createKnowledgeTools(context)
  await tools.execute("search_workspace",{query:"proposal",kinds:["document"]})
  expect(mock.download).not.toHaveBeenCalled()
  expect(await tools.execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{id:record.id,content:expect.stringContaining("Private proposal & budget"),contentAvailable:true,contentScope:"document_body",truncated:false}]})
  expect(tools.sources.get(record.id)?.revision).toBe(record.revision)
 })
 it("binds a bounded read to organization, file revision and storage access before and after extraction",async()=>{
  const value=await readKnowledgeFile(context,record)
  expect(value).toMatchObject({contentAvailable:true,contentScope:"document_body",contentTruncated:false})
  expect(value.content).toContain("Private proposal & budget")
  expect(query.eq).toHaveBeenCalledWith("org_id",WORKSPACE);expect(query.eq).toHaveBeenCalledWith("id",ID(10))
  expect(query.is).toHaveBeenCalledWith("deleted_at",null);expect(query.is).toHaveBeenCalledWith("document_kind",null)
  expect(mock.row).toHaveBeenCalledTimes(2);expect(mock.access).toHaveBeenCalledTimes(2)
  expect(mock.download).toHaveBeenCalledExactlyOnceWith(`${WORKSPACE}/library/proposal.docx`,undefined,{signal:expect.any(AbortSignal)})
 })
 it("denies inaccessible, foreign-path, stale and deleted files without downloading",async()=>{
  mock.access.mockResolvedValueOnce({hasStorageAccess:false})
  await expect(readKnowledgeFile(context,record)).rejects.toThrow(/access/)
  for(const data of [{...file(archive()),storage_path:`${ID(99)}/library/x`},{...file(archive()),updated_at:"new"},null]) {
   mock.row.mockResolvedValueOnce({data,error:null})
   await expect(readKnowledgeFile(context,record)).rejects.toThrow()
  }
  expect(mock.download).not.toHaveBeenCalled()
 })
 it("withholds contents if the file changes or access is revoked during extraction",async()=>{
  mock.row.mockResolvedValueOnce({data:file(archive()),error:null}).mockResolvedValueOnce({data:{...file(archive()),updated_at:"new"},error:null})
  await expect(readKnowledgeFile(context,record)).rejects.toThrow(/changed/)
  mock.row.mockResolvedValue({data:file(archive()),error:null})
  mock.access.mockResolvedValueOnce({hasStorageAccess:true}).mockResolvedValueOnce({hasStorageAccess:false})
  await expect(readKnowledgeFile(context,record)).rejects.toThrow(/access/)
 })
 it("marks extraction truncation and refuses corrupt or unsupported contents honestly",async()=>{
  let data=archive("x".repeat(210000));mock.row.mockResolvedValue({data:file(data),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(data)]),error:null})
  const value=await readKnowledgeFile(context,record);expect(value.content).toHaveLength(200000);expect(value.contentTruncated).toBe(true)
  data=Buffer.from("not a DOCX");mock.row.mockResolvedValue({data:file(data),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(data)]),error:null})
  expect(await readKnowledgeFile(context,record)).toMatchObject({contentAvailable:false,content:expect.stringContaining("extraction failed")})
  mock.row.mockResolvedValue({data:file(data,"application/msword"),error:null});mock.download.mockClear()
  expect((await readKnowledgeFile(context,record)).contentAvailable).toBe(false);expect(mock.download).not.toHaveBeenCalled()
 })
 it("rejects invalid UTF-8 and actual download size mismatch",async()=>{
  const data=Buffer.from([0xff,0xff]);mock.row.mockResolvedValue({data:file(data,"text/plain"),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(data)]),error:null})
  expect((await readKnowledgeFile(context,record)).contentAvailable).toBe(false)
  mock.download.mockResolvedValue({data:new Blob(["larger"]),error:null})
  await expect(readKnowledgeFile(context,record)).rejects.toThrow(/unavailable/)
 })
})


it("reuses unchanged extraction but rechecks file access and metadata on every cache hit",async()=>{
 const cache=new Map<string,KnowledgeRecord>()
 const first=await readKnowledgeFile(context,record,cache)
 expect(await readKnowledgeFile(context,record,cache)).toEqual(first)
 expect(mock.download).toHaveBeenCalledTimes(1)
 expect(mock.access).toHaveBeenCalledTimes(3)
 expect(mock.row).toHaveBeenCalledTimes(3)
 mock.access.mockResolvedValueOnce({hasStorageAccess:false})
 await expect(readKnowledgeFile(context,record,cache)).rejects.toThrow(/access/)
 mock.row.mockResolvedValueOnce({data:{...file(archive()),updated_at:"new"},error:null})
 await expect(readKnowledgeFile(context,record,cache)).rejects.toThrow(/changed/)
 expect(mock.download).toHaveBeenCalledTimes(1)
})
it("revalidates original file bytes with a fresh download and rejects later revocation",async()=>{
 const tools=createKnowledgeTools(context)
 await tools.execute("search_workspace",{query:"proposal",kinds:["document"]})
 await tools.execute("read_workspace",{ids:[record.id]})
 expect(await tools.revalidate()).toBe(true)
 expect(mock.download).toHaveBeenCalledTimes(2)
 mock.access.mockResolvedValue({hasStorageAccess:false})
 expect(await tools.revalidate()).toBe(false)
 expect(mock.download).toHaveBeenCalledTimes(2)
})

it.each([
 ["application/msword", 100, "unsupported_format"], ["text/plain", 256001, "exhausted_budget"], ["text/plain", 0, "empty"],
] as const)("reports %s at %i bytes as %s without downloading", async (mime, size, availability) => {
 mock.row.mockResolvedValue({ data: { ...file(Buffer.from("text"), mime), size_bytes: size }, error: null })
 expect(await readKnowledgeFile(context, record)).toMatchObject({ contentAvailable: false, availability })
 expect(mock.download).not.toHaveBeenCalled()
})
it("keeps post-extraction missing, failed and revoked queries unavailable instead of asserting a source change", async () => {
 for (const missing of [{ data: null, error: null }, { data: null, error: { message: "network" } }]) {
  mock.row.mockResolvedValueOnce({ data: file(archive()), error: null }).mockResolvedValueOnce(missing)
  await expect(readKnowledgeFile(context, record)).rejects.toThrow("File contents are unavailable")
 }
 mock.row.mockResolvedValueOnce({ data: file(archive()), error: null }).mockResolvedValueOnce({ data: { ...file(archive()), updated_at: "changed" }, error: null })
 mock.access.mockResolvedValueOnce({ hasStorageAccess: true }).mockResolvedValueOnce({ hasStorageAccess: false })
 await expect(readKnowledgeFile(context, record)).rejects.toThrow("Document access is unavailable")
})

it("rejects wrong file identities before extraction and after reading without asserting change", async () => {
 mock.row.mockResolvedValueOnce({ data: { ...file(archive()), id: ID(99) }, error: null })
 await expect(readKnowledgeFile(context, record)).rejects.toThrow("File is unavailable")
 expect(mock.download).not.toHaveBeenCalled()
 mock.row.mockResolvedValueOnce({ data: file(archive()), error: null }).mockResolvedValueOnce({ data: { ...file(archive()), id: ID(99) }, error: null })
 await expect(readKnowledgeFile(context, record)).rejects.toThrow("File contents are unavailable")
})

it("withholds folder-revoked bytes before download, after extraction, and on cache hits",async()=>{
 mock.audience.mockResolvedValueOnce([])
 await expect(readKnowledgeFile(context,record)).rejects.toThrow("File is unavailable")
 expect(mock.download).not.toHaveBeenCalled()
 mock.audience.mockImplementationOnce(async rows=>rows).mockResolvedValueOnce([])
 await expect(readKnowledgeFile(context,record)).rejects.toThrow("File contents are unavailable")
 const cache=new Map<string,KnowledgeRecord>()
 await readKnowledgeFile(context,record,cache)
 const downloads=mock.download.mock.calls.length
 mock.audience.mockResolvedValueOnce([])
 await expect(readKnowledgeFile(context,record,cache)).rejects.toThrow("File is unavailable")
 expect(mock.download).toHaveBeenCalledTimes(downloads)
 expect(mock.audience).toHaveBeenLastCalledWith([file(archive())],context.user.id,{organizationId:context.target.organizationId,canvasId:context.canvasId})
})

const rangeRead=(start:number,end:number)=>({ids:[record.id],documentRanges:[{id:record.id,start,end}]})
function uploadedText(text:string,mime="text/plain") {
 const bytes=mime.includes("wordprocessingml")?archive(text):Buffer.from(text)
 mock.row.mockResolvedValue({data:file(bytes,mime),error:null})
 mock.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null})
 return bytes
}
function searchableUpload(text:string,mime="text/plain") {
 const bytes=uploadedText(text,mime)
 const source:KnowledgeRecord={...record,file:{size:bytes.length,format:mime==="text/markdown"?"md":mime==="text/plain"?"txt":"docx"}}
 mock.load.mockResolvedValue([source])
 return source
}
describe("uploaded passage discovery",()=>{
 it.each(["text/plain","text/markdown","application/vnd.openxmlformats-officedocument.wordprocessingml.document"])("finds late %s governance without a filename match and preserves exact intervals",async mime=>{
  const prefix="Unreviewed operations. \r\n".repeat(1500),late="Governance: expansion is proposed, not approved. Quorum is three."
  const source=searchableUpload(prefix+late,mime),tools=createKnowledgeTools(context)
  const start=prefix.replace(/\r\n?/g,"\n").length,excerpt=mime.includes("wordprocessingml")?late+"\n\nSecond paragraph.":late
  const result=await tools.execute("search_workspace",{query:"governance quorum",kinds:["document"]})
  expect(result).toMatchObject({unavailableKinds:[],results:[{id:source.id,content:excerpt,evidence:{coverage:"excerpt",characters:excerpt.length,location:{kind:"reader_text",start,end:start+excerpt.length},textCoverage:{complete:false,ranges:[{start,end:start+excerpt.length}]}}}]})
  expect(JSON.stringify(result)).not.toMatch(/byteHash|textHash|storage_path|library\//)
  expect(tools.sources.size).toBe(1);expect(tools.dependencies().records[0].detailFingerprint).toMatch(/^[a-f0-9]{64}$/)
  expect(await tools.execute("read_workspace",rangeRead(start,start+late.length))).toMatchObject({results:[{content:late}]})
  expect(mock.provider).not.toHaveBeenCalled()
 })
 it("retains distinct passages as one source with exact union coverage and no unread gap",async()=>{
  searchableUpload("x".repeat(25000)+"\nGovernance is proposed.\n"+"x".repeat(4000)+"\nQuorum is three.")
  const tools=createKnowledgeTools(context),result=await tools.execute("search_workspace",{query:"governance quorum",kinds:["document"]})
  expect(result.results).toHaveLength(2);expect(tools.sources.size).toBe(1)
  expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"excerpt",characters:39,textCoverage:{complete:false,ranges:[{start:25001,end:25024},{start:29026,end:29042}]}})
 })
 it("keeps the existing excerpt contract and exact location for a whole short-file search",async()=>{
  searchableUpload("Quorum is three.")
  expect(await createKnowledgeTools(context).execute("search_workspace",{query:"quorum",kinds:["document"]})).toMatchObject({results:[{evidence:{coverage:"excerpt",characters:16,location:{kind:"reader_text",start:0,end:16}}}]})
 })
 it("does not substitute filename matches for contents or scan beyond the reader cap",async()=>{
  searchableUpload("x".repeat(210000)+" governance")
  expect((await createKnowledgeTools(context).execute("search_workspace",{query:"governance",kinds:["document"]})).results).toEqual([])
  const metadata=await createKnowledgeTools(context).execute("search_workspace",{query:"proposal",kinds:["document"]})
  expect(metadata).toMatchObject({results:[{contentAvailable:false,evidence:{coverage:"metadata_only"}}]})
 })
 it("limits discovery to five eligible files, three hits per source and eight total",async()=>{
  const source=searchableUpload(Array.from({length:10},(_,i)=>`Governance clause ${i}.`).join("\n"))
  const candidates=Array.from({length:7},(_,i)=>({...source,id:`file:${ID(10+i)}`}))
  mock.load.mockImplementation(async (_kind:string,_query:string,id?:string)=>id?candidates.filter(value=>value.id===id):candidates)
  const bytes=Buffer.from(Array.from({length:10},(_,i)=>`Governance clause ${i}.`).join("\n"))
  mock.row.mockImplementation(async()=>({data:{...file(bytes,"text/plain"),id:query.eq.mock.calls.at(-1)![1]},error:null}))
  const tools=createKnowledgeTools(context),result=await tools.execute("search_workspace",{query:"governance",kinds:["document"]})
  expect(result.results).toHaveLength(8)
  expect(result.results.filter(value=>value.id===source.id)).toHaveLength(3)
  expect(mock.download).toHaveBeenCalledTimes(10)
  expect(tools.dependencies().records).toHaveLength(5)
  expect(result.results.some(value=>[candidates[5].id,candidates[6].id].includes(value.id))).toBe(false)
 })
 it("does not extract unsupported, oversized or unqualified-format metadata",async()=>{
  const source=searchableUpload("Governance")
  mock.load.mockResolvedValue([{...source,file:{size:100,format:"pdf"}},{...source,id:`file:${ID(11)}`,file:{size:256001,format:"txt"}},record])
  expect((await createKnowledgeTools(context).execute("search_workspace",{query:"governance",kinds:["document"]})).results).toEqual([])
  expect(mock.download).not.toHaveBeenCalled()
 })
 it("preserves older filename matches outside the recent upload window",async()=>{
  const source=searchableUpload("Older governance proposal.")
  const recent=Array.from({length:20},(_,i)=>({...record,id:`file:${ID(30+i)}`,title:`Recent ${i}`}))
  mock.load.mockImplementation(async (_kind:string,query:string,id?:string)=>id||query?[source]:recent)
  const result=await createKnowledgeTools(context).execute("search_workspace",{query:"proposal",kinds:["document"]})
  expect(result).toMatchObject({unavailableKinds:[],results:[{id:source.id,content:"Older governance proposal."}]})
  expect(mock.download).toHaveBeenCalledTimes(2)
 })
 it("keeps uploaded discovery provider-independent when native hybrid retrieval is configured",async()=>{
  searchableUpload("prefix\nGovernance is proposed.\nunread")
  const {createDocumentRetrieval}=await import("@/features/workspace-ai/server/document-retrieval")
  const embed=vi.fn().mockRejectedValue(new Error("Unexpected embedding")),transport=vi.fn(async (_operation:string,payload:unknown)=>({revision:0,signature:(payload as {signature?:string}).signature??"",keys:[]}))
  const retrieval=createDocumentRetrieval(context,{qualifiedSourceIds:new Set(),model:"fixture",dimensions:1,embed},transport)
  expect(await createKnowledgeTools(context,undefined,retrieval).execute("search_workspace",{query:"governance",kinds:["document"],documentMode:"hybrid"})).toMatchObject({unavailableKinds:[],results:[{id:record.id,content:"Governance is proposed."}]})
  expect(embed).not.toHaveBeenCalled()
  expect(JSON.stringify(transport.mock.calls)).not.toContain("Governance")
 })
 it.each(["bytes","revision","audience","actor","canvas"])("withholds discovery when %s changes before disclosure",async change=>{
  searchableUpload("Governance is proposed.")
  const bytes=Buffer.from("Governance is proposed.")
  mock.download.mockImplementationOnce(async()=>{
   if(change==="bytes")mock.download.mockResolvedValue({data:new Blob(["Governance is approved."]),error:null})
   if(change==="revision")mock.row.mockResolvedValue({data:{...file(bytes,"text/plain"),updated_at:"new"},error:null})
   if(change==="audience")mock.audience.mockResolvedValue([])
   if(change==="actor")mock.context.mockResolvedValue({...context,user:{id:ID(99)}})
   if(change==="canvas")mock.context.mockResolvedValue({...context,canvasId:ID(98)})
   return {data:new Blob([new Uint8Array(bytes)]),error:null}
  })
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("search_workspace",{query:"governance",kinds:["document"]})).toMatchObject({results:[],unavailableKinds:["document"]})
  expect(tools.sources.size).toBe(0)
 })
 it("cancels discovery without returning or retaining passages",async()=>{
  searchableUpload("Governance is proposed.")
  const controller=new AbortController(),tools=createKnowledgeTools(context,controller.signal)
  mock.download.mockImplementationOnce(async()=>{controller.abort();return {data:new Blob(["Governance is proposed."]),error:null}})
  await expect(tools.execute("search_workspace",{query:"governance",kinds:["document"]})).rejects.toThrow()
  expect(tools.sources.size).toBe(0)
 })
})
describe("uploaded document ranges",()=>{
 it.each(["text/plain","text/markdown","application/vnd.openxmlformats-officedocument.wordprocessingml.document"])("reads late %s evidence with exact offsets and partial coverage",async mime=>{
  const late="Governance: expansion is proposed; no approval vote recorded."
  const bytes=uploadedText("x".repeat(24000)+late,mime),original=Buffer.from(bytes)
  const tools=createKnowledgeTools(context)
  const result=await tools.execute("read_workspace",rangeRead(24000,24000+late.length))
  expect(result).toMatchObject({results:[{content:late,revision:record.revision,evidence:{coverage:"excerpt",characters:late.length,location:{kind:"reader_text",start:24000,end:24000+late.length},textCoverage:{complete:false,ranges:[{start:24000,end:24000+late.length}]}}}]})
  expect(JSON.stringify(result)).not.toMatch(/byteHash|textHash|storage_path|library\//)
  expect(bytes.equals(original)).toBe(true)
  expect(tools.dependencies().records[0].detailFingerprint).toMatch(/^[a-f0-9]{64}$/)
 })
 it("unions normalized text intervals exactly and never fills unread gaps",async()=>{
  uploadedText("A\r\nB\rC\nD")
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("read_workspace",rangeRead(2,5))).toMatchObject({results:[{content:"B\nC",evidence:{textCoverage:{totalCharacters:7,availableCharacters:7}}}]})
  await tools.execute("read_workspace",rangeRead(5,7));await tools.execute("read_workspace",rangeRead(0,1))
  expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"excerpt",characters:6,textCoverage:{complete:false,ranges:[{start:0,end:1},{start:2,end:7}]}})
  await tools.execute("read_workspace",rangeRead(1,3))
  expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"complete",characters:7,textCoverage:{complete:true,ranges:[{start:0,end:7}]}})
 })
 it("bounds uploaded text at 200,000 and preserves exact total length and Unicode",async()=>{
  uploadedText("x".repeat(199999)+"😀tail")
  const detail=await readKnowledgeFile(context,record)
  expect(detail.content.length).toBe(199999);expect(detail.fileText?.totalCharacters).toBe(200005)
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(199999,200000))).toMatchObject({results:[{status:"exhausted_budget",evidence:{coverage:"unavailable",textCoverage:{complete:false}}}]})
  uploadedText("A😀B")
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(2,4))).toMatchObject({results:[{content:"B",evidence:{location:{start:3,end:4}}}]})
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(0,2))).toMatchObject({results:[{content:"A",evidence:{location:{start:0,end:1}}}]})
 })
 it.each(["text/csv","application/json"])("refuses range semantics for %s instead of silently reading the prefix",async mime=>{
  uploadedText("abc",mime)
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(1,3))).toMatchObject({results:[{status:"unavailable"}]})
 })
 it("keeps the per-call and remaining read budgets",async()=>{
  uploadedText("x".repeat(24000)+"abcdef")
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(24000,24006),3)).toMatchObject({results:[{content:"abc",evidence:{location:{start:24000,end:24003}}}]})
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(24000,24006),0)).toMatchObject({results:[{status:"exhausted_budget"}]})
  await expect(createKnowledgeTools(context).execute("read_workspace",rangeRead(0,6001))).rejects.toThrow()
 })
 it.each(["bytes","revision","audience"].flatMap(change=>["read","search"].map(mode=>({change,mode}))))("invalidates retained $mode answers after changed $change",async ({change,mode})=>{
  const {assertResearchSourcesAccessible}=await import("@/features/workspace-ai/server/research-result-access")
  const {bindResearch}=await import("@/features/workspace-ai/lib/research-contract")
  searchableUpload("Governance\n"+"x".repeat(219989)+"A")
  const tools=createKnowledgeTools(context)
  if(mode==="read")await tools.execute("read_workspace",rangeRead(24000,24004))
  else await tools.execute("search_workspace",{query:"governance",kinds:["document"]})
  const saved=bindResearch(JSON.stringify({title:"Readiness",summary:"Partial evidence",questions:[],decisions:[],removeReferences:[],items:[]}),[...tools.sources.values()],context.target,ID(91))
  saved.dependencies=tools.dependencies()
  const {particleKnowledgeRecord}=await import("@/features/workspace-ai/server/knowledge-records")
  mock.load.mockImplementation(async (kind:string)=>kind==="particle"?context.graph.particles.map(particleKnowledgeRecord):[{...record,file:{size:220001,format:"txt"}}])
  await expect(assertResearchSourcesAccessible(context,saved,"history")).resolves.toBeUndefined()
  if(change==="bytes")uploadedText("Governance\n"+"x".repeat(219989)+"B")
  if(change==="revision")mock.row.mockResolvedValue({data:{...file(Buffer.alloc(220001),"text/plain"),updated_at:"new"},error:null})
  if(change==="audience")mock.audience.mockResolvedValue([])
  expect(await tools.revalidate()).toBe(false)
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(context,saved,purpose)).rejects.toThrow()
 })
 it.each(["actor","canvas"])("withholds later ranges after %s context changes",async change=>{
  uploadedText("x".repeat(24000)+"Governance")
  const tools=createKnowledgeTools(context);await tools.execute("read_workspace",rangeRead(0,10))
  mock.context.mockResolvedValue(change==="actor"?{...context,user:{...context.user,id:ID(99)}}:{...context,canvasId:ID(98)})
  await expect(tools.execute("read_workspace",rangeRead(24000,24010))).rejects.toThrow()
  expect(await tools.revalidate()).toBe(false)
 })
 it("fingerprints original bytes even when normalized text is identical",async()=>{
  const {knowledgeFingerprint}=await import("@/features/workspace-ai/server/research-dependencies")
  uploadedText("A\r\nB");const first=await readKnowledgeFile(context,record)
  uploadedText("A\nB");const second=await readKnowledgeFile(context,record)
  expect(first.content).toBe(second.content);expect(first.fileText?.textHash).toBe(second.fileText?.textHash)
  expect(knowledgeFingerprint(first)).not.toBe(knowledgeFingerprint(second))
 })
 it("propagates cancellation before download and during extraction without retaining evidence",async()=>{
  const controller=new AbortController();controller.abort()
  await expect(readKnowledgeFile(context,record,undefined,controller.signal)).rejects.toThrow()
  expect(mock.download).not.toHaveBeenCalled()
  const active=new AbortController(),tools=createKnowledgeTools(context,active.signal)
  mock.download.mockImplementationOnce(async()=>{active.abort();return {data:new Blob([new Uint8Array(archive())]),error:null}})
  await expect(tools.execute("read_workspace",rangeRead(0,10))).rejects.toThrow()
  expect(tools.sources.size).toBe(0)
 })
 it.each(["read","search"])("completes a controlled board-readiness answer using late governance through %s",async mode=>{
  const {runResearchProvider}=await import("@/features/workspace-ai/server/research-provider")
  const late="November 12 agenda proposes expansion; no vote recorded. Quorum is three."
  searchableUpload("Unreviewed context. ".repeat(1500)+"\n"+late,"application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  const start="Unreviewed context. ".length*1500+1,tools=createKnowledgeTools(context)
  const response=(id:string,output:unknown[])=>(async function*(){yield {type:"response.completed",response:{id,status:"completed",output,usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}}}}})()
  mock.provider.mockImplementationOnce(()=>response("read",[{type:"function_call",id:"t1",call_id:"c1",name:mode==="read"?"read_workspace":"search_workspace",arguments:JSON.stringify(mode==="read"?{...rangeRead(start,start+late.length),personFields:null,tableAnalysis:null}:{query:"agenda quorum",kinds:["document"],documentMode:null})}]))
  const summary="Expansion is proposed, not approved. Quorum is three. Actuals and unread packet sections remain unverified."
  mock.provider.mockImplementationOnce(()=>response("answer",[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[record.id],title:"Board readiness",summary,questions:[],unfulfilled:["Actuals","Unread packet sections"],decisions:[],removeReferences:[],items:[]})}]}]))
  const result=await runResearchProvider({context,preparedContext:{tools,records:[]},request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Assess readiness for the November 12 board meeting",skill:"planning",tariffVersion:"fixture",maximumCredits:20},config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:2,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
  expect(mock.provider).toHaveBeenCalledTimes(2)
  expect(result.result).toMatchObject({responseKind:"answer",summary,sources:[{id:record.id,evidence:{coverage:"excerpt",scope:"document_body",textCoverage:{complete:false,ranges:[{start,end:start+late.length}]}}}]})
  expect(JSON.stringify(mock.provider.mock.calls[1][0].input)).toContain(late)
  for(const [params] of mock.provider.mock.calls)expect(Buffer.byteLength(JSON.stringify(params))).toBeLessThanOrEqual(20000)
  expect(result.usage).toMatchObject({input:200,output:40,webSearchCalls:0})
 })
})

function discoveryLibrary(count=27,governanceAt=21) {
 const entries=Array.from({length:count},(_,index)=>{
  const id=ID(100+index),text=index===governanceAt?"Unreviewed context. ".repeat(1500)+"\nGovernance: expansion proposed, no vote recorded. Quorum is three.":`Operations packet ${index}.`
  const bytes=Buffer.from(text),source:KnowledgeRecord={...record,id:`file:${id}`,title:`Packet ${index}`,file:{size:bytes.length,format:"txt"}}
  return {source,bytes,row:{...file(bytes,"text/plain"),id,name:source.title,storage_path:`${WORKSPACE}/library/${id}.txt`}}
 })
 const pages: Array<{query:string;after?:string}> = []
 mock.load.mockImplementation(async (_kind:string,query:string,id?:string,page?:UploadedKnowledgePage)=>{
  if(id)return entries.filter(entry=>entry.source.id===id).map(entry=>entry.source)
  let rows=entries.filter(entry=>!query||entry.source.title.toLowerCase().includes(query.toLowerCase()))
  if(page) {
   pages.push({query,after:page.after?.id})
   const index=page.after?rows.findIndex(entry=>entry.row.id===page.after!.id):-1
   rows=rows.slice(index+1,index+21)
   page.next(rows.length===20?{updatedAt:rows.at(-1)!.row.updated_at!,id:rows.at(-1)!.row.id}:null)
  }
  return rows.map(entry=>entry.source)
 })
 mock.row.mockImplementation(async()=>({data:entries.find(entry=>entry.row.id===query.eq.mock.calls.at(-1)![1])?.row??null,error:null}))
 mock.download.mockImplementation(async (path:string)=>({data:new Blob([new Uint8Array(entries.find(entry=>entry.row.storage_path===path)!.bytes)]),error:null}))
 return {entries,pages}
}
const uploadSearch={query:"governance",kinds:["document"],documentMode:null}
const searchUploads=async (tools:ReturnType<typeof createKnowledgeTools>,uploadCursor?:string|null)=>
 knowledgeSearchResultSchema.parse(await tools.execute("search_workspace",{...uploadSearch,uploadCursor}))

describe("bounded upload library continuation",()=>{
 it("reaches older evidence beyond twenty candidates in the second search and reports skipped unread sources",async()=>{
  const {entries,pages}=discoveryLibrary(),tools=createKnowledgeTools(context)
  const first=await searchUploads(tools)
  expect(first).toMatchObject({results:[],unavailableKinds:[],uploads:{scope:"library",candidates:20,attempted:5,read:5,unread:15,pending:15,unreadPriorPages:0}})
  expect(first.uploads!.continuation).not.toBe(first.uploads!.nextPage)
  expect(mock.download).toHaveBeenCalledTimes(5)
  const second=await searchUploads(tools,first.uploads!.nextPage)
  expect(second).toMatchObject({unavailableKinds:[],uploads:{candidates:7,attempted:5,read:5,unread:2,pending:2,unreadPriorPages:15,nextPage:null},results:[{id:entries[21].source.id,content:"Governance: expansion proposed, no vote recorded. Quorum is three."}]})
  expect(pages).toEqual([{query:"governance",after:undefined},{query:"",after:undefined},{query:"",after:entries[19].row.id}])
  expect(mock.download).toHaveBeenCalledTimes(11) // ten new files plus the observed hit's byte recheck
  expect(JSON.stringify(second)).not.toMatch(/storage_path|byteHash|textHash|library\//)
  expect(tools.sources.size).toBe(1)
  expect(await tools.revalidate()).toBe(true)
  entries[21].bytes=Buffer.from(entries[21].bytes.toString().replace("proposed","approved"))
  expect(await tools.revalidate()).toBe(false)
 })
 it("visits all pending files without rereading the page and preserves exact unread counts",async()=>{
  const {pages}=discoveryLibrary(23,22),tools=createKnowledgeTools(context)
  let result=await searchUploads(tools)
  for(const remaining of [10,5,0]) {
   result=await searchUploads(tools,result.uploads!.continuation)
   expect(result.uploads).toMatchObject({candidates:20,attempted:5,read:5,pending:remaining,unread:remaining,unreadPriorPages:0})
  }
  expect(pages).toHaveLength(2)
  result=await searchUploads(tools,result.uploads!.continuation)
  expect(result.uploads).toMatchObject({candidates:3,attempted:3,read:3,unread:0,unreadPriorPages:0,continuation:null,nextPage:null})
  expect(result.note).toContain("not a snapshot")
 })
 it("preserves title-term ranking within a library page",async()=>{
  const {entries}=discoveryLibrary(23,19);entries[19].source.title="Governance packet";entries[19].row.name="Governance packet"
  const tools=createKnowledgeTools(context)
  const result=await tools.execute("search_workspace",{query:"governance quorum",kinds:["document"]})
  expect(result).toMatchObject({results:[{id:entries[19].source.id,content:expect.stringContaining("Quorum is three")}]})
 })
 it("consumes concurrent sibling cursors once without leaking private metadata",async()=>{
  discoveryLibrary();const tools=createKnowledgeTools(context),first=await searchUploads(tools)
  const [continued,replayed]=await Promise.all([searchUploads(tools,first.uploads!.continuation),searchUploads(tools,first.uploads!.nextPage)])
  expect(continued).toMatchObject({unavailableKinds:[],uploads:{read:5}})
  expect(replayed).toMatchObject({unavailableKinds:["document"],results:[]})
  expect(replayed).not.toHaveProperty("uploads")
 })
 it("deduplicates filename matches when continuing into the library",async()=>{
  const {entries}=discoveryLibrary(23,22);entries[22].source.title="Governance packet";entries[22].row.name="Governance packet"
  const tools=createKnowledgeTools(context),first=await searchUploads(tools)
  expect(first.uploads).toMatchObject({scope:"title_matches",candidates:1,read:1})
  const next=await searchUploads(tools,first.uploads!.nextPage)
  expect(next.uploads).toMatchObject({scope:"library",candidates:20})
  const last=await searchUploads(tools,next.uploads!.nextPage)
  expect(last.uploads).toMatchObject({candidates:2,read:2,unreadPriorPages:15,continuation:null})
  expect(last.results).toEqual([])
  expect(tools.sources.size).toBe(1)
 })
 it.each(["query","kinds","mode","other_run","replay","sibling"])("refuses %s cursor reuse without more file reads",async change=>{
  discoveryLibrary();const tools=createKnowledgeTools(context),first=await searchUploads(tools)
  if(change==="replay"||change==="sibling")await searchUploads(tools,first.uploads!.continuation)
  const reads=mock.download.mock.calls.length
  const args={...uploadSearch,uploadCursor:change==="sibling"?first.uploads!.nextPage:first.uploads!.continuation,
   ...(change==="query"?{query:"quorum"}:{}),...(change==="kinds"?{kinds:["document","person"]}:{}),...(change==="mode"?{documentMode:"keyword"}:{})}
  const result=await (change==="other_run"?createKnowledgeTools(context):tools).execute("search_workspace",args)
  expect(result).toMatchObject({unavailableKinds:["document"]})
  expect(result).not.toHaveProperty("uploads")
  expect(mock.download).toHaveBeenCalledTimes(reads)
 })
 it.each(["actor","organization","canvas","revision","revocation","pending_metadata"])("rechecks %s before continuation disclosure",async change=>{
  const {entries}=discoveryLibrary(),tools=createKnowledgeTools(context),first=await searchUploads(tools),reads=mock.download.mock.calls.length
  if(change==="actor")mock.context.mockResolvedValue({...context,user:{id:ID(98)}})
  if(change==="organization")mock.context.mockResolvedValue({...context,target:{...context.target,organizationId:ID(98)}})
  if(change==="canvas")mock.context.mockResolvedValue({...context,canvasId:ID(98)})
  if(change==="revision")entries[5].source={...entries[5].source,revision:"changed"}
  if(change==="revocation")mock.audience.mockResolvedValue([])
  if(change==="pending_metadata")entries.splice(18,1)
  if(["actor","organization","canvas"].includes(change))await expect(searchUploads(tools,first.uploads!.continuation)).rejects.toThrow()
  else expect(await searchUploads(tools,first.uploads!.continuation)).toMatchObject({results:[],unavailableKinds:["document"]})
  expect(mock.download).toHaveBeenCalledTimes(reads)
 })
 it("keeps unsupported/failed contents unread while advancing the bounded page",async()=>{
  const {entries}=discoveryLibrary(22)
  entries[0].source={...entries[0].source,file:{format:"doc",size:100}}
  entries[1].bytes=Buffer.from([255,255]);entries[1].row.size_bytes=2;entries[1].source.file!.size=2
  const tools=createKnowledgeTools(context),first=await searchUploads(tools)
  expect(first.uploads).toMatchObject({candidates:20,attempted:5,read:4,unread:16,pending:14})
  const next=await searchUploads(tools,first.uploads!.nextPage)
  expect(next.uploads).toMatchObject({candidates:2,read:2,unreadPriorPages:16})
 })
 it("cancels a continuation without issuing another cursor or disclosing text",async()=>{
  discoveryLibrary();const controller=new AbortController(),tools=createKnowledgeTools(context,controller.signal),first=await searchUploads(tools)
  mock.download.mockImplementationOnce(async()=>{controller.abort();return {data:new Blob(["Operations packet 5."]),error:null}})
  await expect(searchUploads(tools,first.uploads!.continuation)).rejects.toThrow()
  expect(tools.sources.size).toBe(0)
 })
 it("answers board readiness from older evidence within the unchanged three rounds and 20KB request ceiling",async()=>{
  const {entries}=discoveryLibrary(),tools=createKnowledgeTools(context)
  const {runResearchProvider}=await import("@/features/workspace-ai/server/research-provider")
  const response=(id:string,output:unknown[])=>(async function*(){yield {type:"response.completed",response:{id,status:"completed",output,usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}}}}})()
  const call=(id:string,args:unknown)=>response(id,[{type:"function_call",id,call_id:id,name:"search_workspace",arguments:JSON.stringify(args)}])
  mock.provider.mockImplementationOnce(()=>call("first",{...uploadSearch,uploadCursor:null}))
  mock.provider.mockImplementationOnce((params:{input:Array<{type:string;output?:string}>})=>{
   const result=JSON.parse(params.input.find(item=>item.type==="function_call_output")!.output!)
   return call("older",{...uploadSearch,uploadCursor:result.uploads.nextPage})
  })
  const summary="Expansion is proposed, not approved; quorum is three. Fifteen skipped files, actuals and unread packet sections remain unverified."
  mock.provider.mockImplementationOnce(()=>response("answer",[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[entries[21].source.id],title:"Board readiness",summary,questions:[],unfulfilled:["Actuals","Unread library and packet sections"],decisions:[],removeReferences:[],items:[]})}]}]))
  const result=await runResearchProvider({context,preparedContext:{tools,records:[]},request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Assess readiness for the November 12 board meeting",skill:"planning",tariffVersion:"fixture",maximumCredits:20},config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:3000,maxInputBytes:20000,maxCredits:20,maxCost:60000},onResponse:async()=>{},isCanceled:async()=>false})
  expect(mock.provider).toHaveBeenCalledTimes(3)
  expect(result.result).toMatchObject({responseKind:"answer",summary,sources:[{id:entries[21].source.id,evidence:{coverage:"excerpt",textCoverage:{complete:false}}}]})
  expect(JSON.stringify(mock.provider.mock.calls[2][0].input)).toContain("no vote recorded")
  for(const [params] of mock.provider.mock.calls)expect(Buffer.byteLength(JSON.stringify(params))).toBeLessThanOrEqual(20000)
  expect(result.usage).toMatchObject({input:300,output:60,webSearchCalls:0})
 })
})


async function pdfBytes(pages: string[], totalBytes?:number) {
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica)
 for(const text of pages) { const page=doc.addPage([600,800]); if(text) page.drawText(text,{x:20,y:760,size:text.length>1000?1:10,font,maxWidth:560}) }
 if(totalBytes) {
  // Real embedded raw image bytes; text extraction must not render/decode images.
  let size=totalBytes-65536
  const image=doc.context.register(doc.context.stream(new Uint8Array()))
  doc.getPages()[Math.min(40,pages.length-1)].node.setXObject(PDFName.of("LargeImage"),image)
  doc.getPages()[Math.min(40,pages.length-1)].pushOperators(drawObject("LargeImage"))
  for(let attempt=0;attempt<4;attempt++) {
   doc.context.assign(image,doc.context.stream(Buffer.alloc(size,0x7f),{Type:"XObject",Subtype:"Image",Width:1,Height:size,ColorSpace:"DeviceGray",BitsPerComponent:8}))
   const bytes=Buffer.from(await doc.save({useObjectStreams:false}))
   if(bytes.length===totalBytes)return bytes
   size+=totalBytes-bytes.length
  }
  throw Error("Fixture byte size did not converge")
 }
 return Buffer.from(await doc.save({useObjectStreams:false}))
}
// Controlled standard-security R2 PDFs: real password and empty-user-password
// encryption. Blank pages avoid unrelated encrypted stream fixtures.
async function encryptedPdf(password:string) {
 const padding=Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a","hex")
 const pad=(value:string)=>Buffer.concat([Buffer.from(value),padding]).subarray(0,32)
 const md5=(value:Buffer)=>createHash("md5").update(value).digest()
 const rc4=(key:Buffer,input:Buffer)=>{const state=Array.from({length:256},(_,i)=>i);let j=0;for(let i=0;i<256;i++){j=(j+state[i]+key[i%key.length])%256;[state[i],state[j]]=[state[j],state[i]]}let i=0;j=0;return Buffer.from([...input].map(byte=>{i=(i+1)%256;j=(j+state[i])%256;[state[i],state[j]]=[state[j],state[i]];return byte^state[(state[i]+state[j])%256]}))}
 const owner=rc4(md5(pad("owner")).subarray(0,5),pad(password)),id=Buffer.alloc(16,9),permissions=Buffer.alloc(4);permissions.writeInt32LE(-4)
 const key=md5(Buffer.concat([pad(password),owner,permissions,id])).subarray(0,5),user=rc4(key,padding)
 const doc=await PDFDocument.create();doc.addPage();delete doc.context.trailerInfo.Info
 doc.context.trailerInfo.ID=doc.context.obj([PDFHexString.of(id.toString("hex")),PDFHexString.of(id.toString("hex"))])
 doc.context.trailerInfo.Encrypt=doc.context.register(doc.context.obj({Filter:PDFName.of("Standard"),V:1,R:2,P:-4,O:PDFHexString.of(owner.toString("hex")),U:PDFHexString.of(user.toString("hex"))}))
 return Buffer.from(await doc.save({useObjectStreams:false,updateFieldAppearances:false}))
}
async function uploadedPdf(pages:string[],totalBytes?:number) {
 const bytes=await pdfBytes(pages,totalBytes),source:KnowledgeRecord={...record,file:{size:bytes.length,format:"pdf"}}
 mock.row.mockResolvedValue({data:file(bytes,"application/pdf"),error:null})
 mock.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null});mock.load.mockResolvedValue([source])
 return {bytes,source}
}
describe("bounded PDF research",()=>{
 it("extracts physical page text without mutating original bytes",async()=>{
  const bytes=await pdfBytes(["Opening packet.","Governance: expansion proposed, no vote recorded."]),before=Buffer.from(bytes)
  const result=await extractKnowledgePdf(bytes)
  expect(result).toEqual({startPage:1,content:"Opening packet.\n\nGovernance: expansion proposed, no vote recorded.",totalPages:2,pages:[{page:1,start:0,end:15},{page:2,start:17,end:66}]})
  expect(bytes.equals(before)).toBe(true)
 })
 it("selects pages after forty with window-local offsets and the same extraction ceilings",async()=>{
  const bytes=await pdfBytes(Array.from({length:85},(_,i)=>`Physical page ${i+1}.`))
  const result=await extractKnowledgePdf(bytes,undefined,41)
  expect(result.startPage).toBe(41);expect(result.pages).toHaveLength(40)
  expect(result.pages[0]).toMatchObject({page:41,start:0});expect(result.pages.at(-1)?.page).toBe(80)
  expect(result.content).toContain("Physical page 79.");expect(result.content).not.toContain("Physical page 81.")
  expect(await extractKnowledgePdf(bytes,undefined,85)).toMatchObject({startPage:85,pages:[{page:85,start:0}]})
  for(const page of [0,-1,1.5,NaN,Infinity,86])await expect(extractKnowledgePdf(bytes,undefined,page)).rejects.toThrow()
 })
 it("retains separate ranges for nonconsecutive windows and merges only the matching window",async()=>{
  await uploadedPdf(Array.from({length:125},(_,i)=>`Physical page ${i+1}.`));const tools=createKnowledgeTools(context)
  const read=(page:number,start=0,end=8)=>tools.execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start,end,pdfStartPage:page}]})
  await read(1);await read(81);await read(1,4,12)
  const evidence=tools.sources.get(record.id)?.evidence
  expect(evidence).toMatchObject({coverage:"excerpt",characters:12,textCoverage:{ranges:[{start:0,end:12}],totalCharacters:null,complete:false},pdf:{startPage:1,pages:[1],priorWindows:[{startPage:81,pages:[81],textCoverage:{ranges:[{start:0,end:8}],complete:false}}]}})
  expect(evidence?.location).toBeUndefined();expect(await tools.revalidate()).toBe(true)
  expect(tools.sources.size).toBe(1);expect(tools.dependencies().records[0].pdfStartPage).toBe(1)
 })
 it("separates extraction-cache windows and rechecks authority on cached later reads",async()=>{
  await uploadedPdf(Array.from({length:42},(_,i)=>`Physical page ${i+1}.`));const cache=new Map<string,KnowledgeRecord>()
  const first=await readKnowledgeFile(context,record,cache),later=await readKnowledgeFile(context,record,cache,undefined,41)
  expect(first.pdfText?.pages[0].page).toBe(1);expect(later.pdfText?.pages[0].page).toBe(41)
  expect(await readKnowledgeFile(context,record,cache,undefined,41)).toEqual(later);expect(mock.download).toHaveBeenCalledTimes(2)
  mock.audience.mockResolvedValue([]);await expect(readKnowledgeFile(context,record,cache,undefined,41)).rejects.toThrow()
 })
 it("keeps an empty later window explicit and permits the next bounded read",async()=>{
  await uploadedPdf([...Array(40).fill("Opening."),...Array(40).fill(""),"Governance proposed."])
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start:0,end:6000,pdfStartPage:41}]})).toMatchObject({results:[{status:"empty",contentAvailable:false,evidence:{pdf:{startPage:41,totalPages:81,processedPages:40,unreadPages:Array.from({length:40},(_,i)=>i+41)},textCoverage:{ranges:[],complete:false,totalCharacters:null}}}]})
  expect(await tools.execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start:0,end:6000,pdfStartPage:81}]})).toMatchObject({results:[{status:"truncated",content:"Governance proposed.",evidence:{pdf:{startPage:81,pages:[81]}}}]})
  expect(tools.sources.get(record.id)?.evidence?.pdf?.priorWindows?.[0].unreadPages).toHaveLength(40)
  expect(await tools.revalidate()).toBe(true)
  await tools.execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start:0,end:6000,pdfStartPage:41}]})
  expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"excerpt",characters:0,pdf:{startPage:41,priorWindows:[{startPage:81,pages:[81]}]}})
 })
 it("preserves an actual image-only physical page as an unread later-window gap",async()=>{
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica)
  for(let index=0;index<42;index++)doc.addPage([600,800])
  doc.getPage(40).drawText("Governance proposed.",{x:20,y:760,font,size:10})
  const image=await doc.embedPng(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2XkAAAAASUVORK5CYII=","base64"))
  doc.getPage(41).drawImage(image,{x:20,y:20,width:100,height:100})
  const bytes=Buffer.from(await doc.save({useObjectStreams:false}))
  mock.row.mockResolvedValue({data:file(bytes,"application/pdf"),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null})
  expect(await createKnowledgeTools(context).execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start:0,end:6000,pdfStartPage:41}]})).toMatchObject({results:[{content:"Governance proposed.",evidence:{pdf:{startPage:41,pages:[41],unreadPages:[42]},textCoverage:{complete:false,totalCharacters:null}}}]})
 })
 it("refuses non-PDF windows and does not disguise out-of-document pages as text",async()=>{
  expect(await createKnowledgeTools(context).execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start:0,end:10,pdfStartPage:41}]})).toMatchObject({results:[{status:"unavailable"}]})
  await uploadedPdf(["Only page."])
  expect(await createKnowledgeTools(context).execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start:0,end:10,pdfStartPage:41}]})).toMatchObject({results:[{status:"unsupported_format",contentAvailable:false}]})
 })
 it("refuses invalid signatures, oversized input and encrypted or malformed PDFs",async()=>{
  for(const bytes of [Buffer.from("not a PDF"),Buffer.alloc(MAX_KNOWLEDGE_PDF_BYTES+1),Buffer.from("%PDF-1.7 broken"),await encryptedPdf("secret"),await encryptedPdf("")])
   await expect(extractKnowledgePdf(bytes)).rejects.toThrow()
 })
 it("stops at forty pages and explicitly retains unread trailing pages",async()=>{
  await uploadedPdf([...Array.from({length:40},(_,i)=>`Page ${i+1}.`),"Governance hidden after cap."])
  const result=await createKnowledgeTools(context).execute("read_workspace",{ids:[record.id]})
  expect(result).toMatchObject({results:[{status:"truncated",evidence:{coverage:"excerpt",pdf:{totalPages:41,processedPages:40,unreadPages:[]},textCoverage:{complete:false,totalCharacters:null}}}]})
  expect(JSON.stringify(result)).not.toContain("hidden after cap")
 })
 it("keeps mixed no-text pages as gaps; image-only PDFs disclose no text",async()=>{
  await uploadedPdf(["Opening text.","","Governance proposed."])
  const tools=createKnowledgeTools(context),result=await tools.execute("read_workspace",{ids:[record.id]})
  expect(result).toMatchObject({results:[{status:"truncated",evidence:{pdf:{pages:[1,3],unreadPages:[2]},textCoverage:{complete:false,totalCharacters:null}}}]})
  await tools.execute("read_workspace",{ids:[record.id]})
  expect(tools.sources.get(record.id)?.evidence?.coverage).toBe("excerpt")
  await uploadedPdf([""])
  expect(await createKnowledgeTools(context).execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{contentAvailable:false,status:"empty"}]})
 })
 it("reads later ranges and unions search/read page evidence without filling gaps",async()=>{
  await uploadedPdf(["Unreviewed context.","Governance proposed.","Quorum is three."])
  const detail=await readKnowledgeFile(context,record),start=detail.content.indexOf("Governance"),end=detail.content.indexOf("Quorum")
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("search_workspace",{query:"governance quorum",kinds:["document"]})).toMatchObject({results:[{evidence:{pdf:{pages:[2]}}},{evidence:{pdf:{pages:[3]}}}]})
  expect(await tools.execute("read_workspace",rangeRead(start,start+10))).toMatchObject({results:[{content:"Governance",evidence:{location:{start,end:start+10},pdf:{pages:[2]}}}]})
  expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"excerpt",pdf:{pages:[2,3]},textCoverage:{complete:false,ranges:[{start,end:start+20},{start:end,end:end+16}]}})
  expect(JSON.stringify([...tools.sources.values()])).not.toMatch(/byteHash|textHash|storage_path|library\//)
 })
 it("preserves explicit unavailable PDF states for range requests",async()=>{
  await uploadedPdf([""])
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(0,10))).toMatchObject({results:[{status:"empty",contentAvailable:false}]})
  const bytes=Buffer.from("%PDF-1.7 broken");mock.row.mockResolvedValue({data:file(bytes,"application/pdf"),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null})
  expect(await createKnowledgeTools(context).execute("read_workspace",rangeRead(0,10))).toMatchObject({results:[{status:"unsupported_format",contentAvailable:false}]})
 })
 it("fingerprints unparsed bytes even when extracted PDF text stays identical",async()=>{
  const {bytes:base,source}=await uploadedPdf(["Governance proposed."]),bytes=Buffer.concat([base,Buffer.from("\n%original")])
  mock.row.mockResolvedValue({data:file(bytes,"application/pdf"),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null});mock.load.mockResolvedValue([{...source,file:{size:bytes.length,format:"pdf"}}])
  const before=await readKnowledgeFile(context,record),tools=createKnowledgeTools(context);await tools.execute("read_workspace",{ids:[record.id]})
  const changed=Buffer.from(bytes);changed[changed.length-1]=120;mock.download.mockResolvedValue({data:new Blob([new Uint8Array(changed)]),error:null})
  const after=await readKnowledgeFile(context,record);expect(after.fileText?.textHash).toBe(before.fileText?.textHash);expect(after.fileText?.byteHash).not.toBe(before.fileText?.byteHash)
  expect(await tools.revalidate()).toBe(false)
 })
 it("reports complete extracted text only when every processed page has text and all intervals are read",async()=>{
  await uploadedPdf(["Opening.","Quorum."])
  expect(await createKnowledgeTools(context).execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{status:"available",evidence:{coverage:"complete",scope:"text",textCoverage:{complete:true},pdf:{pages:[1,2],unreadPages:[]}}}]})
 })
 it("refuses decompressed text beyond the existing reader ceiling",async()=>{
  await expect(extractKnowledgePdf(await pdfBytes(Array.from({length:40},()=>"A ".repeat(2600))))).rejects.toThrow()
 })
 it("cancels a parser in flight and applies the wall-clock deadline",async()=>{
  const bytes=await pdfBytes(["Governance text."]),controller=new AbortController()
  const running=extractKnowledgePdf(bytes,controller.signal);controller.abort(new Error("canceled"))
  await expect(running).rejects.toThrow("canceled")
  vi.useFakeTimers()
  try { const timed=expect(extractKnowledgePdf(bytes)).rejects.toThrow("limits"); await vi.advanceTimersByTimeAsync(PDF_LIMITS.timeoutMs);await timed } finally {vi.useRealTimers()}
 })
 it("rechecks audience after parsing and never retains revoked PDF text",async()=>{
  await uploadedPdf(["Private governance."]);mock.audience.mockResolvedValueOnce([file(await pdfBytes(["Private governance."]),"application/pdf")]).mockResolvedValueOnce([])
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{status:"unavailable"}]});expect(tools.sources.size).toBe(0)
 })
 it("invalidates retained PDF evidence when bytes change without a revision update",async()=>{
  const {bytes}=await uploadedPdf(["Opening context.","Governance proposed."]),tools=createKnowledgeTools(context)
  await tools.execute("read_workspace",{ids:[record.id]})
  const changed=Buffer.from(bytes);const index=changed.indexOf(Buffer.from("Helvetica"));expect(index).toBeGreaterThan(0);changed[index+1]="a".charCodeAt(0)
  mock.download.mockResolvedValue({data:new Blob([new Uint8Array(changed)]),error:null})
  expect(await tools.revalidate()).toBe(false)
 })
 it.each(["bytes","revision","audience","actor","organization","canvas"])("rejects saved PDF answers after %s changes",async change=>{
  const {assertResearchSourcesAccessible}=await import("@/features/workspace-ai/server/research-result-access")
  const {bindResearch}=await import("@/features/workspace-ai/lib/research-contract")
  const {particleKnowledgeRecord}=await import("@/features/workspace-ai/server/knowledge-records")
  const {bytes,source}=await uploadedPdf([...Array(40).fill("Opening text."),"Governance proposed."]),tools=createKnowledgeTools(context)
  await tools.execute("read_workspace",{ids:[record.id],documentRanges:[{id:record.id,start:0,end:6000,pdfStartPage:41}]})
  expect(tools.dependencies().records[0].pdfStartPage).toBe(41)
  const saved=bindResearch(JSON.stringify({title:"Readiness",summary:"Partial evidence",questions:[],decisions:[],removeReferences:[],items:[]}),[...tools.sources.values()],context.target,ID(91))
  saved.dependencies=tools.dependencies()
  mock.load.mockImplementation(async(kind:string)=>kind==="particle"?context.graph.particles.map(particleKnowledgeRecord):[source])
  await expect(assertResearchSourcesAccessible(context,saved,"history")).resolves.toBeUndefined()
  if(change==="bytes") { const changed=Buffer.from(bytes);changed[changed.indexOf(Buffer.from("Helvetica"))+1]=97;mock.download.mockResolvedValue({data:new Blob([new Uint8Array(changed)]),error:null}) }
  if(change==="revision")mock.row.mockResolvedValue({data:{...file(bytes,"application/pdf"),updated_at:"new"},error:null})
  if(change==="audience")mock.audience.mockResolvedValue([])
  const changedContext=change==="actor"?{...context,user:{...context.user,id:ID(99)}}:change==="organization"?{...context,target:{...context.target,organizationId:ID(98)}}:change==="canvas"?{...context,canvasId:ID(98)}:context
  mock.context.mockResolvedValue(changedContext)
  // Persisted answers are shareable with currently authorized viewers. Model
  // actual revoked audiences for changed actor/canvas, not identity alone.
  if(change==="actor" || change==="canvas")mock.audience.mockImplementation(async(rows,actor,scope)=>actor===context.user.id && scope.canvasId===context.canvasId?rows:[])
  expect(await tools.revalidate()).toBe(false)
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(changedContext,saved,purpose)).rejects.toThrow()
 })
 it("answers board readiness from governance after page forty within the existing request ceiling",async()=>{
  const {runResearchProvider}=await import("@/features/workspace-ai/server/research-provider")
  const late="November 12 agenda proposes expansion; no vote recorded. Quorum is three."
  await uploadedPdf([...Array(40).fill("Unreviewed opening context."),late,"",...Array(43).fill("Appendix not approved minutes.")])
  const tools=createKnowledgeTools(context)
  const response=(id:string,output:unknown[])=>(async function*(){yield {type:"response.completed",response:{id,status:"completed",output,usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}}}}})()
  mock.provider.mockImplementationOnce(()=>response("search",[{type:"function_call",id:"t1",call_id:"c1",name:"search_workspace",arguments:JSON.stringify({query:"agenda quorum",kinds:["document"],documentMode:null,uploadCursor:null})}]))
  mock.provider.mockImplementationOnce(()=>response("read",[{type:"function_call",id:"t2",call_id:"c2",name:"read_workspace",arguments:JSON.stringify({ids:[record.id],personFields:null,tableAnalysis:null,documentRanges:[{id:record.id,start:0,end:late.length,pdfStartPage:41}]})}]))
  const summary="Expansion is proposed, not approved. Quorum is three. Actuals and unread packet sections remain unverified."
  mock.provider.mockImplementationOnce(()=>response("answer",[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[record.id],title:"Board readiness",summary,questions:[],unfulfilled:["Actuals","Unread packet sections"],decisions:[],removeReferences:[],items:[]})}]}]))
  const result=await runResearchProvider({context,preparedContext:{tools,records:[]},request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Assess readiness for the November 12 board meeting",skill:"planning",tariffVersion:"fixture",maximumCredits:20},config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
  expect(result.result).toMatchObject({responseKind:"answer",summary,sources:[{id:record.id,evidence:{coverage:"excerpt",pdf:{startPage:41,pages:[41],unreadPages:[42]},textCoverage:{complete:false}}}]})
  expect(JSON.stringify(mock.provider.mock.calls[2][0].input)).toContain(late)
  expect(mock.provider).toHaveBeenCalledTimes(3)
  for(const [params] of mock.provider.mock.calls)expect(Buffer.byteLength(JSON.stringify(params))).toBeLessThanOrEqual(20000)
 })
})

const pdfWindowSearch = {query:"governance quorum",kinds:["document"],documentMode:"keyword",uploadCursor:null,pdfWindow:{id:record.id,startPage:41}}
describe("selected PDF window passage discovery",()=>{
 it("finds late local passages, reads their exact physical page and never scans other files",async()=>{
  await uploadedPdf([...Array(40).fill("Earlier quorum must not leak."),"Context. ".repeat(900),"Governance: quorum is three.","",...Array(37).fill("Appendix."),"Later governance must not leak."])
  const tools=createKnowledgeTools(context)
  const found=knowledgeSearchResultSchema.parse(await tools.execute("search_workspace",pdfWindowSearch))
  expect(found.uploads).toBeUndefined();expect(found.results).toHaveLength(1)
  const hit=found.results[0],location=hit.evidence.location!
  expect(location.start).toBeGreaterThan(6000)
  expect(hit).toMatchObject({content:"Governance: quorum is three.",evidence:{pdf:{startPage:41,pages:[42],unreadPages:[43]},textCoverage:{complete:false}}})
  expect(found.pdfWindow).toMatchObject({id:record.id,evidence:{characters:0,pdf:{startPage:41,processedPages:40,pages:[],unreadPages:[43]},textCoverage:{ranges:[],complete:false}}})
  expect(JSON.stringify(found)).not.toContain("must not leak")
  expect(mock.load.mock.calls.every(([,query,id])=>query==="" && id===record.id)).toBe(true)
  expect(await tools.execute("read_workspace",{ids:[hit.id],documentRanges:[{id:hit.id,start:location.start,end:location.end,pdfStartPage:41}]})).toMatchObject({results:[{content:hit.content,evidence:{pdf:{startPage:41,pages:[42]}}}]})
  expect(tools.dependencies().records[0].pdfStartPage).toBe(41)
  expect(tools.sources.get(record.id)?.evidence?.textCoverage?.ranges).toEqual([{start:location.start,end:location.end}])
 })
 it.each(["no match","empty"])("returns explicit unread coverage for %s without invented evidence",async mode=>{
  await uploadedPdf([...Array(40).fill("Governance opening."),...Array(41).fill(mode==="empty"?"":"Unrelated context.")])
  const tools=createKnowledgeTools(context),result=knowledgeSearchResultSchema.parse(await tools.execute("search_workspace",pdfWindowSearch))
  expect(result.results).toEqual([]);expect(result.unavailableKinds).toEqual([])
  expect(result.pdfWindow?.evidence).toMatchObject({characters:0,coverage:"metadata_only",textCoverage:{complete:false,ranges:[],totalCharacters:null},pdf:{startPage:41,totalPages:81,processedPages:40,pages:[]}})
  expect(result.pdfWindow?.evidence.pdf?.unreadPages).toHaveLength(mode==="empty"?40:0)
  expect(tools.sources.size).toBe(0)
 })
 it.each(["wrong format","outside","oversize","denied","changed during search"])("refuses %s without leaking a partial result",async mode=>{
  const {bytes}=await uploadedPdf([...Array(40).fill("Opening."),"Private governance quorum."])
  if(mode==="wrong format")mock.row.mockResolvedValue({data:file(bytes,"text/plain"),error:null})
  if(mode==="oversize")mock.row.mockResolvedValue({data:{...file(bytes,"application/pdf"),size_bytes:MAX_KNOWLEDGE_PDF_BYTES+1},error:null})
  if(mode==="denied")mock.audience.mockResolvedValue([])
  if(mode==="changed during search")mock.download.mockImplementationOnce(async()=>{
   mock.download.mockResolvedValue({data:new Blob([new Uint8Array(Buffer.from(bytes).fill(32,0,1))]),error:null})
   return {data:new Blob([new Uint8Array(bytes)]),error:null}
  })
  const tools=createKnowledgeTools(context),result=await tools.execute("search_workspace",{...pdfWindowSearch,pdfWindow:{id:record.id,startPage:mode==="outside"?99:41}})
  expect(result).toMatchObject({results:[],unavailableKinds:["document"]});expect(result).not.toHaveProperty("pdfWindow")
  expect(tools.sources.size).toBe(0);expect(JSON.stringify(result)).not.toContain("Private governance")
 })
 it("rejects mixed scopes before loading and propagates cancellation during extraction",async()=>{
  const tools=createKnowledgeTools(context)
  for(const patch of [{kinds:["document","person"]},{documentMode:"hybrid"},{uploadCursor:ID(77)}])
   await expect(tools.execute("search_workspace",{...pdfWindowSearch,...patch})).rejects.toThrow(/scope/)
  expect(mock.load).not.toHaveBeenCalled()
  const {bytes}=await uploadedPdf([...Array(40).fill("Opening."),"Private governance."]),controller=new AbortController()
  mock.download.mockImplementationOnce(async()=>{controller.abort();return {data:new Blob([new Uint8Array(bytes)]),error:null}})
  const canceled=createKnowledgeTools(context,controller.signal)
  await expect(canceled.execute("search_workspace",pdfWindowSearch)).rejects.toThrow();expect(canceled.sources.size).toBe(0)
 })
 it.each(["bytes","revision","audience","actor","organization","canvas"])("invalidates saved selected-window search evidence after %s changes",async change=>{
  const {assertResearchSourcesAccessible}=await import("@/features/workspace-ai/server/research-result-access")
  const {bindResearch}=await import("@/features/workspace-ai/lib/research-contract")
  const {particleKnowledgeRecord}=await import("@/features/workspace-ai/server/knowledge-records")
  const {bytes,source}=await uploadedPdf([...Array(40).fill("Opening."),"Context. ".repeat(900),"Governance quorum three."],3*1024*1024),tools=createKnowledgeTools(context)
  await tools.execute("search_workspace",pdfWindowSearch)
  const saved=bindResearch(JSON.stringify({responseKind:"answer",answerEvidenceIds:[record.id],title:"Readiness",summary:"Partial evidence",questions:[],decisions:[],removeReferences:[],items:[]}),[...tools.sources.values()],context.target,ID(91))
  saved.dependencies=tools.dependencies();expect(saved.sources[0].evidence?.location?.start).toBeGreaterThan(6000)
  mock.load.mockImplementation(async(kind:string)=>kind==="particle"?context.graph.particles.map(particleKnowledgeRecord):[source])
  await expect(assertResearchSourcesAccessible(context,saved,"history")).resolves.toBeUndefined()
  if(change==="bytes") { const changed=Buffer.from(bytes);changed[changed.indexOf(Buffer.from("Helvetica"))+1]=97;mock.download.mockResolvedValue({data:new Blob([new Uint8Array(changed)]),error:null}) }
  if(change==="revision")mock.row.mockResolvedValue({data:{...file(bytes,"application/pdf"),updated_at:"new"},error:null})
  if(change==="audience")mock.audience.mockResolvedValue([])
  const changedContext=change==="actor"?{...context,user:{...context.user,id:ID(99)}}:change==="organization"?{...context,target:{...context.target,organizationId:ID(98)}}:change==="canvas"?{...context,canvasId:ID(98)}:context
  mock.context.mockResolvedValue(changedContext)
  if(change==="actor" || change==="canvas")mock.audience.mockImplementation(async(rows,actor,scope)=>actor===context.user.id && scope.canvasId===context.canvasId?rows:[])
  expect(await tools.revalidate()).toBe(false)
  for(const purpose of ["history","apply"] as const)await expect(assertResearchSourcesAccessible(changedContext,saved,purpose)).rejects.toThrow()
 })
 it.each([undefined,MAX_KNOWLEDGE_PDF_BYTES])("answers board readiness with %s bytes by finding and reading late governance",async totalBytes=>{
  const {runResearchProvider}=await import("@/features/workspace-ai/server/research-provider")
  const late="November 12 governance agenda proposes expansion; no vote recorded. Quorum is three."
  await uploadedPdf([...Array(40).fill("Unreviewed opening context."),"Context. ".repeat(900),late,"",...Array(42).fill("Appendix.")],totalBytes)
  const tools=createKnowledgeTools(context)
  const response=(id:string,output:unknown[])=>(async function*(){yield {type:"response.completed",response:{id,status:"completed",output,usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0}}}}})()
  mock.provider.mockImplementationOnce(()=>response("search",[{type:"function_call",id:"t1",call_id:"c1",name:"search_workspace",arguments:JSON.stringify(pdfWindowSearch)}]))
  mock.provider.mockImplementationOnce((params:{input:Array<{type:string;output?:string}>})=>{
   const found=knowledgeSearchResultSchema.parse(JSON.parse(params.input.find(item=>item.type==="function_call_output")!.output!))
   const hit=found.results[0],location=hit.evidence.location!;expect(location.start).toBeGreaterThan(6000)
   return response("read",[{type:"function_call",id:"t2",call_id:"c2",name:"read_workspace",arguments:JSON.stringify({ids:[hit.id],personFields:null,tableAnalysis:null,documentRanges:[{id:hit.id,start:location.start,end:location.end,pdfStartPage:found.pdfWindow!.evidence.pdf!.startPage}]})}])
  })
  const summary="Expansion is proposed, not approved. Quorum is three. Actuals and unread packet sections remain unverified."
  mock.provider.mockImplementationOnce(()=>response("answer",[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({responseKind:"answer",answerEvidenceIds:[record.id],title:"Board readiness",summary,questions:[],unfulfilled:["Actuals","Unread packet sections"],decisions:[],removeReferences:[],items:[]})}]}]))
  const result=await runResearchProvider({context,preparedContext:{tools,records:[]},request:{id:ID(91),parentRunId:ID(92),target:context.target,prompt:"Assess readiness for the November 12 board meeting",skill:"planning",tariffVersion:"fixture",maximumCredits:20},config:{tariff:{version:"fixture",model:"fixture",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000},maxSearchCalls:0,maxRounds:3,maxOutputTokens:1500,maxInputBytes:20000,maxCredits:20,maxCost:40000},onResponse:async()=>{},isCanceled:async()=>false})
  expect(result.result).toMatchObject({responseKind:"answer",summary,sources:[{id:record.id,evidence:{coverage:"excerpt",pdf:{startPage:41,pages:[42],unreadPages:[43]},textCoverage:{complete:false}}}]})
  expect(JSON.stringify(mock.provider.mock.calls[2][0].input)).toContain(late);expect(mock.provider).toHaveBeenCalledTimes(3)
  for(const [params] of mock.provider.mock.calls)expect(Buffer.byteLength(JSON.stringify(params))).toBeLessThanOrEqual(20000)
  expect(result.usage).toMatchObject({input:300,output:60,webSearchCalls:0})
 })
})

function memoryExhaustingPdf() {
 // A compressed Catalog object expands into enough dictionaries to exceed the
 // isolated worker heap. No huge allocation is made in the application reader.
 const zip=deflateSync(Buffer.from('1 0 << /Type /Catalog /Pages 2 0 R /Bomb ['+'<<>> '.repeat(700000)+'] >>'))
 const chunks=[Buffer.from('%PDF-1.7\n')],offsets:number[]=[0]
 const object=(id:number,body:string|Buffer)=>{offsets[id]=Buffer.concat(chunks).length;chunks.push(Buffer.from(`${id} 0 obj\n`),Buffer.from(body),Buffer.from('\nendobj\n'))}
 object(2,'<< /Type /Pages /Count 1 /Kids [3 0 R] >>');object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>')
 object(4,Buffer.concat([Buffer.from(`<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${zip.length} >>\nstream\n`),zip,Buffer.from('\nendstream')]))
 const xrefOffset=Buffer.concat(chunks).length,xref=Buffer.alloc(42)
 const entry=(i:number,type:number,a:number,b:number)=>{xref[i*7]=type;xref.writeUInt32BE(a,i*7+1);xref.writeUInt16BE(b,i*7+5)}
 entry(0,0,0,65535);entry(1,2,4,0);for(const i of [2,3,4])entry(i,1,offsets[i],0);entry(5,1,xrefOffset,0)
 object(5,Buffer.concat([Buffer.from(`<< /Type /XRef /Size 6 /Root 1 0 R /W [1 4 2] /Length ${xref.length} >>\nstream\n`),xref,Buffer.from('\nendstream')]))
 chunks.push(Buffer.from(`startxref\n${xrefOffset}\n%%EOF`));return Buffer.concat(chunks)
}

describe("larger-byte PDF bounds",()=>{
 it.each([3,8])("reads a %s MiB embedded-image packet without mutating bytes or claiming whole-file coverage",async mb=>{
  const {bytes}=await uploadedPdf([...Array(40).fill("Unreviewed."),"Governance quorum three.","",...Array(43).fill("Appendix.")],mb*1024*1024)
  const hash=createHash("sha256").update(bytes).digest("hex")
  const result=await readKnowledgeFile(context,record,undefined,undefined,41)
  expect(result).toMatchObject({contentAvailable:true,fileText:{byteLength:mb*1024*1024,byteHash:hash},pdfText:{startPage:41,totalPages:85}})
  expect(result.pdfText?.pages).toHaveLength(40);expect(result.content).toContain("Governance quorum three.")
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash)
 })
 it("refuses actual heap exhaustion, then successfully parses another file",async()=>{
  const bytes=memoryExhaustingPdf()
  expect(bytes.length).toBeLessThan(10000)
  mock.row.mockResolvedValue({data:file(bytes,"application/pdf"),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null})
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{status:"exhausted_budget",contentAvailable:false}]})
  expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"unavailable",characters:0})
  expect((await extractKnowledgePdf(await pdfBytes(["Recovery."]))).content).toBe("Recovery.")
 })
 it.each(["ceiling","metadata","short"])("cancels a real SDK download with %s byte mismatch before parsing",async mode=>{
  const {createClient}=await import("@supabase/supabase-js")
  let pulls=0;const cancel=vi.fn()
  const actual=mode==="ceiling"?MAX_KNOWLEDGE_PDF_BYTES+1:mode==="metadata"?1025:10
  const stream=new ReadableStream<Uint8Array>({pull(controller){pulls++;if(pulls===1)controller.enqueue(new Uint8Array(actual));else if(mode==="short")controller.close()},cancel})
  const fetch=vi.fn(async()=>new Response(stream,{headers:{"Content-Length":"1024"}}))
  const client=createClient("https://storage.test","fixture-key",{global:{fetch},auth:{persistSession:false}})
  mock.row.mockResolvedValue({data:{...file(Buffer.alloc(1024),"application/pdf"),size_bytes:mode==="ceiling"?MAX_KNOWLEDGE_PDF_BYTES:1024},error:null})
  mock.download.mockImplementationOnce(()=>client.storage.from("org-documents").download(`${WORKSPACE}/library/fixture.pdf`))
  const tools=createKnowledgeTools(context)
  expect(await tools.execute("read_workspace",{ids:[record.id]})).toMatchObject({results:[{status:mode==="ceiling"?"exhausted_budget":"unavailable",contentAvailable:false}]})
  expect(tools.sources.get(record.id)?.evidence).toMatchObject({coverage:"unavailable",characters:0});expect(fetch).toHaveBeenCalledTimes(1)
  if(mode!=="short")expect(cancel).toHaveBeenCalledTimes(1)
  expect(pulls).toBeLessThanOrEqual(2)
 })
 it.each(["caller","deadline"])("cancels a stalled PDF download on %s without retaining partial bytes",async mode=>{
  const controller=new AbortController(),cancel=vi.fn(),started=Promise.withResolvers<void>()
  const stream=new ReadableStream<Uint8Array>({pull(){started.resolve()},cancel},{highWaterMark:0})
  mock.row.mockResolvedValue({data:file(Buffer.alloc(1024),"application/pdf"),error:null});mock.download.mockResolvedValue({data:stream,error:null})
  const timeout=mode==="deadline"?vi.spyOn(AbortSignal,"timeout").mockReturnValue(controller.signal):undefined
  try {
   const running=readKnowledgeFile(context,record,undefined,mode==="caller"?controller.signal:undefined)
   const check=mode==="caller"?expect(running).rejects.toThrow("Canceled fixture"):expect(running).resolves.toMatchObject({contentAvailable:false,availability:"unavailable"})
   await started.promise;controller.abort(new Error("Canceled fixture"));await check
   expect(cancel).toHaveBeenCalledTimes(1)
  } finally {timeout?.mockRestore()}
 })
 it("cancels a 15 MiB parser and preserves the original buffer",async()=>{
  const bytes=await pdfBytes(["Private governance."],MAX_KNOWLEDGE_PDF_BYTES),hash=createHash("sha256").update(bytes).digest("hex"),controller=new AbortController()
  const pending=extractKnowledgePdf(bytes,controller.signal);controller.abort(new Error("Canceled large parser"))
  await expect(pending).rejects.toThrow("Canceled large parser")
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash)
 })
 it("rechecks audience after extracting a large file",async()=>{
  await uploadedPdf(["Private governance."],3*1024*1024)
  mock.audience.mockImplementationOnce(async rows=>rows).mockResolvedValueOnce([])
  const tools=createKnowledgeTools(context)
  const result=await tools.execute("read_workspace",{ids:[record.id]})
  expect(result).toMatchObject({results:[{status:"unavailable"}]});expect(JSON.stringify(result)).not.toContain("Private governance")
  expect(tools.sources.size).toBe(0)
 })
})
