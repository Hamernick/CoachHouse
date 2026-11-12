import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ context: vi.fn(), admin: vi.fn(), rpc: vi.fn() }))
vi.mock("@/features/member-workspace/server/project-asset-folder-context", () => ({ projectAssetFolderContext: mocks.context }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
import { loadProjectFolderAccess, saveProjectFolderAccess } from "@/features/member-workspace/server/project-folder-access-actions"
const orgId="99500000-0000-4000-8000-000000000001",actor="99500000-0000-4000-8000-000000000002"
const target={projectId:orgId,folderId:actor,actionScope:"workspace"}
const data={name:"Home",deleted:false,restricted:false,canManage:false,revision:0,members:[{id:orgId,name:"Owner",owner:true,capability:"manage"}]}
beforeEach(()=>{vi.resetAllMocks();mocks.context.mockResolvedValue({actor:{userId:actor}});mocks.admin.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data,error:null})})
describe("folder access controls",()=>{
 it("derives actor and default scope; reads current database authority",async()=>{
  expect(await loadProjectFolderAccess(target)).toEqual({data})
  expect(mocks.admin).toHaveBeenCalledWith({actorId:actor,requestTimeoutMs:10000})
  expect(mocks.rpc).toHaveBeenCalledWith("project_folder_access_review",{p_project_id:orgId,p_folder_id:actor,p_actor_id:actor})
 })
 it.each([null,{...target,actorId:orgId},{...target,folderId:"imagined"}])("rejects malformed or actor-bearing input",async input=>{
  expect(await loadProjectFolderAccess(input)).toHaveProperty("code","invalid");expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("does not call elevated RPC when project/fiscal/feature authority denies",async()=>{
  mocks.context.mockRejectedValue(new Error("denied"));expect(await loadProjectFolderAccess(target)).toHaveProperty("code","denied");expect(mocks.admin).not.toHaveBeenCalled()
 })
 it("writes only reviewed revision/member capabilities",async()=>{
  const members=[{memberId:actor,capability:"view"}]
  await saveProjectFolderAccess({...target,revision:3,members})
  expect(mocks.rpc).toHaveBeenCalledWith("project_folder_access_review",{p_project_id:orgId,p_folder_id:actor,p_actor_id:actor,p_expected_revision:3,p_members:members})
 })
 it.each([{revision:-1,members:[]},{revision:0,members:[{memberId:actor,capability:"admin"}]},{revision:0,members:[],restricted:true},{revision:0,members:[{memberId:actor,capability:"view"},{memberId:actor,capability:"edit"}]}])("rejects invalid/activation writes",async change=>{
  expect(await saveProjectFolderAccess({...target,...change})).toHaveProperty("code","invalid");expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it.each([["40001","conflict"],["42501","denied"],["500","unavailable"]])("maps %s without disclosing raw data",async(code,expected)=>{
  mocks.rpc.mockResolvedValue({error:{code,message:"secret"},data});const result=await loadProjectFolderAccess(target)
  expect(result).toHaveProperty("code",expected);expect(JSON.stringify(result)).not.toContain("secret");expect(result).not.toHaveProperty("data")
 })
 it("rejects malformed response and transport failure",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{...data,revision:-1}}).mockRejectedValueOnce(new Error("secret"))
  expect(await loadProjectFolderAccess(target)).toHaveProperty("code","unavailable")
  expect(await loadProjectFolderAccess(target)).toHaveProperty("code","unavailable")
 })
 it("sends only explicit workspace patches with the reviewed audience revision",async()=>{
  const workspaceChanges=[{canvasId:actor,revision:7,capability:null}]
  await saveProjectFolderAccess({...target,revision:3,members:[],workspaceChanges})
  expect(mocks.rpc).toHaveBeenCalledWith("project_folder_access_review",{p_project_id:orgId,p_folder_id:actor,p_actor_id:actor,p_expected_revision:3,p_members:[],p_workspace_changes:workspaceChanges})
 })
 it.each([
  [{canvasId:"foreign",revision:0,capability:"view"}],
  [{canvasId:actor,revision:-1,capability:"view"}],
  [{canvasId:actor,revision:0,capability:"admin"}],
  [{canvasId:actor,revision:0,capability:"view",orgId}],
  [{canvasId:actor,revision:0,capability:"view"},{canvasId:actor,revision:0,capability:null}],
 ].map(workspaceChanges=>({workspaceChanges})))("rejects malformed workspace patches",async({workspaceChanges})=>{
  expect(await saveProjectFolderAccess({...target,revision:0,members:[],workspaceChanges})).toHaveProperty("code","invalid")
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("accepts current workspace metadata and rejects invalid permission responses",async()=>{
  const workspaces=[{id:actor,name:"Programs",revision:1,capability:null,canManage:true}]
  mocks.rpc.mockResolvedValueOnce({data:{...data,workspaces}}).mockResolvedValueOnce({data:{...data,workspaces:[{...workspaces[0],capability:"admin"}]}})
  expect(await loadProjectFolderAccess(target)).toHaveProperty("data.workspaces",workspaces)
  expect(await loadProjectFolderAccess(target)).toHaveProperty("code","unavailable")
 })

})
