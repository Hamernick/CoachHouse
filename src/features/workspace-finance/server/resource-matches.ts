import "server-only"
import { z } from "zod"
import { randomUUID } from "node:crypto"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { canManageWorkspaceFinance, canViewWorkspaceFinance } from "@/lib/workspace/workspace-finance-access"
import { allWorkspaceStates } from "@/features/workspace-management"
import { readParticleGraph } from "@/features/workspace-particles"
import { type Json, type Database } from "@/lib/supabase"
import { resourceMatchTargetSchema, fundingNeedSchema, fundingReviewInputSchema, officialOpportunityNoticeSchema, opportunityMatchSnapshotSchema, type ResourceMatchTarget, type ResourceOpportunityMatch } from "../matching-types"
import { matchOpportunity, opportunityValueLabel } from "../lib/opportunity-matching"
import { discoverOfficialOpportunities, fetchOfficialOpportunity } from "./opportunity-discovery"
import { mapOrganizationFinanceOpportunity } from "./opportunities"
import { opportunityReportSchema } from "../lib/opportunity-report"
import { clearMatchReview, needForNotice, noticeFingerprint } from "./match-review"

const rowSchema = z.object({ id:z.uuid(),updated_at:z.string().datetime({offset:true}),resource_revision:z.number().int(),notice:officialOpportunityNoticeSchema,need:fundingNeedSchema,assessment:opportunityMatchSnapshotSchema,status:z.enum(["new","saved","dismissed"]),opportunity_id:z.uuid().nullable() })
async function context(input:unknown, writing:boolean) {
  const target=resourceMatchTargetSchema.parse(input), actor=await resolveAuthenticatedAppContext()
  if(actor.activeOrg.orgId!==target.organizationId) throw new Error("Your organization changed. Reopen opportunities.")
  const access={activeOrg:actor.activeOrg,supabase:actor.supabase,userId:actor.user.id}
  if(!await (writing?canManageWorkspaceFinance:canViewWorkspaceFinance)(access)) throw new Error("Finance access is required to view or manage matches.")
  const {data,error}=await actor.supabase.from("organization_workspace_boards").select("state").eq("org_id",target.organizationId).abortSignal(AbortSignal.timeout(10000)).maybeSingle()
  if(error) throw new Error("Workspace unavailable.")
  const resources=allWorkspaceStates(data?.state).flatMap(canvas=>{
    const graph=readParticleGraph(canvas.state.particleGraph,target.organizationId)
    if(!graph.ok)return []
    return graph.value.particles.flatMap(resource=>resource.id===target.resourceId&&resource.type==="activity"?[{resource,canvasId:canvas.id}]:[])
  })
  if(resources.length!==1||resources[0].resource.revision!==target.resourceRevision)throw new Error("Resource changed. Reopen opportunities from the current resource.")
  return {...actor,...resources[0],target}
}
async function rpc(ctx:Awaited<ReturnType<typeof context>>,action:string,payload:Json=[]) {
  const {data,error}=await createSupabaseAdminClient().rpc("manage_resource_opportunity_matches",{p_action:action,p_org_id:ctx.target.organizationId,p_actor_id:ctx.user.id,p_resource_id:ctx.resource.id,p_revision:ctx.resource.revision,p_canvas_id:ctx.canvasId,p_payload:payload})
  if(error)throw new Error(error.code==="40001"?"This resource or match changed. Refresh before retrying.":"Opportunity matches could not be saved or loaded.")
  const parsed=z.object({matches:z.array(rowSchema).max(50),opportunity:z.unknown().nullable()}).parse(data)
  const matches:ResourceOpportunityMatch[]=parsed.matches.map(row=>{
    const need=needForNotice(row.need,row.notice)
    return {id:row.id,updatedAt:row.updated_at,notice:row.notice,need,assessment:matchOpportunity(row.notice,need),status:row.status,stale:row.resource_revision!==ctx.resource.revision,opportunityId:row.opportunity_id}
  })
  return {matches,opportunity:parsed.opportunity?mapOrganizationFinanceOpportunity(parsed.opportunity as Database["public"]["Tables"]["organization_finance_opportunities"]["Row"]):null}
}
export async function loadResourceMatches(target:ResourceMatchTarget) { return rpc(await context(target,false),"list") }
export async function searchResourceMatches(input:unknown) {
  const request=z.strictObject({target:resourceMatchTargetSchema,keyword:z.string().trim().min(2).max(100),need:fundingReviewInputSchema}).parse(input)
  const ctx=await context(request.target,true)
  if(request.need.resourceId!==ctx.resource.id||request.need.resourceRevision!==ctx.resource.revision)throw new Error("Funding need belongs to another resource revision.")
  // Only the explicitly entered public keyword reaches Grants.gov; budgets and organization data stay private.
  const found=await discoverOfficialOpportunities({keyword:request.keyword})
  if(found.unavailable && !found.notices.length)throw new Error("Official details are temporarily unavailable. Try again later.")
  const existing=await rpc(ctx,"list",{externalIds:found.notices.map(notice=>notice.externalId)})
  const rows=found.notices.map(notice=>{
    const previous=existing.matches.find(match=>match.notice.externalId===notice.externalId)
    const need=previous&&!previous.stale?needForNotice(previous.need,notice):clearMatchReview(request.need)
    return {notice,need,assessment:matchOpportunity(notice,need,found.observedAt),...(previous?{expectedUpdatedAt:previous.updatedAt}:{insertOnly:true})}
  })
  const saved=await rpc(ctx,"put",rows as unknown as Json)
  return {...saved,checked:found.checked,unavailable:found.unavailable,found:found.notices.length}
}
function reportFor(match:ResourceOpportunityMatch,resourceTitle:string) {
  const fact=(label:string,value:string)=>({id:randomUUID(),label,value:value.slice(0,500)})
  return opportunityReportSchema.parse({version:1,blocks:[
    {id:randomUUID(),kind:"text",title:"Opportunity",text:match.notice.summary.slice(0,6000)},
    {id:randomUUID(),kind:"facts",title:"Published facts",items:[fact("Award",opportunityValueLabel(match.notice)),fact("Program total",match.notice.fundingPoolCents===null?"Not published":new Intl.NumberFormat("en-US",{style:"currency",currency:match.notice.currency}).format(match.notice.fundingPoolCents/100)),fact("Deadline",match.notice.deadlineDate??"Confirm in official notice"),fact("Last checked",match.notice.verifiedAt),fact("Target resource",resourceTitle)]},
    {id:randomUUID(),kind:"text",title:"Eligibility review",text:match.assessment.criteria.map(c=>`${c.outcome}: ${c.explanation}`).join("\n").slice(0,6000)},
  ]})
}
export async function changeResourceMatch(input:unknown) {
  const request=z.strictObject({target:resourceMatchTargetSchema,id:z.uuid(),updatedAt:z.iso.datetime({offset:true}),action:z.enum(["save","dismiss","restore"])}).parse(input)
  const ctx=await context(request.target,true)
  let state=await rpc(ctx,"list"), match=state.matches.find(m=>m.id===request.id)
  if(!match||match.updatedAt!==request.updatedAt)throw new Error("Match changed. Refresh before retrying.")
  if(request.action!=="save")return rpc(ctx,request.action,{id:match.id,updatedAt:match.updatedAt})
  if(match.stale)throw new Error("Resource changed. Search again before saving this match.")
  const fresh={...await fetchOfficialOpportunity(match.notice.externalId),discoveredAt:match.notice.discoveredAt}
  const need=needForNotice(match.need,fresh),assessment=matchOpportunity(fresh,need)
  const changed=noticeFingerprint(fresh)!==noticeFingerprint(match.notice)
  state=await rpc(ctx,"put",[{notice:fresh,need,assessment,expectedUpdatedAt:match.updatedAt}] as unknown as Json)
  match=state.matches.find(m=>m.id===request.id)!
  if(changed||!assessment.active)return {...state,reviewRequired:true}
  return rpc(ctx,"save",{id:match.id,updatedAt:match.updatedAt,report:reportFor(match,ctx.resource.title)} as unknown as Json)
}

