"use server"
import { z } from "zod"
import { env } from "@/lib/env"
import { creditBillingContext } from "./server/billing-context"
import { refillInputSchema, refillViewSchema, type RefillInput, type AiCreditRefill } from "./refill-types"
import { refillDb, refillSetupSchema, readRefillSetup, readRefillAttempt } from "./server/refill-store"
import { openRefillSetup, verifyRefillSetup } from "./server/refill-setup"
import { cancelRefill, chargeRefill, reconcileRefill } from "./server/refill-payment"

async function owner(organizationId:string) {
  const context=await creditBillingContext(organizationId)
  if(context.orgId!==context.actorId||!context.runtime)throw new Error("Only the organization owner can manage refill.")
  return {...context,runtime:context.runtime}
}
export async function loadCreditRefill(organizationId:string):Promise<AiCreditRefill|null> {
  const context=await creditBillingContext(organizationId)
  if(context.orgId!==context.actorId||!context.runtime)return null
  const {data,error}=await refillDb().rpc("read_ai_credit_refill",{p_input:{organizationId:context.orgId,actorId:context.actorId,mode:context.runtime.mode}})
  if(error) {
    if(process.env.WORKSPACE_AI_REFILLS_ENABLED!=="true"&&["PGRST202","42883"].includes(error.code))return null
    throw new Error("Refill status unavailable.")
  }
  if(!data)return null
  const state=refillViewSchema.parse(data)
  const canConfigure=process.env.WORKSPACE_AI_REFILLS_ENABLED==="true"&&process.env.WORKSPACE_AI_PURCHASES_ENABLED==="true"
  return canConfigure||state.setup?{...state,canConfigure}:null
}
export async function startCreditRefill(input:RefillInput) {
  const body=refillInputSchema.parse(input)
  if(process.env.WORKSPACE_AI_REFILLS_ENABLED!=="true"||process.env.WORKSPACE_AI_PURCHASES_ENABLED!=="true")throw new Error("Auto-refill is not enabled.")
  const context=await owner(body.organizationId)
  const site=env.NEXT_PUBLIC_APP_URL??env.NEXT_PUBLIC_SITE_URL
  if(!site)throw new Error("Checkout return address is not configured.")
  const url=new URL("/workspace",site)
  if(url.protocol!=="https:"&&!(context.runtime.mode==="test"&&url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))throw new Error("Setup requires a secure return address.")
  const {data,error}=await refillDb().rpc("prepare_ai_credit_refill_setup",{p_input:{...body,actorId:context.actorId,mode:context.runtime.mode,runtimeTarget:context.runtime.target,returnUrl:url.href}})
  if(error)throw new Error(error.message)
  return openRefillSetup(refillSetupSchema.parse(data),context.runtime.client)
}
export async function disableCreditRefill(organizationId:string) {
  const context=await owner(organizationId)
  const {error}=await refillDb().rpc("disable_ai_credit_refill",{p_input:{organizationId:context.orgId,actorId:context.actorId,mode:context.runtime.mode}})
  if(error)throw new Error("Unable to disable refill. Try again.")
  return loadCreditRefill(organizationId)
}
export async function checkCreditRefill(organizationId:string) {
  const context=await owner(organizationId),state=await loadCreditRefill(organizationId)
  if(state?.setup?.status==="setup") {
    const setup=await readRefillSetup(state.setup.id)
    if(setup.runtime_target!==context.runtime.target)throw new Error("Open the billing account used for this setup.")
    if(setup.checkout_session_id)await verifyRefillSetup(setup.id,setup.checkout_session_id,context.runtime.client,context.runtime.mode)
  }
  if(state?.pending) {
    const refill=await readRefillAttempt(state.pending.id)
    if(refill.setup.runtime_target!==context.runtime.target)throw new Error("Open the billing account used for this refill.")
    await reconcileRefill(refill,context.runtime.client)
  }
  return loadCreditRefill(organizationId)
}
export async function recoverCreditRefill(input:{organizationId:string;id:string;action:"retry"|"cancel"}) {
  const body=z.strictObject({organizationId:z.uuid(),id:z.uuid(),action:z.enum(["retry","cancel"])}).parse(input)
  const context=await owner(body.organizationId),refill=await readRefillAttempt(body.id)
  if(refill.setup.org_id!==context.orgId||refill.setup.actor_id!==context.actorId||refill.setup.mode!==context.runtime.mode||refill.setup.runtime_target!==context.runtime.target)throw new Error("Refill access denied.")
  if(body.action==="retry") {
    if(process.env.WORKSPACE_AI_REFILLS_ENABLED!=="true")throw new Error("Auto-refill is not enabled.")
    await chargeRefill(refill,context.runtime.client,context.actorId)
  } else await cancelRefill(refill.order.id,context.actorId,context.runtime.mode,context.runtime.client)
  return loadCreditRefill(context.orgId)
}
export async function continueCreditRefillSetup(organizationId:string) {
  if(process.env.WORKSPACE_AI_REFILLS_ENABLED!=="true")throw new Error("Auto-refill is not enabled.")
  const context=await owner(organizationId),state=await loadCreditRefill(organizationId)
  if(!state?.setup)throw new Error("Refill setup unavailable.")
  const setup=await readRefillSetup(state.setup.id)
  if(setup.actor_id!==context.actorId||setup.org_id!==context.orgId||setup.mode!==context.runtime.mode||setup.runtime_target!==context.runtime.target)throw new Error("Refill setup access denied.")
  return openRefillSetup(setup,context.runtime.client)
}
