import { beforeEach, describe, expect, it, vi } from "vitest"
import { deflateRawSync } from "node:zlib"
import { createZipArchive } from "@/lib/files/simple-zip"
import { extractKnowledgeDocx } from "@/features/workspace-ai/server/knowledge-docx"
import { readKnowledgeFile } from "@/features/workspace-ai/server/knowledge-file"
import { createKnowledgeTools } from "@/features/workspace-ai/server/knowledge-tools"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { KnowledgeRecord } from "@/features/workspace-ai/research-types"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"

const mock=vi.hoisted(()=>({access:vi.fn(),row:vi.fn(),download:vi.fn(),load:vi.fn()}))
vi.mock("@/lib/organization/document-storage-access",()=>({resolveOrganizationDocumentStorageAccess:mock.access}))
vi.mock("@/features/workspace-ai/server/knowledge-records",async importOriginal=>({...await importOriginal<typeof import("@/features/workspace-ai/server/knowledge-records")>(),knowledgeLoader:()=>mock.load}))
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
const context={target:{organizationId:WORKSPACE},graph:{particles:[]},supabase:{from:vi.fn(()=>query),storage:{from:vi.fn(()=>({download:mock.download}))}}} as unknown as ResearchContext
const file=(data:Buffer,mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document")=>({id:ID(10),name:record.title,mime_type:mime,size_bytes:data.length,storage_path:`${WORKSPACE}/library/proposal.docx`,updated_at:record.revision})
beforeEach(()=>{
 vi.clearAllMocks();mock.access.mockResolvedValue({hasStorageAccess:true})
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
  let data=archive("x".repeat(21000));mock.row.mockResolvedValue({data:file(data),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(data)]),error:null})
  const value=await readKnowledgeFile(context,record);expect(value.content).toHaveLength(20000);expect(value.contentTruncated).toBe(true)
  data=Buffer.from("not a DOCX");mock.row.mockResolvedValue({data:file(data),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(data)]),error:null})
  expect(await readKnowledgeFile(context,record)).toMatchObject({contentAvailable:false,content:expect.stringContaining("extraction failed")})
  mock.row.mockResolvedValue({data:file(data,"application/pdf"),error:null});mock.download.mockClear()
  expect((await readKnowledgeFile(context,record)).contentAvailable).toBe(false);expect(mock.download).not.toHaveBeenCalled()
 })
 it("rejects invalid UTF-8 and actual download size mismatch",async()=>{
  const data=Buffer.from([0xff,0xff]);mock.row.mockResolvedValue({data:file(data,"text/plain"),error:null});mock.download.mockResolvedValue({data:new Blob([new Uint8Array(data)]),error:null})
  expect((await readKnowledgeFile(context,record)).contentAvailable).toBe(false)
  mock.download.mockResolvedValue({data:new Blob(["larger"]),error:null})
  await expect(readKnowledgeFile(context,record)).rejects.toThrow(/unavailable/)
 })
})