export async function reviewResourceMatch(input:unknown) {
  const request=z.strictObject({target:resourceMatchTargetSchema,id:z.uuid(),updatedAt:z.iso.datetime({offset:true}),need:fundingReviewInputSchema}).parse(input)
  const ctx=await context(request.target,true)
  if(request.need.resourceId!==ctx.resource.id||request.need.resourceRevision!==ctx.resource.revision)throw new Error("Funding need belongs to another resource revision.")
  const state=await rpc(ctx,"list"),match=state.matches.find(item=>item.id===request.id)
  if(!match||match.updatedAt!==request.updatedAt)throw new Error("Match changed. Reopen the review before retrying.")
  if(match.stale)throw new Error("Resource changed. Search again before reviewing this match.")
  const notice={...await fetchOfficialOpportunity(match.notice.externalId),discoveredAt:match.notice.discoveredAt}
  if(noticeFingerprint(notice)!==noticeFingerprint(match.notice)) {
    const need=needForNotice(match.need,notice),assessment=matchOpportunity(notice,need)
    return {...await rpc(ctx,"put",[{notice,need,assessment,expectedUpdatedAt:match.updatedAt}] as unknown as Json),reviewRequired:true}
  }
  if(!matchOpportunity(notice,request.need).active)throw new Error("This notice is no longer current. Your review was not applied.")
  const need={...request.need,review:{actorId:ctx.user.id,reviewedAt:new Date().toISOString(),noticeFingerprint:noticeFingerprint(notice)}}
  return {...await rpc(ctx,"put",[{notice,need,assessment:matchOpportunity(notice,need),expectedUpdatedAt:match.updatedAt}] as unknown as Json),reviewRequired:false}
}
