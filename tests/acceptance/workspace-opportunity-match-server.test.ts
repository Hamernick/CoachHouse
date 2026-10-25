import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"
import { now, notice, need } from "./fixtures/opportunity-match-fixtures"
import { matchOpportunity } from "@/features/workspace-finance/lib/opportunity-matching"
const mock=vi.hoisted(()=>({actor:vi.fn(),view:vi.fn(),manage:vi.fn(),board:vi.fn(),canvases:vi.fn(),rpc:vi.fn(),discover:vi.fn(),detail:vi.fn()}))
vi.mock("@/lib/auth/request-context",()=>({resolveAuthenticatedAppContext:mock.actor}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mock.rpc})}))
vi.mock("@/lib/workspace/workspace-finance-access",()=>({canManageWorkspaceFinance:mock.manage,canViewWorkspaceFinance:mock.view}))
vi.mock("@/features/workspace-management",()=>({allWorkspaceStates:mock.canvases}))
vi.mock("@/features/workspace-finance/server/opportunity-discovery",()=>({discoverOfficialOpportunities:mock.discover,fetchOfficialOpportunity:mock.detail}))
import { changeResourceMatch, loadResourceMatches, searchResourceMatches, reviewResourceMatch } from "@/features/workspace-finance/server/resource-matches"
import { noticeFingerprint } from "@/features/workspace-finance/server/match-review"
const target={organizationId:WORKSPACE,resourceId:ID(1),resourceRevision:0}
const timestamp="2026-10-25T12:00:00.123456+00:00"
afterEach(()=>vi.useRealTimers())
function row() {
 const n=notice(),f={...need(),resourceId:target.resourceId,resourceRevision:0}
 return {id:ID(10),updated_at:timestamp,resource_revision:0,notice:n,need:f,assessment:matchOpportunity(n,f,now),status:"new",opportunity_id:null}
}
beforeEach(()=>{
 vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date(now))
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),maybeSingle:mock.board}
 mock.actor.mockResolvedValue({user:{id:WORKSPACE},activeOrg:{orgId:WORKSPACE,role:"owner"},supabase:{from:()=>query}})
 mock.view.mockResolvedValue(true);mock.manage.mockResolvedValue(true)
 mock.board.mockResolvedValue({data:{state:{}},error:null})
 mock.canvases.mockReturnValue([{id:null,state:{particleGraph:graph([particle(1,"activity")])}}])
 mock.rpc.mockResolvedValue({data:{matches:[row()],opportunity:null},error:null})
 mock.discover.mockResolvedValue({notices:[notice()],observedAt:now,checked:1,unavailable:0})
 mock.detail.mockResolvedValue(notice())
})
describe("resource match server boundary",()=>{
 it("binds a user review to the authenticated actor and exact official notice",async()=>{
  const input={target,id:ID(10),updatedAt:timestamp,need:row().need}
  await reviewResourceMatch(input)
  const put=mock.rpc.mock.calls.find(([,args])=>args.p_action==="put")![1]
  expect(put.p_payload[0]).toMatchObject({expectedUpdatedAt:timestamp,need:{eligibilityReview:"confirmed",review:{actorId:WORKSPACE,reviewedAt:now,noticeFingerprint:noticeFingerprint(notice())}}})
  expect(mock.detail).toHaveBeenCalledExactlyOnceWith("123")
  expect(mock.rpc.mock.calls.some(([,args])=>args.p_action==="save")).toBe(false)
  await expect(reviewResourceMatch({...input,need:{...input.need,review:{actorId:ID(90),reviewedAt:now,noticeFingerprint:noticeFingerprint(notice())}}})).rejects.toThrow()
 })
 it("does not apply confirmations after a source amendment, withdrawal or stale resource",async()=>{
  mock.detail.mockResolvedValueOnce({...notice(),eligibilityText:"Changed published requirements"})
  const result=await reviewResourceMatch({target,id:ID(10),updatedAt:timestamp,need:row().need})
  expect(result.reviewRequired).toBe(true)
  const put=mock.rpc.mock.calls.find(([,args])=>args.p_action==="put")![1]
  expect(put.p_payload[0].need.eligibilityReview).toBe("unknown")
  expect(put.p_payload[0].need.review).toBeUndefined()
  await expect(reviewResourceMatch({target,id:ID(10),updatedAt:now,need:row().need})).rejects.toThrow(/Match changed/)
  await expect(reviewResourceMatch({target:{...target,resourceRevision:1},id:ID(10),updatedAt:timestamp,need:row().need})).rejects.toThrow(/Resource changed/)
 })
 it("requires management access before reviewing and rejects a mismatched funding target",async()=>{
  mock.manage.mockResolvedValueOnce(false)
  await expect(reviewResourceMatch({target,id:ID(10),updatedAt:timestamp,need:row().need})).rejects.toThrow(/Finance access/)
  expect(mock.detail).not.toHaveBeenCalled()
  await expect(reviewResourceMatch({target,id:ID(10),updatedAt:timestamp,need:{...row().need,resourceId:ID(99)}})).rejects.toThrow(/another resource/)
 })
 it("preserves reviewed need on rediscovery and guards concurrent edits",async()=>{
  const reviewed=row();reviewed.need={...reviewed.need,requestedCents:12345,review:{actorId:WORKSPACE,reviewedAt:now,noticeFingerprint:noticeFingerprint(notice())}}
  mock.rpc.mockResolvedValue({data:{matches:[reviewed],opportunity:null},error:null})
  await searchResourceMatches({target,keyword:"community",need:row().need})
  const put=mock.rpc.mock.calls.find(([,args])=>args.p_action==="put")![1]
  expect(put.p_payload[0]).toMatchObject({expectedUpdatedAt:timestamp,need:{requestedCents:12345,eligibilityReview:"confirmed"}})
  mock.rpc.mockResolvedValueOnce({data:{matches:[reviewed],opportunity:null},error:null}).mockResolvedValueOnce({data:null,error:{code:"40001"}})
  await expect(reviewResourceMatch({target,id:ID(10),updatedAt:timestamp,need:row().need})).rejects.toThrow(/changed/)
 })
 it("does not accept forged confirmations through search or retain them after a source change",async()=>{
  mock.rpc.mockResolvedValueOnce({data:{matches:[],opportunity:null},error:null})
  await searchResourceMatches({target,keyword:"community",need:row().need})
  const put=mock.rpc.mock.calls.find(([,args])=>args.p_action==="put")![1]
  expect(put.p_payload[0]).toMatchObject({insertOnly:true,need:{eligibilityReview:"unknown",restrictedCosts:"unknown",overlap:"unknown"}})
  const reviewed=row();reviewed.need={...reviewed.need,review:{actorId:WORKSPACE,reviewedAt:now,noticeFingerprint:noticeFingerprint(notice())}}
  reviewed.notice.eligibilityText="Changed requirements"
  mock.rpc.mockResolvedValue({data:{matches:[reviewed],opportunity:null},error:null})
  const result=await loadResourceMatches(target)
  expect(result.matches[0].need.review).toBeUndefined()
  expect(result.matches[0].need.eligibilityReview).toBe("unknown")
 })
 it("rejects unauthorized and foreign organizations before board or external reads",async()=>{
  mock.manage.mockResolvedValue(false)
  await expect(searchResourceMatches({target,keyword:"community",need:row().need})).rejects.toThrow(/Finance access/)
  expect(mock.board).not.toHaveBeenCalled();expect(mock.discover).not.toHaveBeenCalled()
  await expect(loadResourceMatches({...target,organizationId:ID(99)})).rejects.toThrow(/organization changed/)
 })
 it("checks the exact resource revision and rejects ambiguous resource identities",async()=>{
  await expect(loadResourceMatches({...target,resourceRevision:1})).rejects.toThrow(/Resource changed/)
  const canvas=mock.canvases();mock.canvases.mockReturnValue([...canvas,...canvas])
  await expect(loadResourceMatches(target)).rejects.toThrow(/Resource changed/)
  expect(mock.rpc).not.toHaveBeenCalled()
 })
 it("sends only explicit public keywords and binds private need to the selected resource",async()=>{
  await searchResourceMatches({target,keyword:"community",need:row().need})
  expect(mock.discover).toHaveBeenCalledExactlyOnceWith({keyword:"community"})
  expect(mock.rpc).toHaveBeenCalledWith("manage_resource_opportunity_matches",expect.objectContaining({p_actor_id:WORKSPACE,p_org_id:WORKSPACE,p_resource_id:ID(1),p_revision:0,p_action:"put"}))
  await expect(searchResourceMatches({target,keyword:"community",need:{...row().need,resourceId:ID(9)}})).rejects.toThrow(/another resource/)
 })
 it("preserves database microseconds in compare-and-swap requests",async()=>{
  const loaded=await loadResourceMatches(target)
  expect(loaded.matches[0].updatedAt).toBe(timestamp)
  await changeResourceMatch({target,id:ID(10),updatedAt:timestamp,action:"dismiss"})
  expect(mock.rpc).toHaveBeenLastCalledWith("manage_resource_opportunity_matches",expect.objectContaining({p_action:"dismiss",p_payload:{id:ID(10),updatedAt:timestamp}}))
  expect(mock.detail).not.toHaveBeenCalled()
 })
 it("revalidates official detail and passes the original CAS token before Save",async()=>{
  await changeResourceMatch({target,id:ID(10),updatedAt:timestamp,action:"save"})
  expect(mock.detail).toHaveBeenCalledExactlyOnceWith("123")
  const put=mock.rpc.mock.calls.find(([,args])=>args.p_action==="put")![1]
  expect(put.p_payload[0].expectedUpdatedAt).toBe(timestamp)
  const saved=mock.rpc.mock.calls.find(([,args])=>args.p_action==="save")![1]
  expect(saved.p_payload.report.blocks).toHaveLength(3)
 })
 it.each(["changed","withdrawn"])("requires review for %s official details before creating a saved report",async kind=>{
  mock.detail.mockResolvedValue({...notice(),...(kind==="changed"?{awardCeilingCents:2000000}:{status:"withdrawn"})})
  const result=await changeResourceMatch({target,id:ID(10),updatedAt:timestamp,action:"save"})
  expect(result).toMatchObject({reviewRequired:true})
  expect(mock.rpc.mock.calls.some(([,args])=>args.p_action==="save")).toBe(false)
 })
 it("fails closed on unavailable official details or stale match tokens",async()=>{
  mock.detail.mockRejectedValue(new Error("Source unavailable"))
  await expect(changeResourceMatch({target,id:ID(10),updatedAt:timestamp,action:"save"})).rejects.toThrow(/unavailable/)
  expect(mock.rpc.mock.calls.some(([,args])=>args.p_action==="save")).toBe(false)
  await expect(changeResourceMatch({target,id:ID(10),updatedAt:now,action:"dismiss"})).rejects.toThrow(/Match changed/)
 })
})
