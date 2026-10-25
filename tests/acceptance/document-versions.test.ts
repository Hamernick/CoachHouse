import { beforeEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap"
import { commitDocumentVersion } from "@/features/document-editing/server/version-service"
import { serializeDocumentPrefix, prepareRestoredMarkdown } from "@/features/document-editing/server/version-serialization"
import { markdownDocumentSchema, createMarkdownAdapter } from "@/features/document-editing/lib/markdown-adapter"
import { documentCommitSchema, receiptFromVersion } from "@/features/document-editing/lib/version-contracts"
import { contentHash, versionPath } from "@/features/document-editing/server/version-reader"
import type { DocumentVersion } from "@/features/document-editing/lib/version-contracts"

const mocks=vi.hoisted(()=>({actor:vi.fn(),room:vi.fn(),tail:vi.fn(),canonical:vi.fn(),version:vi.fn(),content:vi.fn(),admin:vi.fn(),rpc:vi.fn(),upload:vi.fn(),remove:vi.fn(),reserve:vi.fn(),abandon:vi.fn()}))
vi.mock("@/features/document-editing/server/room-access",()=>({requireDocumentRoomActor:mocks.actor}))
vi.mock("@/features/document-editing/server/version-reader",async()=>({...await vi.importActual<typeof import("@/features/document-editing/server/version-reader")>("@/features/document-editing/server/version-reader"),readVersionedCanonical:mocks.canonical,readVersion:mocks.version,readVersionContent:mocks.content}))
vi.mock("@/features/document-editing/lib/room-client",async()=>({...await vi.importActual<typeof import("@/features/document-editing/lib/room-client")>("@/features/document-editing/lib/room-client"),readDocumentRoom:mocks.room,readDocumentRoomTail:mocks.tail}))
vi.mock("@/features/document-editing/server/version-staging",()=>({reserveVersionCommit:mocks.reserve,abandonVersionStage:mocks.abandon}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}))
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const stamp="2026-10-14T00:00:00Z"
const source={provider:"coach_house" as const,organizationId:id(1),fileId:id(2)}
const input={source,requestId:id(3),generation:id(4),expectedRevision:"original",expectedUpdatedAt:stamp,sequence:0}
function seed(sourceText="# Complete file") {
  const doc=prosemirrorJSONToYDoc(markdownDocumentSchema(),createMarkdownAdapter().parse(sourceText),"content")
  const checkpoint="\\x"+Buffer.from(Y.encodeStateAsUpdate(doc)).toString("hex")
  doc.destroy();return checkpoint
}
const room={id:id(5),org_id:id(1),file_id:id(2),generation:id(4),base_revision:"original",base_updated_at:stamp,
  checkpoint:seed(),checkpoint_sequence:0,last_sequence:0,canonical_sequence:0,recovery_bytes:0}
const receipt={versionId:id(6),requestId:id(3),fileId:id(2),generation:id(4),revision:"saved",updatedAt:stamp,sequence:0,restoredFrom:null}
const version:DocumentVersion={id:id(6),org_id:id(1),file_id:id(2),request_id:id(3),actor_id:id(1),
  storage_path:versionPath(source,id(3)),name:"notes.md",mime_type:"text/markdown",size_bytes:15,
  content_hash:contentHash("# Complete file"),revision:"saved",source_updated_at:stamp,generation:id(4),sequence:0,restored_from:null,
  request_context:{generation:id(4),expectedRevision:"original",expectedUpdatedAt:stamp,sequence:0,restoreVersionId:null},created_at:stamp}
