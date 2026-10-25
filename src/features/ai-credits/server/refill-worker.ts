import "server-only"
import { z } from "zod"
import { resolveStripeRuntimeConfigForAudience } from "@/lib/billing/stripe-runtime"
import { refillDb, readRefillAttempt, refillAttemptSchema } from "./refill-store"
import { chargeRefill, reconcileRefill } from "./refill-payment"
export async function processCreditRefills() {
  let processed=0
  const deadline=Date.now()+30000
  const runtimes=[false,true].map(isTester=>resolveStripeRuntimeConfigForAudience({isTester}))
    .filter((runtime,index,all)=>runtime&&all.findIndex(value=>value?.target===runtime.target&&value.mode===runtime.mode)===index)
  for(const runtime of runtimes) {
    if(!runtime)continue
    if(Date.now()>=deadline)break
    const args={p_mode:runtime.mode,p_target:runtime.target}
    const pending=await refillDb().rpc("list_ai_credit_refill_attempts",args)
    if(pending.error)throw new Error("Refill recovery unavailable.")
    for(const item of z.array(z.object({id:z.uuid()})).parse(pending.data)) {
      if(Date.now()>=deadline)return processed
      const refill=await readRefillAttempt(item.id)
      if(refill.attempt.state==="queued") {
        if(process.env.WORKSPACE_AI_REFILLS_ENABLED==="true")await chargeRefill(refill,runtime.client)
      } else await reconcileRefill(refill,runtime.client)
      processed++
    }
    if(process.env.WORKSPACE_AI_REFILLS_ENABLED!=="true")continue
    for(let count=0;count<1&&Date.now()<deadline;count++) {
      const next=await refillDb().rpc("prepare_next_ai_credit_refill",args)
      if(next.error)throw new Error("Refill queue unavailable.")
      if(!next.data)break
      await chargeRefill(refillAttemptSchema.parse(next.data),runtime.client);processed++
    }
  }
  return processed
}
