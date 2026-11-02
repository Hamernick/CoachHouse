"use client"
import { useId, useState } from "react"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleTextarea as Textarea } from "@/components/ui/particle-ui"
import { Label } from "@/components/ui/label"
import { publicResearchDestination, type ResearchPublicBrief } from "../lib/research-public-brief"
import type { ResearchQuote } from "./use-research-public-brief"

export function ResearchPublicBriefEditor({ disabled, onChange }: { disabled: boolean; onChange: (value: ResearchPublicBrief | undefined, awaitingReview?: boolean) => void }) {
  const [open,setOpen]=useState(false), [brief,setBrief]=useState(""), [approved,setApproved]=useState(false), id=useId()
  if (!open) return <Button color="secondary" type="button" variant="ghost" size="2xl" disabled={disabled} onClick={()=>{setOpen(true);onChange(undefined,true)}}>Add public research</Button>
  return <div className="space-y-2">
    <Label htmlFor={id}>Public research brief</Label>
    <p className="text-xs text-muted-foreground">Only this brief goes to {publicResearchDestination}. Enter public information you approve for search. Workspace context and private history stay out of this search.</p>
    <Textarea id={id} value={brief} maxLength={1000} rows={3} disabled={disabled} onChange={event=>{setBrief(event.target.value);setApproved(false);onChange(undefined,true)}} />
    <div className="flex flex-wrap gap-2">
      <Button color="secondary" type="button" size="2xl" variant="outline" disabled={disabled || !brief.trim() || approved} onClick={()=>{setApproved(true);onChange({version:1,destination:"openai_web_search",brief:brief.trim(),approved:true})}}>{approved ? "Brief approved" : "Approve brief for search"}</Button>
      <Button color="secondary" type="button" size="2xl" variant="ghost" disabled={disabled} onClick={()=>{setOpen(false);setApproved(false);setBrief("");onChange(undefined)}}>Remove public research</Button>
    </div>
    {!approved && <p className="text-xs text-muted-foreground">Approve the exact brief to include public research. Editing it clears approval.</p>}
  </div>
}

export function ResearchScopeHelp({publicAvailable}:{publicAvailable:boolean}) {
  return <p className="text-xs text-muted-foreground">Creates plan proposals and notes from workspace sources. {publicAvailable ? "Public search uses only a separately approved brief." : "Web search is unavailable."}</p>
}
export function ResearchPublicOptions({available,disabled,quote,publicResearch,hasRun,onChange}:{available:boolean;disabled:boolean;quote:Pick<ResearchQuote,"maximumCredits"|"provider"|"model"|"availableCredits">|null;publicResearch:ResearchPublicBrief|undefined;hasRun:boolean;onChange:(value:ResearchPublicBrief|undefined,awaitingReview?:boolean)=>void}) {
  return <>{available && <ResearchPublicBriefEditor disabled={disabled} onChange={onChange} />}
    {quote && !hasRun && <div className="space-y-1 break-words text-xs text-muted-foreground">
      <p>Up to {quote.maximumCredits} credits for {publicResearch ? "workspace and approved public research" : "workspace research"}.</p>
      {quote.provider && quote.model && <p>{quote.provider} · {quote.model}</p>}
      {quote.availableCredits !== undefined && <p>Available at quote: {quote.availableCredits.toLocaleString()} credits.</p>}
    </div>}</>
}
