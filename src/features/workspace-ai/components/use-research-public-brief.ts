"use client"
import { useRef, useState, type RefObject } from "react"
import { quoteWorkspaceResearch } from "../research-actions"
import type { ResearchTarget } from "../research-types"
import type { ResearchPublicBrief } from "../lib/research-public-brief"
import type { DocumentEmbeddingDisclosure } from "../lib/document-embedding-policy"

export type ResearchQuote = {embedding?:DocumentEmbeddingDisclosure;maximumCredits:number;tariffVersion:string;provider?:"OpenAI";model?:string;availableCredits?:number;publicResearchAvailable?:boolean}

export function useResearchPublicBrief(target:ResearchTarget,alive:RefObject<boolean>,setQuote:(quote:ResearchQuote|null)=>void,setError:(error:string|null)=>void) {
  const [publicResearch,setPublicResearch]=useState<ResearchPublicBrief|undefined>(),[publicAvailable,setPublicAvailable]=useState(false),version=useRef(0)
  const updatePublicResearch=async(value:ResearchPublicBrief|undefined,awaitingReview=false)=>{
    const expected=++version.current
    setPublicResearch(value);setQuote(null);setError(null)
    if(awaitingReview)return
    try {
      const next=await quoteWorkspaceResearch(target,value)
      if(!alive.current||expected!==version.current)return
      if("error" in next)setError(next.error??"Research pricing could not be loaded.")
      else {setQuote(next);setPublicAvailable(Boolean(next.publicResearchAvailable))}
    } catch {if(alive.current&&expected===version.current)setError("Research pricing could not be loaded. Reopen research to retry.")}
  }
  return {publicResearch,publicAvailable,setPublicAvailable,updatePublicResearch}
}
