import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ context: vi.fn(), admin: vi.fn(), rpc: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveOptionalAuthenticatedAppContext: mocks.context }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
import { loadWorkspaceAccess, saveWorkspaceAccess } from "@/features/workspace-management/access-actions"
import { listRetainedWorkspaceAccess } from "@/features/workspace-management/retained-access-actions"
const orgId="99500000-0000-4000-8000-000000000001",actor="99500000-0000-4000-8000-000000000002"
const target={orgId,canvasId:null}
const data={name:"Home",deleted:false,restricted:false,canManage:false,revision:0,members:[{id:orgId,name:"Owner",owner:true,capability:"manage"}]}
beforeEach(()=>{vi.resetAllMocks();mocks.context.mockResolvedValue({activeOrg:{orgId},user:{id:actor}});mocks.admin.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data,error:null})})
describe("workspace access controls",()=>{
 it("derives actor and default scope; reads current database authority",async()=>{
  expect(await loadWorkspaceAccess(target)).toEqual({data})
  expect(mocks.admin).toHaveBeenCalledWith({actorId:actor,requestTimeoutMs:10000})
  expect(mocks.rpc).toHaveBeenCalledWith("workspace_access_control",{p_org_id:orgId,p_canvas_id:"default",p_actor_id:actor})
 })
 it.each([null,{...target,actorId:orgId},{...target,canvasId:"imagined"}])("rejects malformed or actor-bearing input",async input=>{
  expect(await loadWorkspaceAccess(input)).toHaveProperty("code","invalid");expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it.each([null,{activeOrg:{orgId:actor},user:{id:actor}}])("rejects missing or switched authentication",async context=>{
  mocks.context.mockResolvedValue(context);expect(await loadWorkspaceAccess(target)).toHaveProperty("code","denied");expect(mocks.admin).not.toHaveBeenCalled()
 })
 it("writes only reviewed revision/member capabilities",async()=>{
  const members=[{memberId:actor,capability:"view"}]
  await saveWorkspaceAccess({...target,revision:3,members})
  expect(mocks.rpc).toHaveBeenCalledWith("workspace_access_control",{p_org_id:orgId,p_canvas_id:"default",p_actor_id:actor,p_expected_revision:3,p_members:members})
 })
 it.each([{revision:-1,members:[]},{revision:0,members:[{memberId:actor,capability:"admin"}]},{revision:0,members:[],restricted:true},{revision:0,members:[{memberId:actor,capability:"view"},{memberId:actor,capability:"edit"}]}])("rejects invalid/activation writes",async change=>{
  expect(await saveWorkspaceAccess({...target,...change})).toHaveProperty("code","invalid");expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it.each([["40001","conflict"],["42501","denied"],["500","unavailable"]])("maps %s without disclosing raw data",async(code,expected)=>{
  mocks.rpc.mockResolvedValue({error:{code,message:"secret"},data});const result=await loadWorkspaceAccess(target)
  expect(result).toHaveProperty("code",expected);expect(JSON.stringify(result)).not.toContain("secret");expect(result).not.toHaveProperty("data")
 })
 it("rejects malformed response and transport failure",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{...data,revision:-1}}).mockRejectedValueOnce(new Error("secret"))
  expect(await loadWorkspaceAccess(target)).toHaveProperty("code","unavailable")
  expect(await loadWorkspaceAccess(target)).toHaveProperty("code","unavailable")
 })
})

describe("retained workspace discovery",()=>{
 const page={items:[{canvasId:actor}],nextAfter:null}
 it("lists through the verified actor and bounded cursor command",async()=>{
  mocks.rpc.mockResolvedValue({data:page,error:null})
  expect(await listRetainedWorkspaceAccess({orgId})).toEqual({data:page})
  expect(mocks.admin).toHaveBeenCalledWith({actorId:actor,requestTimeoutMs:10000})
  expect(mocks.rpc).toHaveBeenCalledWith("list_retained_workspace_access",{p_org_id:orgId,p_actor_id:actor,p_after:null})
  await listRetainedWorkspaceAccess({orgId,after:actor})
  expect(mocks.rpc).toHaveBeenLastCalledWith("list_retained_workspace_access",{p_org_id:orgId,p_actor_id:actor,p_after:actor})
 })
 it.each([null,{orgId,actorId:orgId},{orgId,after:"invalid"}])("rejects invalid discovery input",async input=>{
  expect(await listRetainedWorkspaceAccess(input)).toHaveProperty("code","invalid");expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it.each([null,{activeOrg:{orgId:actor},user:{id:actor}}])("binds discovery to the current organization",async context=>{
  mocks.context.mockResolvedValue(context);expect(await listRetainedWorkspaceAccess({orgId})).toHaveProperty("code","denied");expect(mocks.admin).not.toHaveBeenCalled()
 })
 it.each([["42501","denied"],["40001","unavailable"]])("does not leak discovery errors or rows",async(code,expected)=>{
  mocks.rpc.mockResolvedValue({error:{code,message:"secret"},data:page})
  const result=await listRetainedWorkspaceAccess({orgId});expect(result).toHaveProperty("code",expected);expect(result).not.toHaveProperty("data");expect(JSON.stringify(result)).not.toContain("secret")
 })
 it("rejects malformed/oversized pages and failed transport",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{...page,items:Array(51).fill(page.items[0])}}).mockRejectedValueOnce(new Error("secret"))
  expect(await listRetainedWorkspaceAccess({orgId})).toHaveProperty("code","unavailable")
  expect(await listRetainedWorkspaceAccess({orgId})).toHaveProperty("code","unavailable")
 })
})
