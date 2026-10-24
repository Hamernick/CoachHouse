import "server-only"
import type Stripe from "stripe"
import { refillConsent } from "../refill-types"
import { readRefillSetup, refillDb, type RefillSetup } from "./refill-store"
const stripeId=(value:string|{id:string}|null)=>typeof value==="string"?value:value?.id
export async function openRefillSetup(setup:RefillSetup,stripe:Stripe) {
  if(setup.status!=="setup")throw new Error("This setup is no longer pending. Reload usage.")
  let session:Stripe.Checkout.Session
  if(setup.checkout_session_id)session=await stripe.checkout.sessions.retrieve(setup.checkout_session_id)
  else {
    if(Date.parse(setup.expires_at)-Date.now()<31*60000)throw new Error("Setup recovery is pending. Disable this setup before starting another.")
    const price=await stripe.prices.retrieve(setup.price_id)
    if(!price.active||price.type!=="one_time"||price.unit_amount!==setup.amount||price.currency!==setup.currency||price.livemode!==(setup.mode==="live"))throw new Error("This credit pack is unavailable.")
    session=await stripe.checkout.sessions.create({mode:"setup",currency:setup.currency,payment_method_types:["card"],customer_creation:"always",client_reference_id:setup.id,
      metadata:{kind:"ai_credit_refill_setup",setup_id:setup.id,organization_id:setup.org_id},
      setup_intent_data:{metadata:{kind:"ai_credit_refill_setup",setup_id:setup.id}},
      custom_text:{submit:{message:refillConsent({...setup,monthlyCap:setup.monthly_cap})}},
      expires_at:Math.floor(Date.parse(setup.expires_at)/1000),success_url:setup.return_url,cancel_url:setup.return_url,
    },{idempotencyKey:`ai-refill-setup:${setup.mode}:${setup.id}`,maxNetworkRetries:0})
    const {error}=await refillDb().rpc("bind_ai_credit_refill_setup",{p_id:setup.id,p_session:session.id})
    if(error)throw new Error("Setup confirmation pending. Retry this setup.")
  }
  if(session.client_reference_id!==setup.id||session.mode!=="setup"||session.livemode!==(setup.mode==="live")||session.status!=="open"||!session.url)throw new Error("Setup is no longer open. Check status.")
  const url=new URL(session.url)
  if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com")throw new Error("Invalid setup URL.")
  return {id:setup.id,url:session.url}
}
export async function verifyRefillSetup(id:string,sessionId:string,stripe:Stripe,mode:"test"|"live") {
  const setup=await readRefillSetup(id)
  const session=await stripe.checkout.sessions.retrieve(sessionId,{expand:["setup_intent"]})
  if(setup.mode!==mode||session.id!==sessionId||session.mode!=="setup"||session.livemode!==(mode==="live")||session.client_reference_id!==setup.id||session.metadata?.kind!=="ai_credit_refill_setup"||session.metadata.setup_id!==setup.id||session.metadata.organization_id!==setup.org_id||(setup.checkout_session_id&&setup.checkout_session_id!==session.id))throw new Error("Refill setup identity mismatch.")
  if(session.status!=="complete")return false
  const intent=session.setup_intent,customer=stripeId(session.customer)
  if(!intent||typeof intent==="string"||intent.status!=="succeeded"||intent.usage!=="off_session"||intent.livemode!==session.livemode||intent.metadata?.setup_id!==setup.id||intent.metadata.kind!=="ai_credit_refill_setup"||!customer||stripeId(intent.customer)!==customer)throw new Error("Refill payment setup mismatch.")
  const paymentId=stripeId(intent.payment_method)
  if(!paymentId)throw new Error("Refill payment method missing.")
  const method=await stripe.paymentMethods.retrieve(paymentId)
  if(method.type!=="card"||!method.card||stripeId(method.customer)!==customer||method.livemode!==session.livemode)throw new Error("Refill requires a verified saved card.")
  const {data,error}=await refillDb().rpc("verify_ai_credit_refill_setup",{p_input:{id:setup.id,mode,session:session.id,customer,paymentMethod:method.id,label:`${method.card.brand} •••• ${method.card.last4}`}})
  if(error)throw new Error("Unable to confirm refill setup.")
  return data
}
