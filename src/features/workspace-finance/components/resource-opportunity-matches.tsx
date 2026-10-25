"use client"
import { useEffect, useRef, useState } from "react"
import { Check, LoaderCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "@/lib/toast"
import { findResourceOpportunityMatches, getResourceOpportunityMatches, updateResourceOpportunityMatch } from "../matching-actions"
import type { FundingNeed, ResourceMatchTarget, ResourceOpportunityMatch } from "../matching-types"
import { opportunityValueLabel } from "../lib/opportunity-matching"
import type { WorkspaceFinanceOpportunityInput } from "../types"

type Props = { target:ResourceMatchTarget; title:string; canEdit:boolean; onSaved:(item:WorkspaceFinanceOpportunityInput)=>void }
export function ResourceOpportunityMatches(props:Props) {
  return <MatchSession key={`${props.target.organizationId}:${props.target.resourceId}:${props.target.resourceRevision}`} {...props}/>
}
function MatchSession({target,title,canEdit,onSaved}:Props) {
  const [open,setOpen]=useState(false),[keyword,setKeyword]=useState(""),[amount,setAmount]=useState("")
  const [matches,setMatches]=useState<ResourceOpportunityMatch[]>([]),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState("")
  const alive=useRef(true),busy=useRef(false),generation=useRef(0)
  const {organizationId,resourceId,resourceRevision}=target
  useEffect(()=>{
    alive.current=true;const request=++generation.current
    void getResourceOpportunityMatches({organizationId,resourceId,resourceRevision}).then(result=>{
      if(!alive.current||request!==generation.current)return
      if("error" in result)setError(result.error);else setMatches(result.matches)
    }).catch(()=>{if(alive.current&&request===generation.current)setError("Matches could not be loaded.")})
    return()=>{alive.current=false;generation.current=request+1}
  },[organizationId,resourceId,resourceRevision])
  const search=async()=>{
    if(busy.current)return
    let cents:number|null=null
    if(amount.trim()) {
      const valid=/^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(amount.trim())
      if(!valid){setError("Enter a USD amount with up to two decimal places.");return}
      cents=Number(BigInt(valid[1])*BigInt(100)+BigInt((valid[2]??"").padEnd(2,"0")))
    }
    busy.current=true;setPending(true);setError(null);generation.current++
    const need:FundingNeed={resourceId,resourceRevision,requestedCents:cents,currency:"USD",period:null,eligibleUnfundedCost:{state:"unknown"},matchingFunds:{state:"unknown"},restrictedCosts:"unknown",overlap:"unknown",eligibilityReview:"unknown",applicantTypeCode:null}
    try {
      const result=await findResourceOpportunityMatches({target,keyword,need})
      if(!alive.current)return
      if("error" in result)setError(result.error)
      else {setMatches(result.matches);setMessage(result.found?`${result.found} notices checked. Eligibility requires review.${result.unavailable?" Some official details were unavailable.":""}`:"No current notices found for these keywords.")}
    }catch{if(alive.current)setError("Search interrupted. Your saved matches are unchanged.")}
    finally{busy.current=false;if(alive.current)setPending(false)}
  }
  const change=async(match:ResourceOpportunityMatch,action:"save"|"dismiss"|"restore")=>{
    if(busy.current)return
    busy.current=true;setPending(true);setError(null);generation.current++
    try {
      const result=await updateResourceOpportunityMatch({target,id:match.id,updatedAt:match.updatedAt,action})
      if(!alive.current)return
      if("error" in result){setError(result.error);return}
      setMatches(result.matches)
      if("reviewRequired" in result&&result.reviewRequired)setMessage("The official notice changed or is no longer active. Review the refreshed details before saving.")
      else if(result.opportunity)onSaved(result.opportunity)
      if(action==="dismiss") {
        const dismissed=result.matches.find(item=>item.id===match.id)
        if(dismissed)toast.success("Match dismissed",{action:{label:"Undo",onClick:()=>void change(dismissed,"restore")}})
      }
    }catch{if(alive.current)setError("Match update interrupted. Reopen opportunities to check its saved state.")}
    finally{busy.current=false;if(alive.current)setPending(false)}
  }
  const visible=matches.filter(match=>match.status!=="dismissed")
  return <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-border/60 bg-muted/30 p-3">
    <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal rounded-lg px-1 py-2 text-left">Opportunities for {title}</Button></CollapsibleTrigger>
    <CollapsibleContent className="space-y-3 pt-2">
      {canEdit&&<form onSubmit={event=>{event.preventDefault();void search()}} className="space-y-2">
        <Input aria-label="Public opportunity keywords" placeholder="Public search keywords" value={keyword} onChange={event=>setKeyword(event.target.value)} required minLength={2} maxLength={100} disabled={pending} className="rounded-xl px-3"/>
        <div className="flex items-center gap-2"><Input aria-label="Requested funding in USD" placeholder="Requested USD (optional)" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} disabled={pending} className="min-w-0 rounded-xl px-3"/><Button type="submit" size="sm" disabled={pending} className="rounded-lg">{pending&&<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden/>}Find</Button></div>
        <p className="text-xs text-muted-foreground">Only your search keywords go to Grants.gov. Your budget stays private. Federal notices are one funding source.</p>
      </form>}
      {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}{message&&<p role="status" className="text-xs text-muted-foreground">{message}</p>}
      <ul aria-label="Resource opportunity matches" className="space-y-3">{visible.map(match=><li key={match.id} className="rounded-xl border border-border/60 bg-card p-3">
        <div className="flex items-start justify-between gap-2"><h4 className="min-w-0 break-words text-sm font-medium">{match.notice.title}</h4>{canEdit&&<div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" className="size-11 rounded-lg sm:size-9" aria-label={`Dismiss match ${match.notice.title}`} disabled={pending} onClick={()=>void change(match,"dismiss")}><X className="size-4" aria-hidden/></Button>
          <Button size="icon" variant="ghost" className="size-11 rounded-lg sm:size-9" aria-label={`${match.status==="saved"?"Saved":"Save"} match ${match.notice.title}`} disabled={pending||match.stale||!match.assessment.active||match.status==="saved"} onClick={()=>void change(match,"save")}><Check className="size-4" aria-hidden/></Button>
        </div>}</div>
        <p className="mt-1 text-sm">{opportunityValueLabel(match.notice)}</p><p className="text-xs text-muted-foreground">{match.notice.agency}</p>
        <p className="mt-2 text-xs text-muted-foreground">{match.stale?"Resource changed; search again":!match.assessment.active?"No longer current":match.notice.status==="forecasted"?"Forecast; final notice pending":match.assessment.fit==="not_eligible"?"Requirements not met":"Eligibility needs review"}</p>
        <details className="mt-2 text-xs"><summary className="cursor-pointer py-1">Why this match</summary><div className="space-y-2 pt-2">
          <p className="whitespace-pre-wrap break-words">{match.notice.summary}</p><p>Target: {title}</p><p>Deadline: {match.notice.deadlineDate??"Not published"}. Confirm the official cutoff.</p>
          <p>Posted {match.notice.postedDate??"not published"} · Updated {match.notice.updatedDate??"not published"}</p><p>Discovered {new Date(match.notice.discoveredAt).toLocaleDateString()} · Checked {new Date(match.notice.verifiedAt).toLocaleString()}</p>
          {match.notice.fundingPoolCents!==null&&<p>Program total: {new Intl.NumberFormat(undefined,{style:"currency",currency:match.notice.currency}).format(match.notice.fundingPoolCents/100)}. This is not a per-award amount.</p>}
          <ul className="space-y-1">{match.assessment.criteria.map(criterion=><li key={criterion.id}>{criterion.outcome==="pass"?"Checked":criterion.outcome==="fail"?"Not met":"Unknown"}: {criterion.explanation}</li>)}</ul>
          <p>{match.assessment.coverage.kind==="comparable"?`Up to ${match.assessment.coverage.maximumCoverageBps/100}% of the eligible unfunded need; not secured funding.`:"Coverage cannot be estimated until eligible costs, period and requirements are confirmed."}</p>
          <a className="inline-flex rounded-full bg-muted px-3 py-2 underline" href={match.notice.originalUrl} target="_blank" rel="noreferrer">Official notice</a>
        </div></details>
      </li>)}</ul>
    </CollapsibleContent>
  </Collapsible>
}
