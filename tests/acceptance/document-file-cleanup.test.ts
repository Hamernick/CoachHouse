import { beforeEach, describe, expect, it, vi } from "vitest"
import { permanentlyPurgeDocument, reconcileAbandonedDocumentStages } from "@/features/document-editing/server/file-cleanup"
const mocks=vi.hoisted(()=>({admin:vi.fn(),rpc:vi.fn(),remove:vi.fn()}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}))
const org="10000000-0000-4000-8000-000000000001",file="10000000-0000-4000-8000-000000000002",actor={actorId:org,support:false}
const paths=[`${org}/library/original.md`,`${org}/library/versions/${file}/10000000-0000-4000-8000-000000000003.md`]
beforeEach(()=>{vi.resetAllMocks();mocks.admin.mockReturnValue({rpc:mocks.rpc,storage:{from:()=>({remove:mocks.remove})}});mocks.remove.mockResolvedValue({error:null});mocks.rpc.mockImplementation(async(name:string)=>({data:name==="reserve_document_file_purge"?{fileId:file,paths,complete:false}:true,error:null}))})
describe("version-aware document physical cleanup",()=>{
 it("deletes only the frozen exact path set before finishing metadata",async()=>{
  expect(await permanentlyPurgeDocument(org,file,actor)).toEqual({ok:true});expect(mocks.admin).toHaveBeenCalledWith({actorId:org,requestTimeoutMs:15000});expect(mocks.remove).toHaveBeenCalledWith(paths)
  expect(mocks.rpc.mock.calls.map(call=>call[0])).toEqual(["reserve_document_file_purge","finish_document_file_purge"])
  expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[1])
 })
 it("retains reservation and quota after partial Storage failure, then retries the same paths",async()=>{
  mocks.remove.mockResolvedValueOnce({error:{message:"partial failure"}})
  expect(await permanentlyPurgeDocument(org,file,actor)).toMatchObject({ok:false,status:503});expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(await permanentlyPurgeDocument(org,file,actor)).toEqual({ok:true});expect(mocks.remove.mock.calls).toEqual([[paths],[paths]])
 })
 it("recovers an already complete deletion without touching Storage",async()=>{
  mocks.rpc.mockResolvedValue({data:{fileId:file,paths,complete:true},error:null});expect(await permanentlyPurgeDocument(org,file,actor)).toEqual({ok:true});expect(mocks.remove).not.toHaveBeenCalled()
 })
 it("does not trust foreign paths or another file receipt",async()=>{
  for(const data of [{fileId:file,paths:["other/library/file.md"],complete:false},{fileId:org,paths,complete:false}]){mocks.rpc.mockResolvedValue({data,error:null});expect(await permanentlyPurgeDocument(org,file,actor)).toMatchObject({ok:false,status:503})}
  expect(mocks.remove).not.toHaveBeenCalled()
 })
 it("keeps access/conflict/unknown outcomes distinct without starting deletion",async()=>{
  for(const [code,status] of [["42501",403],["PT409",409],["57014",503]] as const){mocks.rpc.mockResolvedValue({data:null,error:{code}});expect(await permanentlyPurgeDocument(org,file,actor)).toMatchObject({ok:false,status})}expect(mocks.remove).not.toHaveBeenCalled()
 })
 it("retains the reservation when final absence cannot be confirmed",async()=>{
  mocks.rpc.mockImplementation(async(name:string)=>name==="reserve_document_file_purge"?{data:{fileId:file,paths,complete:false},error:null}:{data:null,error:{code:"PT409"}})
  expect(await permanentlyPurgeDocument(org,file,actor)).toMatchObject({ok:false,status:409})
 })
 it("bounds abandoned work, retains failed operations, and does not invent staged cancellation",async()=>{
  const stages=[3,4].map(n=>({fileId:file,requestId:`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`,actorId:org,paths}));mocks.rpc.mockResolvedValueOnce({data:stages,error:null});mocks.remove.mockResolvedValueOnce({error:{message:"partial"}})
  await reconcileAbandonedDocumentStages(org,actor);expect(mocks.remove).toHaveBeenCalledTimes(2);expect(mocks.rpc.mock.calls.map(call=>call[0])).toEqual(["read_abandoned_document_stages","finish_abandoned_document_version"]);expect(mocks.rpc.mock.calls[1][1].p_request_id).toBe(stages[1].requestId)
 })
})
