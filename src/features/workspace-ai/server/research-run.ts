import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { reserveAiRun,claimAiRun,settleAiRun,correlateAiResearchResponse,reconcileAiRun,readAiRun } from "@/features/ai-credits"
import { researchRequestSchema, researchResultSchema, type ResearchTarget } from "../research-types"
import { loadResearchContext } from "./research-context"
import { researchConfig } from "./research-config"
import { runResearchProvider } from "./research-provider"
import { readAiRequestBody } from "./request-body"

export const researchRunSchema=z.object({id:z.uuid(),status:z.string(),target:z.object({kind:z.literal("particle_research"),organizationId:z.uuid(),objectiveId:z.uuid(),revision:z.number(),canvasId:z.string().nullable().optional(),userId:z.uuid().optional()}),proposal:z.string().nullable(),charged_credits:z.number().nullable(),cancel_requested_at:z.string().nullable()})
export async function readResearchRun(id:string,target:ResearchTarget) {
  z.uuid().parse(id)
  const context=await loadResearchContext(target,false)
  const run=researchRunSchema.parse(await readAiRun(id,target.organizationId,context.user.id))
  if(run.target.objectiveId!==target.objectiveId || run.target.organizationId!==target.organizationId) throw new Error("Research belongs to another objective.")
  return {id:run.id,status:run.status,credits:run.charged_credits,result:run.status==="succeeded"&&run.proposal?researchResultSchema.parse(JSON.parse(run.proposal)):null}
}
export async function handleWorkspaceResearch(request:Request) {
  const headers={"Cache-Control":"no-store"}
  if(request.headers.get("origin")!==new URL(request.url).origin) return Response.json({error:"Request origin not allowed."},{status:403,headers})
  let reserved:string|null=null, responseId:string|null=null
  try {
    const input=researchRequestSchema.parse(await readAiRequestBody(request)), context=await loadResearchContext(input.target), config=researchConfig()
    if(input.tariffVersion!==config.tariff.version || input.maximumCredits!==config.maxCredits) throw new Error("Research pricing changed. Review the current maximum.")
    const target={...input.target,kind:"particle_research",userId:context.user.id,canvasId:context.canvasId}
    const hash=createHash("sha256").update(JSON.stringify({target,prompt:input.prompt,skill:input.skill,tariff:config.tariff})).digest("hex")
    const reservation=await reserveAiRun({id:input.id,organizationId:input.target.organizationId,actorId:context.user.id,hash,target,task:"research",prompt:input.prompt,tariff:config.tariff,maxCredits:config.maxCredits,maxCost:config.maxCost})
    if(!reservation.created) return Response.json({run:await readResearchRun(input.id,input.target)},{headers})
    reserved=input.id
    if(!await claimAiRun(input.id,context.user.id)) {
      await settleAiRun({id:input.id,status:"canceled",usage:{input:0,cachedInput:0,output:0},tariff:config.tariff,maxCredits:config.maxCredits,proposal:null,responseId:null})
      return Response.json({run:await readResearchRun(input.id,input.target)},{headers})
    }
    const outcome=await runResearchProvider({request:input,context,config,
      onResponse:async id=>{responseId=id;await correlateAiResearchResponse(input.id,id)},
      isCanceled:async()=>{
        // The ledger read checks current membership in SQL without reloading the board.
        const run=researchRunSchema.parse(await readAiRun(input.id,input.target.organizationId,context.user.id))
        return Boolean(run.cancel_requested_at)||run.status!=="running"
      },
    })
    await settleAiRun({id:input.id,status:outcome.canceled?"canceled":outcome.result?"succeeded":"failed",usage:outcome.usage,tariff:config.tariff,maxCredits:config.maxCredits,proposal:outcome.result?JSON.stringify(outcome.result):null,responseId:outcome.responseId})
    return Response.json({run:await readResearchRun(input.id,input.target)},{headers})
  } catch(error) {
    if(reserved) await reconcileAiRun(reserved,responseId).catch(()=>undefined)
    return Response.json({error:reserved?"Research interrupted. Check status before starting another run.":error instanceof Error?error.message:"Research unavailable.",reserved:Boolean(reserved)},{status:400,headers})
  }
}