const exportClient=createClient<Database>("http://127.0.0.1:1","fixture-key",{auth:{persistSession:false,autoRefreshToken:false}})
const client={storage:{from:()=>({remove:mocks.remove})}}
beforeEach(()=>{
  vi.resetAllMocks()
  mocks.actor.mockResolvedValue({source,userId:id(1),supabase:client,editable:true,file:{updated_at:stamp}})
  mocks.room.mockResolvedValue(room)
  mocks.canonical.mockResolvedValue({source,name:"notes.md",revision:"original",updatedAt:stamp,content:"# Complete file"})
  mocks.version.mockResolvedValue(null)
  mocks.admin.mockReturnValue({storage:{from:()=>({upload:mocks.upload})},rpc:mocks.rpc})
  mocks.upload.mockResolvedValue({error:null})
  mocks.reserve.mockResolvedValue(true)
  mocks.abandon.mockImplementation(async (_client,_args,paths)=>{await mocks.remove(paths);return true})
  mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:receipt,error:null})})
  mocks.remove.mockResolvedValue({error:null})
})
describe("canonical file version save boundary",()=>{
  it("validates source/request contracts and refuses fabricated fields",()=>{
    expect(documentCommitSchema.safeParse({...input,actorId:id(9)}).success).toBe(false)
    expect(documentCommitSchema.safeParse({...input,sequence:-1}).success).toBe(false)
    expect(documentCommitSchema.safeParse({...input,sequence:Number.MAX_SAFE_INTEGER+1}).success).toBe(false)
  })
  it("stages immutable server-exported bytes and commits only with current verified actor",async()=>{
    expect(await commitDocumentVersion(input)).toEqual(receipt)
    expect(mocks.upload).toHaveBeenCalledWith(version.storage_path,new TextEncoder().encode("# Complete file"),expect.objectContaining({upsert:false}))
    expect(mocks.rpc).toHaveBeenCalledWith("commit_uploaded_document_version",expect.objectContaining({p_actor_id:id(1),p_file_id:id(2),p_generation:id(4),p_sequence:0,p_new_hash:contentHash("# Complete file")}))
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it("denies current readonly access before any staged upload or receipt response",async()=>{
    mocks.actor.mockResolvedValue({source,userId:id(1),supabase:client,editable:false})
    await expect(commitDocumentVersion(input)).rejects.toMatchObject({code:"access"})
    expect(mocks.version).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("returns an exact historical receipt on retry without downloading or uploading",async()=>{
    mocks.version.mockResolvedValue(version)
    expect(await commitDocumentVersion(input)).toEqual(receipt)
    expect(mocks.canonical).not.toHaveBeenCalled();expect(mocks.room).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled()
    expect(()=>receiptFromVersion(version,{...input,sequence:1},id(1))).toThrow("different request")
    expect(()=>receiptFromVersion(version,input,id(9))).toThrow("different request")
  })
  it("rejects changed source metadata or generation before upload",async()=>{
    mocks.room.mockResolvedValueOnce({...room,generation:id(9)})
    await expect(commitDocumentVersion(input)).rejects.toMatchObject({code:"conflict"})
    mocks.canonical.mockResolvedValueOnce({revision:"external",updatedAt:stamp})
    await expect(commitDocumentVersion(input)).rejects.toMatchObject({code:"conflict"})
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("verifies immutable staged bytes rather than overwriting after an upload conflict",async()=>{
    mocks.upload.mockResolvedValue({error:{statusCode:"409"}})
    mocks.content.mockResolvedValue("# Complete file")
    await expect(commitDocumentVersion(input)).resolves.toEqual(receipt)
    expect(mocks.content).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({content_hash:version.content_hash,storage_path:version.storage_path}))
    expect(mocks.upload).toHaveBeenCalledTimes(2)
  })
  it("never commits or removes a duplicate stage whose bytes cannot be verified",async()=>{
    mocks.upload.mockResolvedValue({error:{statusCode:"409"}})
    mocks.content.mockRejectedValue(new Error("wrong bytes"))
    await expect(commitDocumentVersion(input)).rejects.toThrow("wrong bytes")
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.remove).not.toHaveBeenCalled()
  })
  it("checks for a committed receipt after a lost response and never deletes committed bytes",async()=>{
    mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({error:{code:"TIMEOUT"}})})
    mocks.version.mockResolvedValueOnce(null).mockResolvedValueOnce(version)
    expect(await commitDocumentVersion(input)).toEqual(receipt)
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it("retains staged bytes on unknown commit outcomes or unavailable receipt reads",async()=>{
    mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({error:{code:"TIMEOUT"}})})
    await expect(commitDocumentVersion(input)).rejects.toMatchObject({code:"unavailable"})
    expect(mocks.remove).not.toHaveBeenCalled()
    mocks.version.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("offline"))
    mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({error:{code:"40001"}})})
    await expect(commitDocumentVersion(input)).rejects.toMatchObject({code:"conflict"})
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it("fences confirmed failed transactions before service storage cleanup",async()=>{
    mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({error:{code:"40001"}})})
    await expect(commitDocumentVersion(input)).rejects.toMatchObject({code:"conflict"})
    expect(mocks.remove).toHaveBeenCalledWith([version.storage_path,version.storage_path.replace(".md","-previous.md")])
  })
  it("rejects restore while shared drafts remain unsaved",async()=>{
    mocks.room.mockResolvedValue({...room,last_sequence:1})
    await expect(commitDocumentVersion({...input,sequence:1,restoreVersionId:id(7)})).rejects.toThrow("Save the shared draft")
    expect(mocks.content).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("restores verified prior bytes into a new generation without losing their BOM",async()=>{
    const restored={...version,id:id(7)}
    mocks.version.mockResolvedValueOnce(null).mockResolvedValueOnce(restored)
    mocks.content.mockResolvedValue("\uFEFF# Restored")
    mocks.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:{...receipt,generation:id(8),restoredFrom:id(7)},error:null})})
    const result=await commitDocumentVersion({...input,restoreVersionId:id(7)})
    expect(result.generation).toBe(id(8))
    expect(mocks.upload.mock.calls[0][1]).toEqual(new TextEncoder().encode("\uFEFF# Restored"))
    expect(mocks.rpc).toHaveBeenCalledWith("commit_uploaded_document_version",expect.objectContaining({p_restore_version_id:id(7),p_restore_checkpoint_base64:expect.any(String)}))
  })
})
describe("authoritative Markdown export fidelity",()=>{
  it("exports the fixed durable prefix rather than a caller-supplied document, preserving BOM",async()=>{
    expect(await serializeDocumentPrefix(exportClient,room,0,true)).toBe("\uFEFF# Complete file")
    expect(mocks.tail).not.toHaveBeenCalled()
  })
  it("refuses a compacted/missing prefix without fabricating a Save",async()=>{
    await expect(serializeDocumentPrefix(exportClient,{...room,checkpoint_sequence:1,last_sequence:1},0,false)).rejects.toMatchObject({code:"conflict"})
  })
  it("refuses unsafe addresses and unsupported Markdown rather than silently stripping them",()=>{
    expect(()=>prepareRestoredMarkdown("[Unsafe](javascript:alert)" )).toThrow("unsupported address")
    expect(()=>prepareRestoredMarkdown("![Unsafe](data:image/png;base64,abc)" )).toThrow("unsupported address")
    expect(()=>prepareRestoredMarkdown("<script>bad()</script>" )).toThrow("original is unchanged")
  })
})
