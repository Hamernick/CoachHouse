import { beforeEach,describe,expect,it,vi } from "vitest"
const mocks=vi.hoisted(()=>({metadata:vi.fn(),read:vi.fn(),project:vi.fn(),write:vi.fn()}))
vi.mock("@/features/workspace-data-views/server",()=>({readComposableDataViewSource:mocks.metadata,readExistingDataViewCreation:mocks.read,readProjectDataViewCreation:mocks.project,runDataViewCommand:mocks.write}))
import { createResearchOutputBindings, researchDataViewSchema } from "@/features/workspace-ai/lib/research-data-view"
import { withResearchDataViewSources,assertResearchDataViewSources,researchDataViewFingerprint } from "@/features/workspace-ai/server/research-data-view-sources"
import { applyResearchDataViewEffects,inspectResearchDataViewEffects,researchDataViewCommands } from "@/features/workspace-ai/server/research-data-view-effects"
import { projectResearchPresentation } from "@/features/workspace-ai/lib/research-presentation"
import { createResearchDraft,applyResearchDraft } from "@/features/workspace-ai/lib/research-draft"
import { researchPrompt } from "@/features/workspace-ai/server/research-prompt"
import { createResearchItemProgress } from "@/features/workspace-ai/server/research-item-progress"
import type { ResponseTextDeltaEvent } from "openai/resources/responses/responses"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import type { ComposableDataView } from "@/features/workspace-data-views"
import { ID,WORKSPACE,graph,particle } from "./fixtures/particle-fixtures"
const table:ComposableDataView={viewId:ID(81),updatedAt:"2026-11-02T00:00:00Z",name:"Shared view",sourceTitle:"Partners",source:{kind:"table",tableId:ID(82)},canCreate:true}
const responses:ComposableDataView={viewId:ID(83),updatedAt:table.updatedAt,name:"Private response view",sourceTitle:"Volunteer intake",source:{kind:"responses",versionId:ID(84)},canCreate:true}
function context():ResearchContext {
 const value=graph();value.particles=[particle(1,"objective"),...[table,responses].map((source,i)=>{
  const activity=particle(80+i,"activity");if(activity.type!=="activity")throw Error("Expected activity fixture")
  return {...activity,data:{...activity.data,widget:{kind:"data_view" as const,viewId:source.viewId}}}
 })]
 return {user:{id:ID(90)},graph:value,objective:value.particles[0],target:{organizationId:WORKSPACE,objectiveId:ID(1),revision:0},canvasId:null} as ResearchContext
}
function result():ResearchResult {const items=[table,responses].map((source,i)=>({key:`view${i}`,title:source.name,kind:"data_view" as const,description:"Existing canonical source",dataView:{kind:source.source.kind,sourceViewId:source.viewId},referenceId:null,evidenceIds:[],dependsOn:[]}));let next=300;return {runId:ID(3000),target:context().target,title:"Source plan",summary:"",questions:[],sources:[],items,outputBindings:createResearchOutputBindings(items,()=>ID(++next),[table,responses])}}
beforeEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS","1");vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION","1");mocks.metadata.mockImplementation(async(_org,id)=>({ok:true,data:id===table.viewId?table:responses}));mocks.read.mockResolvedValue({ok:true,data:{receipt:null,view:null}});mocks.write.mockImplementation(async command=>({ok:true,data:{viewId:command.viewId,revision:1}}))})
describe("existing shared table and native response AI bindings",()=>{
 it("lists only current selected-canvas authorized saved-view metadata, never rows or definitions",async()=>{
  const loaded=await withResearchDataViewSources(context());expect(loaded.dataViewSources).toEqual([table,responses])
  const prompt=JSON.parse(researchPrompt(loaded,{prompt:"Plan",skill:"planning",target:loaded.target}))
  expect(prompt.outputs.availableSavedViews).toEqual([table,responses].map(source=>({sourceViewId:source.viewId,kind:source.source.kind,title:source.sourceTitle,name:source.name})))
  for(const absent of ["tableId","versionId","updatedAt","answers","rows","definition","canCreate"])expect(JSON.stringify(prompt)).not.toContain(`"${absent}"`)
  mocks.metadata.mockResolvedValue({ok:false,code:"denied"});expect((await withResearchDataViewSources(context())).dataViewSources).toEqual([])
  vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS","0");mocks.metadata.mockClear();expect((await withResearchDataViewSources(context())).dataViewSources).toBeUndefined();expect(mocks.metadata).not.toHaveBeenCalled()
 })
 it("binds only listed source identities server-side and preserves canonical sources while editing titles",()=>{
  const original=result(),draft=createResearchDraft(original);draft.items[0].title="Reviewed partners";const edited=applyResearchDraft(original,draft)
  expect(edited.outputBindings).toEqual(original.outputBindings)
  const commands=researchDataViewCommands(edited);expect(commands.map(value=>value.command.source)).toEqual([table.source,responses.source]);expect(commands[0].command.name).toBe("Reviewed partners")
  expect(()=>createResearchOutputBindings(original.items,()=>ID(400),[table])).toThrow()
  expect(researchDataViewSchema.safeParse({kind:"table",sourceViewId:table.viewId,tableId:ID(999)}).success).toBe(false)
  const forged=structuredClone(original);forged.items[0].dataView={kind:"table",sourceViewId:ID(999)};expect(()=>researchDataViewCommands(forged)).toThrow()
  const presentation=projectResearchPresentation(edited);expect(presentation.spec.elements.item_view0).toMatchObject({props:{sourceName:"Partners"}})
 })
 it.each(["revoked","unavailable","changed title","new incarnation","removed from canvas"])("rechecks admitted metadata on %s without response reads",async mode=>{
  const current=context(),deps=[{viewId:table.viewId,fingerprint:researchDataViewFingerprint(table)}]
  await expect(assertResearchDataViewSources(current,deps)).resolves.toBeUndefined()
  if(mode==="revoked"||mode==="unavailable")mocks.metadata.mockResolvedValue({ok:false,code:mode==="revoked"?"denied":"unavailable"})
  else if(mode==="removed from canvas")current.graph.particles=[particle(1,"objective")]
  else mocks.metadata.mockResolvedValue({ok:true,data:{...table,...(mode==="changed title"?{sourceTitle:"Changed"}:{updatedAt:"2026-11-03T00:00:00Z"})}})
  await expect(assertResearchDataViewSources(current,deps)).rejects.toMatchObject({code:mode==="unavailable"?"verification_unavailable":"sources_changed"})
 })
 it("uses exact manual writers, keeps mixed outcomes separate, and recovers lost replies without replay",async()=>{
  const value=result();mocks.write.mockResolvedValueOnce({ok:false,code:"unavailable",error:"Lost reply"}).mockResolvedValueOnce({ok:true,data:{viewId:value.outputBindings![1].viewId,revision:1}})
  const effects=await applyResearchDataViewEffects(value);expect(effects.map(effect=>effect.status)).toEqual(["uncertain","created"]);expect(mocks.write).toHaveBeenCalledTimes(2)
  mocks.read.mockImplementation(async command=>({ok:true,data:{receipt:{viewId:command.viewId,revision:1},view:{id:command.viewId,name:command.name,revision:1}}}))
  expect((await inspectResearchDataViewEffects(value)).map(effect=>effect.status)).toEqual(["created","created"])
  await applyResearchDataViewEffects(value);expect(mocks.write).toHaveBeenCalledTimes(2)
  mocks.read.mockResolvedValue({ok:true,data:{receipt:{viewId:value.outputBindings![0].viewId,revision:1},view:null}})
  expect((await applyResearchDataViewEffects(value)).every(effect=>effect.status==="denied")).toBe(true);expect(mocks.write).toHaveBeenCalledTimes(2)
 })
 it("withholds streamed existing-view proposals unless the exact admitted identity remains authorized",async()=>{
  const published:unknown[]=[],item=result().items[0]
  const event={item_id:"message",output_index:0,content_index:0,sequence_number:1,delta:JSON.stringify({items:[item]})} as ResponseTextDeltaEvent
  const factory=(allowed?:boolean,current=true)=>createResearchItemProgress({publish:value=>published.push(value),revalidate:async()=>current,isCanceled:async()=>false,evidence:()=>[],...(allowed===undefined?{}:{allowedDataView:source=>allowed&&source.kind==="table"&&source.sourceViewId===table.viewId})})
  await factory().push(event);await factory(false).push(event);await factory(true,false).push(event);expect(published).toEqual([])
  await factory(true).push(event);expect(published).toHaveLength(1)
 })
})
