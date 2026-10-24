import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"
import { purchaseOrderSchema } from "./purchase-store"
export const refillSetupSchema = z.object({ id:z.uuid(),org_id:z.uuid(),actor_id:z.uuid(),mode:z.enum(["test","live"]),runtime_target:z.enum(["primary","tester"]),pack_key:z.string(),price_id:z.string(),credits:z.number(),amount:z.number(),currency:z.string(),threshold:z.number(),monthly_cap:z.number(),consent_version:z.literal("refill-v1"),consent_at:z.string(),return_url:z.url(),expires_at:z.string(),status:z.enum(["setup","enabled","paused","disabled"]),checkout_session_id:z.string().nullable(),customer_id:z.string().nullable(),payment_method_id:z.string().nullable(),payment_label:z.string().nullable(),verified_at:z.string().nullable() })
export type RefillSetup = z.infer<typeof refillSetupSchema>
export const refillAttemptSchema=z.object({ attempt:z.object({id:z.uuid(),setup_id:z.uuid(),run_id:z.uuid(),state:z.enum(["queued","charging","processing","requires_action","uncertain","failed","canceled","succeeded"]),started_at:z.string().nullable()}),order:purchaseOrderSchema,setup:refillSetupSchema })
export type RefillAttempt = z.infer<typeof refillAttemptSchema>
export const refillDb = () => createSupabaseAdminClient({requestTimeoutMs:10000})
export async function readRefillSetup(id:string) {
  const {data,error}=await refillDb().rpc("read_ai_credit_refill_setup",{p_id:id})
  if(error)throw new Error("Refill setup unavailable.")
  return refillSetupSchema.parse(data)
}
export async function readRefillAttempt(id:string) {
  const {data,error}=await refillDb().rpc("read_ai_credit_refill_attempt",{p_id:id})
  if(error)throw new Error("Refill unavailable.")
  return refillAttemptSchema.parse(data)
}
export async function recordRefill(input:Json) {
  const {error}=await refillDb().rpc("record_ai_credit_refill_attempt",{p_input:input})
  if(error)throw new Error("Unable to record refill status.")
}
