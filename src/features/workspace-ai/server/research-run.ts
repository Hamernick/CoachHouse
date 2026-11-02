import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { AiAdmissionDenied, reserveAiRun,claimAiRun,settleAiRun,correlateAiResearchResponse,reconcileAiRun,readAiRun } from "@/features/ai-credits"
import { researchRequestSchema, researchResultSchema, existingResearchTargetSchema, newObjectiveTargetSchema, type ResearchTarget, type ResearchResult } from "../research-types"
import { loadResearchContext } from "./research-context"
import { researchConfig } from "./research-config"
import { runResearchProvider } from "./research-provider"
import { readAiRequestBody } from "./request-body"
import { assertResearchProvenance, assertResearchSourcesAccessible } from "./research-result-access"
import { assertInitialResearchRequestFits } from "./research-provider-request"
import { ResearchRecoveryError, researchRecoveryResponse } from "./research-recovery"
import { researchProgressStream } from "./research-progress-stream"
import type { ResearchPhase } from "../lib/research-progress"
import { researchSnapshotSchema } from "../lib/research-snapshot"
import type { ResearchItemPreview } from "../lib/research-item-preview"

const runIdentity = { kind:z.literal("particle_research"), userId:z.uuid().optional() }
export const researchRunSchema=z.object({id:z.uuid(),status:researchSnapshotSchema.shape.status,target:z.union([
  existingResearchTargetSchema.extend({...runIdentity,canvasId:z.string().nullable().optional()}),
  newObjectiveTargetSchema.extend({...runIdentity,userId:z.uuid()}),
]),proposal:z.string().nullable(),charged_credits:z.number().nullable(),cancel_requested_at:z.string().nullable()})
export async function readResearchRun(id:string,target:ResearchTarget) {
  z.uuid().parse(id)
  const context=await loadResearchContext(target,false)
  const run=researchRunSchema.parse(await readAiRun(id,target.organizationId,context.user.id))
  if(run.id!==id || run.target.mode!==target.mode || (target.mode==="new_objective" && run.target.canvasId!==target.canvasId) || run.target.objectiveId!==target.objectiveId || run.target.organizationId!==target.organizationId ||
    run.target.plan?.id!==target.plan?.id ||
    (run.target.userId!==undefined && run.target.userId!==context.user.id) || (run.target.canvasId!==undefined && run.target.canvasId!==context.canvasId)) throw new ResearchRecoveryError("scope_mismatch")
  if (target.mode === "new_objective" && run.status === "succeeded") {
    const applied = context.graph.particles.find(p => p.type === "objective" &&
      [...(p.data.planning?.plans ?? []), ...(p.data.planning?.proposals ?? [])].some(plan => plan.researchRunId === run.id))
    if (applied) return researchSnapshotSchema.parse({ version: 1, id: run.id, status: run.status, credits: run.charged_credits, result: null, appliedObjectiveId: applied.id, resultRevision: 1, applicability: "already_applied" })
  }
  let result = null
  if (run.status === "succeeded") {
    try { result = researchResultSchema.parse(JSON.parse(run.proposal ?? "null")) }
    catch { throw new ResearchRecoveryError("invalid_result") }
  }
  if (result) {
    assertResearchProvenance(result, run.id, run.target)
    await assertResearchSourcesAccessible(context, result)
  }
  return researchSnapshotSchema.parse({version:1,id:run.id,status:run.status,credits:run.charged_credits,result,
    resultRevision:result?1:null,applicability:result?"review_required":"unavailable"})
}
export async function handleWorkspaceResearch(request:Request) {
  const headers={"Cache-Control":"no-store"}
  if(request.headers.get("origin")!==new URL(request.url).origin) return Response.json({error:"Request origin not allowed."},{status:403,headers})
  let reserved:string|null=null, reservationAttempt:string|null=null, responseId:string|null=null
  try {
    const input=await (async()=>{
      try { return researchRequestSchema.parse(await readAiRequestBody(request)) }
      catch { throw new ResearchRecoveryError("invalid_request") }
    })()
    const context=await loadResearchContext(input.target), config=researchConfig()
    if(input.tariffVersion!==config.tariff.version || input.maximumCredits!==config.maxCredits) throw new ResearchRecoveryError("pricing_changed")
    assertInitialResearchRequestFits(context,input,config)
    const target={...input.target,kind:"particle_research",userId:context.user.id,canvasId:context.canvasId}
    const hash=createHash("sha256").update(JSON.stringify({target,prompt:input.prompt,skill:input.skill,tariff:config.tariff})).digest("hex")
    // A rejected transport promise cannot prove that the reservation did not commit.
    reservationAttempt=input.id
    const reservation=await reserveAiRun({id:input.id,organizationId:input.target.organizationId,actorId:context.user.id,hash,target,task:"research",prompt:input.prompt,tariff:config.tariff,maxCredits:config.maxCredits,maxCost:config.maxCost})
    if(!reservation.created) {
      try { return Response.json({run:await readResearchRun(input.id,input.target)},{headers}) }
      catch(error) { return Response.json({...researchRecoveryResponse(error),reserved:true},{status:409,headers}) }
    }
    reserved=input.id
    if(!await claimAiRun(input.id,context.user.id)) {
      await settleAiRun({id:input.id,status:"canceled",usage:{input:0,cachedInput:0,output:0},tariff:config.tariff,maxCredits:config.maxCredits,proposal:null,responseId:null})
      return Response.json({run:await readResearchRun(input.id,input.target)},{headers})
    }
    const execute = async (onPhase?: (phase: ResearchPhase) => void, onPreview?: (result: ResearchResult) => void, onPartial?: (item: ResearchItemPreview | null) => void) => {
    try {
    const outcome=await runResearchProvider({request:input,context,config,onPhase,onPartial,
      onResponse:async id=>{responseId=id;await correlateAiResearchResponse(input.id,id)},
      isCanceled:async()=>{
        // The ledger read checks current membership in SQL without reloading the board.
        const run=researchRunSchema.parse(await readAiRun(input.id,input.target.organizationId,context.user.id))
        return Boolean(run.cancel_requested_at)||run.status!=="running"
      },
    })
    if (onPreview && outcome.result && !outcome.canceled) {
      // A private preview is a new disclosure. Recheck current access and all
      // observed inputs before sending it, just as durable readback does.
      // Optional presentation failure must never interrupt usage settlement.
      try {
        const current = await loadResearchContext(input.target, false)
        const candidate = researchResultSchema.parse(outcome.result)
        if (current.user.id !== context.user.id) throw new ResearchRecoveryError("scope_mismatch")
        assertResearchProvenance(candidate, input.id, input.target)
        await assertResearchSourcesAccessible(current, candidate)
        const run = researchRunSchema.parse(await readAiRun(input.id, input.target.organizationId, context.user.id))
        if (run.id === input.id && run.status === "running" && !run.cancel_requested_at) onPreview(candidate)
      } catch { /* Withhold preview; normal settlement and authorized readback continue. */ }
    }
    onPhase?.("saving")
    await settleAiRun({id:input.id,status:outcome.canceled?"canceled":outcome.result?"succeeded":"failed",usage:outcome.usage,tariff:config.tariff,maxCredits:config.maxCredits,proposal:outcome.result?JSON.stringify(outcome.result):null,responseId:outcome.responseId})
    return Response.json({run:await readResearchRun(input.id,input.target)},{headers})
    } catch {
      await reconcileAiRun(input.id,responseId).catch(()=>undefined)
      return Response.json({...researchRecoveryResponse(new ResearchRecoveryError("run_interrupted")),reserved:true},{status:400,headers})
    }
    }
    // Opt-in qualification gate; JSON remains the default until full-app/hosted
    // transport acceptance. No new provider, ledger or autonomous execution.
    if (process.env.WORKSPACE_AI_PROGRESS_STREAM === "1" && request.headers.get("accept")?.includes("text/event-stream"))
      return researchProgressStream({runId:input.id,requestId:input.id,target:input.target,scope:{organizationId:input.target.organizationId,canvasId:context.canvasId,userId:context.user.id}},execute)
    return execute()
  } catch(error) {
    if(reservationAttempt && !reserved && error instanceof AiAdmissionDenied) {
      return Response.json({...researchRecoveryResponse(new ResearchRecoveryError(error.reason)),reserved:false},{status:409,headers})
    }
    if(reserved) await reconcileAiRun(reserved,responseId).catch(()=>undefined)
    const failure=reservationAttempt
      ? researchRecoveryResponse(new ResearchRecoveryError(reserved?"run_interrupted":"reservation_uncertain"))
      : researchRecoveryResponse(error,"admission_unavailable")
    return Response.json({...failure,reserved:Boolean(reservationAttempt)},{status:400,headers})
  }
}
