"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { checkCreditRefill, continueCreditRefillSetup, disableCreditRefill, loadCreditRefill, recoverCreditRefill, startCreditRefill } from "../refill-actions"
import { creditMoney, refillConsent, REFILL_CONSENT_VERSION, type AiCreditRefill } from "../refill-types"
import type { AiCreditPack } from "../purchase-types"

export function CreditAutoRefill({organizationId,packs,onChanged}:{organizationId:string;packs:AiCreditPack[];onChanged:()=>void}) {
  const [state,setState]=useState<AiCreditRefill|null>(null),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
  const [selected,setSelected]=useState(""),[threshold,setThreshold]=useState(100),[monthlyPacks,setMonthlyPacks]=useState(3),[consent,setConsent]=useState(false)
  const mounted=useRef(false),operation=useRef<{id:string;terms:string}|null>(null),working=useRef(false),readVersion=useRef(0)
  useEffect(()=>{
    mounted.current=true
    const load=()=>{
      if(working.current)return
      const version=++readVersion.current
      void loadCreditRefill(organizationId).then(value=>{if(mounted.current&&version===readVersion.current){setState(value);setError(null)}})
        .catch(()=>{if(mounted.current&&version===readVersion.current)setError("Unable to load auto-refill.")})
    }
    load();window.addEventListener("focus",load)
    return()=>{mounted.current=false;window.removeEventListener("focus",load)}
  },[organizationId])
  const pack=packs.find(value=>value.key===selected)??packs[0]
  const terms=pack?{...pack,threshold,monthlyCap:pack.amount*monthlyPacks}:null
  const signature=JSON.stringify(terms)
  useEffect(()=>setConsent(false),[signature])
  async function perform(action:()=>Promise<AiCreditRefill|null>) {
    if(working.current)return
    working.current=true;readVersion.current++;setBusy(true);setError(null)
    try {const value=await action();if(mounted.current){setState(value);onChanged()}}
    catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Refill could not be updated.")}
    finally{working.current=false;if(mounted.current)setBusy(false)}
  }
  async function setup(resume=false) {
    if(working.current||(!resume&&(!pack||!consent)))return
    const popup=window.open("about:blank","_blank")
    if(!popup){setError("Allow a new tab to open secure card setup.");return}
    popup.opener=null
    await perform(async()=>{
      let openedProvider=false
      try {
        if(!operation.current||operation.current.terms!==signature)operation.current={id:crypto.randomUUID(),terms:signature}
        const opened=resume?await continueCreditRefillSetup(organizationId):await startCreditRefill({organizationId,id:operation.current.id,pack:pack!.key,threshold,monthlyPacks,consent:true,consentVersion:REFILL_CONSENT_VERSION})
        if(!mounted.current){popup.close();return null}
        popup.location.replace(opened.url)
        openedProvider=true
        setExpanded(false)
        return await loadCreditRefill(organizationId)
      } catch(cause){if(!openedProvider)popup.close();throw cause}
    })
  }
  if(!state&&!error)return null
  const configured=state?.setup, pending=state?.pending
  return <section aria-label="Auto-refill" className="flex flex-col gap-2 border-t border-border/60 pt-3 text-xs">
    <div className="flex items-center justify-between gap-3"><span className="font-medium">Auto-refill</span><span className="text-muted-foreground">{configured?.status==="enabled"?"On":configured?.status==="setup"?"Awaiting card setup":configured?.status==="paused"?"Paused":"Off"}</span></div>
    {configured&&configured.status!=="disabled"?<>
      <p>{creditMoney(configured.amount,configured.currency)} for {configured.credits.toLocaleString()} credits below {configured.threshold.toLocaleString()} available.</p>
      <p className="text-muted-foreground">{creditMoney(state?.used??0,configured.currency)} of {creditMoney(configured.monthlyCap,configured.currency)} this month, including pending. Resets {new Date(state!.resetAt).toLocaleDateString(undefined,{timeZone:"UTC"})} (UTC).</p>
      {configured.paymentLabel?<p>{configured.paymentLabel}</p>:null}
    </>:null}
    {pending?<div className="flex flex-col gap-2">
      <p role="status">{creditMoney(pending.amount,pending.currency)} · {pending.state==="requires_action"?"Payment needs attention":pending.state==="uncertain"?"Payment verification pending":"Refill pending"}. No additional automatic refill will start.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={()=>void perform(()=>checkCreditRefill(organizationId))}>Check status</Button>
        {pending.canRetry&&state?.canConfigure?<Button variant="secondary" size="sm" disabled={busy} onClick={()=>void perform(()=>recoverCreditRefill({organizationId,id:pending.id,action:"retry"}))}>Retry {creditMoney(pending.amount,pending.currency)} refill</Button>:null}
        {pending.canCancel?<Button variant="ghost" size="sm" disabled={busy} onClick={()=>void perform(()=>recoverCreditRefill({organizationId,id:pending.id,action:"cancel"}))}>Cancel pending refill</Button>:null}
      </div>
    </div>:null}
    {configured?.status==="setup"?<div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={busy||!state?.canConfigure} onClick={()=>void setup(true)}>Continue card setup</Button><Button variant="ghost" size="sm" disabled={busy} onClick={()=>void perform(()=>checkCreditRefill(organizationId))}>Check status</Button></div>:null}
    {configured&&configured.status!=="disabled"?<Button variant="ghost" size="sm" className="self-start" disabled={busy} onClick={()=>void perform(()=>disableCreditRefill(organizationId))}>Disable auto-refill</Button>:null}
    {configured?.status==="paused"&&!pending?<p className="text-muted-foreground">Disable auto-refill to set up another card. You can still buy credits above.</p>:null}
    {state?.canConfigure&&(!configured||configured.status==="disabled")&&!pending&&pack?<>
      <Button variant="ghost" size="sm" className="self-start" aria-expanded={expanded} disabled={busy} onClick={()=>setExpanded(value=>!value)}>Set up auto-refill</Button>
      {expanded&&terms?<div className="flex flex-col gap-3">
        <Select value={pack.key} onValueChange={setSelected} disabled={busy}><SelectTrigger aria-label="Refill credit pack"><SelectValue /></SelectTrigger><SelectContent>{packs.map(value=><SelectItem key={value.key} value={value.key}>{value.credits.toLocaleString()} credits · {creditMoney(value.amount,value.currency)}</SelectItem>)}</SelectContent></Select>
        <Label className="flex items-center justify-between gap-3">Below available credits<Input aria-label="Refill threshold" className="w-24" type="number" min={1} max={pack.credits} value={threshold} disabled={busy} onChange={event=>setThreshold(Number(event.target.value))}/></Label>
        <Select value={String(monthlyPacks)} onValueChange={value=>setMonthlyPacks(Number(value))} disabled={busy}><SelectTrigger aria-label="Monthly refill cap"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,5,10].map(value=><SelectItem key={value} value={String(value)}>{creditMoney(pack.amount*value,pack.currency)} / month (UTC)</SelectItem>)}</SelectContent></Select>
        <Label className="flex items-start gap-2 text-xs leading-relaxed"><Checkbox checked={consent} disabled={busy} onCheckedChange={value=>setConsent(value===true)} aria-label="Authorize automatic refill charges"/><span>{refillConsent(terms)}</span></Label>
        <Button variant="secondary" className="self-start" disabled={busy||!consent||!Number.isInteger(threshold)||threshold<1||threshold>pack.credits} onClick={()=>void setup()}>Set up saved card</Button>
      </div>:null}
    </>:null}
    {error?<div className="flex items-center gap-2"><p role="alert" className="text-destructive">{error}</p>{!state?<Button variant="ghost" size="sm" disabled={busy} onClick={()=>void perform(()=>loadCreditRefill(organizationId))}>Retry</Button>:null}</div>:null}
  </section>
}
