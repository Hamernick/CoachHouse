// Deterministic browser fixture. Never creates Stripe sessions or payments.
import type { AiCreditRefill, RefillInput } from "../../../src/features/ai-credits/refill-types"
const enabled=()=>new URLSearchParams(location.search).has("refill")&&!new URLSearchParams(location.search).has("staff")
const save=(state:AiCreditRefill)=>{localStorage.setItem("refill-state",JSON.stringify(state));return state}
export async function loadCreditRefill():Promise<AiCreditRefill|null> {
  if(!enabled())return null
  const stored=localStorage.getItem("refill-state")
  return stored?JSON.parse(stored):{canConfigure:true,setup:null,used:0,pending:null,resetAt:"2026-11-01T00:00:00Z"}
}
export async function startCreditRefill(input:RefillInput) {
  const calls=JSON.parse(localStorage.getItem("refill-calls")||"[]")
  localStorage.setItem("refill-calls",JSON.stringify([...calls,input]))
  save({canConfigure:true,setup:{id:input.id,status:"setup",credits:1000,amount:1000,currency:"usd",threshold:input.threshold,monthlyCap:input.monthlyPacks*1000,paymentLabel:null,expiresAt:new Date(Date.now()+3600000).toISOString()},used:0,pending:null,resetAt:"2026-11-01T00:00:00Z"})
  if(new URLSearchParams(location.search).has("refill-failure")&&calls.length===0)throw new Error("Setup confirmation pending. Retry this setup.")
  return {id:input.id,url:`${location.origin}/?fixture-card-setup`}
}
export async function checkCreditRefill() {
  const state=(await loadCreditRefill())!
  if(state.setup?.status==="setup")state.setup={...state.setup,status:"enabled",paymentLabel:"visa 4242"}
  return save(state)
}
export async function disableCreditRefill() {
  const state=(await loadCreditRefill())!
  if(state.setup)state.setup.status="disabled"
  return save(state)
}
export async function continueCreditRefillSetup() {return {id:(await loadCreditRefill())!.setup!.id,url:`${location.origin}/?fixture-card-setup`}}
export async function recoverCreditRefill() {const state=(await loadCreditRefill())!;state.pending=null;return save(state)}
