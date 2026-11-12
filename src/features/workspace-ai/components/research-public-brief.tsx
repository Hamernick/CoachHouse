"use client"
import { ResearchEmbeddingDisclosure } from "./research-embedding-disclosure"
import { useAiUsage } from "@/features/ai-credits/client"
import { useId, useState } from "react"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleTextarea as Textarea } from "@/components/ui/particle-ui"
import { Label } from "@/components/ui/label"
import { publicResearchDestination, type ResearchPublicBrief } from "../lib/research-public-brief"
import type { ResearchQuote } from "./use-research-public-brief"

export function ResearchPublicBriefEditor({ disabled, onChange }: { disabled: boolean; onChange: (value: ResearchPublicBrief | undefined, awaitingReview?: boolean) => void }) {
  const [open,setOpen]=useState(false), [brief,setBrief]=useState(""), [approved,setApproved]=useState(false), id=useId()
  if (!open) return <Button color="secondary" type="button" variant="ghost" size="md" disabled={disabled} onClick={()=>{setOpen(true);onChange(undefined,true)}}>Add public research</Button>
  return <div className="space-y-2">
    <Label htmlFor={id}>Public research brief</Label>
    <p className="text-xs text-muted-foreground">Only this approved brief is sent to {publicResearchDestination}. Workspace context stays private.</p>
    <Textarea id={id} value={brief} maxLength={1000} rows={3} disabled={disabled} onChange={event=>{setBrief(event.target.value);setApproved(false);onChange(undefined,true)}} />
    <div className="flex flex-wrap gap-2">
      <Button color="secondary" type="button" size="md" variant="outline" disabled={disabled || !brief.trim() || approved} onClick={()=>{setApproved(true);onChange({version:1,destination:"openai_web_search",brief:brief.trim(),approved:true})}}>{approved ? "Brief approved" : "Approve brief for search"}</Button>
      <Button color="secondary" type="button" size="md" variant="ghost" disabled={disabled} onClick={()=>{setOpen(false);setApproved(false);setBrief("");onChange(undefined)}}>Remove public research</Button>
    </div>
    {!approved && <p className="text-xs text-muted-foreground">Approve the exact brief to include public research. Editing it clears approval.</p>}
  </div>
}

export function ResearchPublicOptions({available,disabled,quote,publicResearch,hasRun,onChange,embeddingApproved=false,onApproveEmbedding}:{available:boolean;disabled:boolean;quote:Pick<ResearchQuote,"maximumCredits"|"provider"|"model"|"availableCredits"|"embedding">|null;publicResearch:ResearchPublicBrief|undefined;hasRun:boolean;embeddingApproved?:boolean;onApproveEmbedding?:()=>void;onChange:(value:ResearchPublicBrief|undefined,awaitingReview?:boolean)=>void}) {
  const sidebarUsage = useAiUsage()
  return <>{available && <ResearchPublicBriefEditor disabled={disabled} onChange={onChange} />}
    {quote?.embedding && !hasRun && <div className="space-y-1"><ResearchEmbeddingDisclosure embedding={quote.embedding} /><Button color="secondary" type="button" variant="outline" size="md" disabled={disabled || embeddingApproved || !onApproveEmbedding} onClick={onApproveEmbedding}>{embeddingApproved ? "Document processing approved" : "Approve document processing"}</Button></div>}
    {quote && !hasRun && !sidebarUsage && <div className="space-y-1 break-words text-xs text-muted-foreground">
      <p>Up to {quote.maximumCredits} credits{publicResearch ? " · includes public research" : ""}</p>
      <details><summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring">Pricing details</summary>
        {quote.provider && quote.model && <p>{quote.provider} · {quote.model}</p>}
        {quote.availableCredits !== undefined && <p>Available at quote: {quote.availableCredits.toLocaleString()} credits.</p>}
      </details>
    </div>}</>
}
