import "server-only"
import { createHash } from "node:crypto"
import type { ComposableDataView } from "@/features/workspace-data-views"
import { readComposableDataViewSource } from "@/features/workspace-data-views/server"
import { researchDataViewOutputsEnabled } from "./research-output-config"
import type { ResearchContext } from "./research-context"
import { ResearchRecoveryError } from "./research-recovery"

export const researchDataViewFingerprint=(value:ComposableDataView)=>createHash("sha256").update(JSON.stringify(value)).digest("hex")
/** Existing selected-canvas handles only; no table/form discovery or answer reads. */
export async function withResearchDataViewSources<T extends ResearchContext>(context:T):Promise<T> {
 if(!researchDataViewOutputsEnabled())return context
 const ids=[...new Set(context.graph.particles.flatMap(p=>p.type==="activity"&&p.data.widget?.kind==="data_view"?[p.data.widget.viewId]:[]))].slice(0,8)
 const sources:ComposableDataView[]=[]
 for(let index=0;index<ids.length;index+=4) {
  const replies=await Promise.all(ids.slice(index,index+4).map(id=>readComposableDataViewSource(context.target.organizationId,id)))
  for(const reply of replies)if(reply.ok&&reply.data.canCreate)sources.push(reply.data)
 }
 return {...context,dataViewSources:sources}
}
export async function assertResearchDataViewSources(context:ResearchContext,dependencies:readonly {viewId:string;fingerprint:string}[]) {
 for(let index=0;index<dependencies.length;index+=4)await Promise.all(dependencies.slice(index,index+4).map(async dependency=>{
  if(!context.graph.particles.some(p=>p.type==="activity"&&p.data.widget?.kind==="data_view"&&p.data.widget.viewId===dependency.viewId))throw new ResearchRecoveryError("sources_changed")
  const reply=await readComposableDataViewSource(context.target.organizationId,dependency.viewId)
  if(!reply.ok)throw new ResearchRecoveryError(reply.code==="denied"?"sources_changed":"verification_unavailable")
  if(!reply.data.canCreate||researchDataViewFingerprint(reply.data)!==dependency.fingerprint)throw new ResearchRecoveryError("sources_changed")
 }))
}
