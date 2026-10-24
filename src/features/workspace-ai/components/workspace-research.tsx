"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from "@/components/ui/select"
import { quoteWorkspaceResearch,getWorkspaceResearch,stopWorkspaceResearch } from "../research-actions"
import { researchResultSchema, type ResearchTarget, type ResearchResult, type ResearchRequest } from "../research-types"

type Quote={maximumCredits:number;tariffVersion:string}
export function WorkspaceResearch({target,userId,onProposal,onClose}:{target:ResearchTarget;userId:string;onProposal:(result:ResearchResult)=>Promise<boolean>;onClose:()=>void}) {
  const [prompt,setPrompt]=useState(""),[skill,setSkill]=useState<ResearchRequest["skill"]>("research")
  const [quote,setQuote]=useState<Quote|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false)
  const [runId,setRunId]=useState<string|null>(null),[result,setResult]=useState<ResearchResult|null>(null),[message,setMessage]=useState("")
  const alive=useRef(true), working=useRef(false)
  const {organizationId,objectiveId,revision}=target
  const key=`workspace-research:${userId}:${target.organizationId}:${target.objectiveId}`
  useEffect(()=>{
    alive.current=true
    try {setRunId(sessionStorage.getItem(key))} catch { /* Browser storage is optional. */ }
    setQuote(null)
    let current=true
    void quoteWorkspaceResearch({organizationId,objectiveId,revision}).then(value=>{if(current&&alive.current) {if("error"in value)setError(value.error ?? "Research unavailable.");else {setQuote(value);setError(null)}}}).catch(()=>{if(current&&alive.current)setError("Research pricing could not be loaded. Reopen research to retry.")})
    return ()=>{current=false;alive.current=false}
  },[key,organizationId,objectiveId,revision]) // primitive target prevents repeated quotes while panning
  const retain=(id:string|null)=>{setRunId(id);try{if(id)sessionStorage.setItem(key,id);else sessionStorage.removeItem(key)}catch{ /* Keep recovery in memory. */ }}
  const consume=(value:{run?:{status:string;result:ResearchResult|null};error?:string})=>{
    if(!alive.current)return
    if(value.error) {setError(value.error ?? "Research unavailable.");return}
    if(value.run?.result) {setResult(researchResultSchema.parse(value.run.result));setMessage("Research ready. Review the proposed additions.")}
    else if(value.run && ["failed","canceled"].includes(value.run.status)){setMessage(value.run.status==="canceled"?"Research stopped.":"Research did not produce a valid proposal. No credits charged.");retain(null)}
    else setMessage("Research is still running or recovering. Check status shortly.")
  }
  const start=async()=>{
    if(!quote||working.current||runId)return
    working.current=true;setBusy(true);setError(null);setResult(null);setMessage("Researching workspace context and relevant sources…")
    const id=crypto.randomUUID();retain(id)
    try {
      const response=await fetch("/api/workspace-ai/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,target,prompt,skill,...quote})})
      const value=await response.json()
      consume(value)
      if(value.error&&!value.reserved)retain(null)
    } catch {if(alive.current)setError("Connection interrupted. Check status to recover this run.")}
    finally{working.current=false;if(alive.current)setBusy(false)}
  }
  const add=async()=>{
    if(!result||working.current)return
    working.current=true;setBusy(true);setError(null)
    try{if(await onProposal(result)){retain(null);onClose()}}
    catch(error){setError(error instanceof Error?error.message:"Proposal could not be added.")}
    finally{working.current=false;if(alive.current)setBusy(false)}
  }
  return <form aria-label="Research objective" className="space-y-3 px-2 py-3" onSubmit={event=>{event.preventDefault();void start()}}>
    {!result && <><Textarea aria-label="Research request" placeholder="What should we find or develop?" value={prompt} onChange={event=>setPrompt(event.target.value)} maxLength={2000} required rows={3} disabled={busy||Boolean(runId)} className="rounded-xl px-3 py-2" />
    <Select value={skill} onValueChange={value=>setSkill(value as ResearchRequest["skill"])} disabled={busy||Boolean(runId)}><SelectTrigger aria-label="Research approach" className="h-9 w-fit rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="research">Research</SelectItem><SelectItem value="partnerships">Find partners & resources</SelectItem><SelectItem value="planning">Develop the plan</SelectItem></SelectContent></Select>
    {quote&&!runId&&<p className="text-xs text-muted-foreground">Up to {quote.maximumCredits} credits, including web searches.</p>}</>}
    {result && <div className="space-y-2"><p className="text-sm">{result.summary}</p>{result.questions.length>0&&<ul className="list-disc space-y-1 pl-4 text-sm">{result.questions.map(question=><li key={question}>{question}</li>)}</ul>}<ul className="space-y-2 text-sm">{result.items.map(item=><li key={item.key}><span className="font-medium">{item.title}</span><p className="text-xs text-muted-foreground">{item.description}</p></li>)}</ul><ul className="flex flex-wrap gap-1">{result.sources.map(source=><li key={source.id}><a href={source.href} target={source.kind==="web"?"_blank":undefined} rel="noreferrer" className="inline-block max-w-60 truncate rounded-full bg-muted px-2 py-1 text-xs underline">{source.title}</a></li>)}</ul></div>}
    {message&&<p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      {runId&&!result&&<><Button type="button" variant="ghost" size="sm" onClick={async()=>{const value=await stopWorkspaceResearch(runId,target);if("error"in value)setError(value.error ?? "Research unavailable.");else setMessage("Stop requested. Finishing usage accounting.")}}>Stop</Button><Button type="button" variant="outline" size="sm" onClick={async()=>consume(await getWorkspaceResearch(runId,target))}>Check status</Button></>}
      {result&&<><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={()=>{setResult(null);retain(null);setMessage("")}}>Discard</Button><Button type="button" size="sm" disabled={busy||!result.items.length} onClick={()=>void add()}>Add proposal</Button></>}
      {!runId&&!result&&<Button type="submit" size="sm" disabled={busy||!quote||!prompt.trim()}>Research</Button>}
    </div>
  </form>
}
