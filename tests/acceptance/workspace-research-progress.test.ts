import { describe, expect, it, vi } from "vitest"
import { EventEncoder } from "@ag-ui/encoder"
import { createResearchProgressReceiver, researchProgressSchema, researchProgressWire, type ResearchProgress } from "@/features/workspace-ai/lib/research-progress"
import { readResearchProgress } from "@/features/workspace-ai/lib/research-progress-client"
import { researchProgressStream } from "@/features/workspace-ai/server/research-progress-stream"
import { ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"

const target = {organizationId:WORKSPACE,objectiveId:ID(1),revision:0}
const expected = {runId:ID(2),target,userId:ID(90)}
const identity = {runId:ID(2),requestId:ID(2),scope:{organizationId:WORKSPACE,canvasId:null,userId:ID(90)},target}
const preview = { runId: ID(2), target, title: "Plan preview", summary: "", questions: [], sources: [],
 items: [{ key: "prepare", kind: "note" as const, title: "Prepare", description: "", referenceId: null, evidenceIds: [], dependsOn: [] }] }
function event(sequence: number, extra: Record<string,unknown> = {}): ResearchProgress {
 return researchProgressSchema.parse({...identity,version:1,streamId:ID(3),sequence,emittedAt:NOW,
  ...(sequence===1 ? {kind:"run.started",payload:{}} : {kind:"phase.changed",payload:{phase:"reading"}}),...extra})
}
const encode = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`
function response(text: string, width = 7) {
 const bytes=new TextEncoder().encode(text)
 return new Response(new ReadableStream({start(controller){
  for(let i=0;i<bytes.length;i+=width)controller.enqueue(bytes.slice(i,i+width))
  controller.close()
 }}),{headers:{"Content-Type":"text/event-stream"}})
}
describe("scoped AG-UI research progress",()=>{
 const savedRun = { version:1 as const,id:ID(2),credits:0,status:"succeeded" as const,result:preview,resultRevision:1 as const,applicability:"review_required" as const }
 it.each(["gap","truncated","missing terminal","contradiction","extra event","watermark","foreign run","foreign target","duplicate snapshot","unknown version"])("recovers instead of consuming a %s snapshot", async failure => {
  const run = failure === "foreign run" ? {...savedRun,id:ID(99),result:{...preview,runId:ID(99)}} : failure === "foreign target" ? {...savedRun,result:{...preview,target:{...target,revision:99}}} : savedRun
  const snapshot = {...event(2),kind:"run.snapshot",payload:{watermark:failure==="watermark"?1:2,run},...(failure==="unknown version"?{version:2}:{})}
  const custom = (value: unknown) => encode({type:"CUSTOM",name:"coach-house.research.v1",value})
  let wire = encode(researchProgressWire(event(1))) + custom(snapshot)
  if(failure==="duplicate snapshot") wire+=custom({...snapshot,sequence:3,payload:{...snapshot.payload,watermark:3}})
  if(failure!=="missing terminal") wire+=encode(researchProgressWire(event(failure==="gap"?4:3,{kind:"run.terminal",payload:{status:failure==="contradiction"?"failed":"succeeded"}})))
  if(failure==="extra event") wire+=encode(researchProgressWire(event(4)))
  if(failure==="truncated")wire+="data: {"
  expect(await readResearchProgress(response(wire,1),expected,vi.fn())).toBeUndefined()
 })
 it("does not return a saved snapshot when the subscription is canceled before completion",async()=>{
  const controller=new AbortController(),phase=vi.fn()
  let push!:(bytes:Uint8Array)=>void
  const stream=new Response(new ReadableStream<Uint8Array>({start(output){push=bytes=>output.enqueue(bytes)}}),{headers:{"Content-Type":"text/event-stream"}})
  const pending=readResearchProgress(stream,expected,phase,controller.signal)
  push(new TextEncoder().encode([event(1),event(2,{kind:"run.snapshot",payload:{watermark:2,run:savedRun}})].map(value=>encode(researchProgressWire(value))).join("")))
  controller.abort()
  expect(await pending).toBeUndefined()
 })
 it.each(["failed","canceled"] as const)("returns the saved %s snapshot without inventing content",async status=>{
  const run={...savedRun,status,result:null,resultRevision:null,applicability:"unavailable" as const}
  const stream=researchProgressStream(identity,async()=>Response.json({run}))
  const snapshot=await readResearchProgress(stream,expected,vi.fn())
  expect(snapshot?.payload.run).toEqual(run)
 })
 it("returns the exact saved base including source revisions, but never from an oversized snapshot",async()=>{
  for(const oversized of [false,true]) {
   const result={...preview,dependencies:{version:1 as const,contextFingerprint:"a".repeat(64),records:[]},items:oversized?Array.from({length:12},(_,i)=>({...preview.items[0],key:`item${i}`,description:"界".repeat(1800)})):preview.items}
   const snapshot=await readResearchProgress(researchProgressStream(identity,async()=>Response.json({run:{...savedRun,result}})),expected,vi.fn())
   if(oversized)expect(snapshot).toBeUndefined()
   else expect(snapshot?.payload.run.result).toEqual(result)
  }
 })

 it.each([
  { resultRevision: 0 }, { resultRevision: null }, { version: 2 },
  { id: ID(99) }, { result: { ...preview, target: { ...target, revision: 2 } } },
  { result: { privateBody: "Invalid saved result" } }, { status: "running" },
  { applicability: "already_applied" },
  { result: null, appliedObjectiveId: ID(99), applicability: "already_applied" },
 ])("withholds readiness and completion for an invalid saved snapshot: %j", async patch => {
  const stream=researchProgressStream(identity,async()=>Response.json({run:{
   version:1,id:ID(2),credits:0,status:"succeeded",result:preview,resultRevision:1,applicability:"review_required",...patch,
  }}))
  const wire=await stream.text()
  expect(wire).not.toContain('"result.ready"');expect(wire).not.toContain('"run.terminal"')
  expect(wire).not.toContain("Invalid saved result")
 })
 it("does not advertise success from an unsuccessful HTTP response", async () => {
  const stream=researchProgressStream(identity,async()=>Response.json({run:{
   version:1,id:ID(2),credits:0,status:"succeeded",result:preview,resultRevision:1,applicability:"review_required",
  }},{status:409}))
  const wire=await stream.text()
  expect(wire).toContain('"recovering"');expect(wire).not.toContain('"result.ready"');expect(wire).not.toContain('"run.terminal"')
 })
 it.each(["duplicate ready","failed","canceled"])("requires snapshot recovery after %s follows durable readiness", failure => {
  const receive=createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  const ready={kind:"result.ready",resultRevision:1,payload:{resultId:ID(2),applicability:"review_required"}}
  receive(researchProgressWire(event(2,ready)))
  expect(()=>receive(researchProgressWire(event(3,failure==="duplicate ready"?ready:{kind:"run.terminal",payload:{status:failure}})))).toThrow()
 })
 it("does not re-advertise an already applied result for review", async () => {
  const stream=researchProgressStream({...identity,target:{mode:"new_objective",organizationId:WORKSPACE,canvasId:null,revision:0}},async()=>Response.json({run:{
   version:1,id:ID(2),credits:0,status:"succeeded",result:null,appliedObjectiveId:ID(99),resultRevision:1,applicability:"already_applied",
  }}))
  const wire=await stream.text()
  expect(wire).not.toContain('"result.ready"');expect(wire).toContain('"run.terminal"')
 })
 it("delivers a complete validated preview once across fragmented frames without saved authority", async () => {
  const onPreview = vi.fn()
  const candidate = event(2, {kind:"preview.updated",resultRevision:0,payload:{result:preview}})
  const wire = [event(1),candidate,candidate].map(value=>encode(researchProgressWire(value))).join("")
  await readResearchProgress(response(wire,1),expected,vi.fn(),undefined,onPreview)
  expect(onPreview).toHaveBeenCalledExactlyOnceWith(preview)
 })
 it.each([
  {...preview,runId:ID(99)}, {...preview,target:{...target,revision:1}},
  {...preview,items:[preview.items[0],preview.items[0]]},
  {...preview,items:[{...preview.items[0],dependsOn:["missing"]}]},
  {...preview,dependencies:{version:1,contextFingerprint:"a".repeat(64),records:[]}},
 ])("rejects foreign, incomplete or internal preview payloads", result => {
  const receive = createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  expect(()=>receive({type:"CUSTOM",name:"coach-house.research.v1",value:{...event(2),kind:"preview.updated",resultRevision:0,payload:{result}}})).toThrow()
 })
 it.each(["preview.updated","result.ready"])("rejects a replacement preview after %s", kind => {
  const receive=createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  receive(researchProgressWire(event(2,{kind,resultRevision:kind==="preview.updated"?0:1,payload:kind==="preview.updated"?{result:preview}:{resultId:ID(2),applicability:"review_required"}})))
  expect(()=>receive(researchProgressWire(event(3,{kind:"preview.updated",resultRevision:0,payload:{result:preview}})))).toThrow()
 })
 it("keeps dependency fingerprints out of preview transport and falls back without gaps for oversized previews", async () => {
  for (const oversized of [false,true]) {
   const candidate={...preview,dependencies:{version:1 as const,contextFingerprint:"a".repeat(64),records:[]},
    items:oversized?Array.from({length:12},(_,i)=>({...preview.items[0],key:`item${i}`,description:"界".repeat(1800)})):preview.items}
   const stream=researchProgressStream(identity,async(onPhase,onPreview)=>{
    onPreview(candidate);onPhase("saving")
    return Response.json({run:{version:1,id:ID(2),credits:0,status:"succeeded",result:candidate,resultRevision:1,applicability:"review_required"}})
   })
   const wire=await stream.text(),onPreview=vi.fn(),onPhase=vi.fn()
   const previewFrame = wire.split("\n\n").find(frame => frame.includes('"preview.updated"'))
   expect(previewFrame ?? "").not.toContain("contextFingerprint")
   await readResearchProgress(response(wire),expected,onPhase,undefined,onPreview)
   expect(onPreview).toHaveBeenCalledTimes(oversized?0:1)
   expect(onPhase).toHaveBeenCalledExactlyOnceWith("saving")
   expect(wire).toContain('"result.ready"')
  }
 })
 it("uses the pinned encoder/client across fragmented UTF-8 frames without applying state",async()=>{
  const encoder=new EventEncoder({accept:"text/event-stream"}),phase=vi.fn()
  const start={...researchProgressWire(event(1)),metadata:{coachHouse:event(1),label:"Café"}}
  await readResearchProgress(response(encoder.encode(start)+encoder.encode(researchProgressWire(event(2))),1),expected,phase)
  expect(phase).toHaveBeenCalledExactlyOnceWith("reading")
 })
 it("ignores duplicates and stops at gaps, rather than buffering or applying later events",async()=>{
  const phase=vi.fn()
  const wire=[1,2,2,4,3,5].map(i=>encode(researchProgressWire(event(i)))).join("")
  await readResearchProgress(response(wire),expected,phase)
  expect(phase).toHaveBeenCalledExactlyOnceWith("reading")
 })
 it.each([
  { emittedAt: "2026-10-31T23:59:59.000Z" },
  { kind: "phase.changed", payload: { phase: "repairing" } },
  { kind: "preview.cleared", resultRevision: 0, payload: {} },
 ])("rejects changed content under an accepted sequence: %j", patch => {
  const receive = createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  receive(researchProgressWire(event(2)))
  expect(receive(researchProgressWire(event(2)))).toBeNull()
  expect(() => receive(researchProgressWire(event(2, patch)))).toThrow("sequence changed")
 })
 it("rejects a restarted start event under the old stream identity and sequence", () => {
  const receive = createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  receive(researchProgressWire(event(2)))
  expect(() => receive(researchProgressWire(event(1, { emittedAt: "2026-10-31T23:59:59.000Z" })))).toThrow("sequence changed")
 })
 it.each([
  {runId:ID(99)},{requestId:ID(99)},{streamId:ID(99)},
  {scope:{...identity.scope,organizationId:ID(99)}},{scope:{...identity.scope,canvasId:ID(99)}},
  {scope:{...identity.scope,userId:ID(99)}},{target:{...target,revision:1}},
 ])("rejects a changed run/scope before displaying another phase: %j",change=>{
  const receive=createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  expect(()=>receive(researchProgressWire(event(2,change)))).toThrow()
 })
 it("rejects unknown versions, private phase payloads and arbitrary state patches",()=>{
  for(const value of [
   {type:"CUSTOM",name:"coach-house.research.v1",value:{...event(1),version:2}},
   {type:"CUSTOM",name:"coach-house.research.v1",value:{...event(2),payload:{phase:"reading",query:"Private query"}}},
   {type:"STATE_DELTA",delta:[{op:"replace",path:"/particles",value:[]}]},
  ])expect(()=>createResearchProgressReceiver(expected)(value)).toThrow()
 })
 it("does not treat result readiness as acceptance or accept events after termination",()=>{
  const receive=createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  const ready = event(2,{kind:"result.ready",resultRevision:1,payload:{resultId:ID(2),applicability:"review_required"}})
  expect(receive(researchProgressWire(ready))?.kind).toBe("result.ready")
  receive(researchProgressWire(event(3,{kind:"run.terminal",payload:{status:"succeeded"}})))
  expect(()=>receive(researchProgressWire(event(4)))).toThrow()
 })
 it.each(["malformed","oversized","unknown"])("stops a %s frame before later progress",async kind=>{
  const phase=vi.fn(),bad=kind==="malformed"?"data: {bad\n\n":kind==="oversized"?`data: ${"x".repeat(65537)}`:encode({type:"unknown"})
  await readResearchProgress(response(encode(researchProgressWire(event(1)))+bad+encode(researchProgressWire(event(2))),4096),expected,phase)
  expect(phase).not.toHaveBeenCalled()
 })
 it("returns for durable snapshot recovery after truncation or unmount",async()=>{
  await readResearchProgress(response(encode(researchProgressWire(event(1)))+"data: {"),expected,vi.fn())
  const canceled=vi.fn(),controller=new AbortController()
  const stream=new Response(new ReadableStream({cancel:canceled}))
  const pending=readResearchProgress(stream,expected,vi.fn(),controller.signal)
  controller.abort()
  await pending
  expect(canceled).toHaveBeenCalledTimes(1)
 })
 it("emits actual phases before persistence finishes, then an authorized saved snapshot",async()=>{
  let release!:()=>void
  const saved=new Promise<void>(resolve=>{release=resolve}),phase=vi.fn(()=>release())
  const stream=researchProgressStream(identity,async onPhase=>{
   onPhase("reading");await saved
   return Response.json({run:{version:1,id:ID(2),credits:0,status:"succeeded",result:{...preview,summary:"Private saved body"},resultRevision:1,applicability:"review_required"}})
  })
  const [forClient,forInspection]=stream.body!.tee()
  const text=new Response(forInspection).text()
  const savedSnapshot = await readResearchProgress(new Response(forClient,{headers:stream.headers}),expected,phase)
  expect(phase).toHaveBeenCalledExactlyOnceWith("reading")
  const wire=await text
  expect(wire).toContain('"result.ready"');expect(wire).toContain('"RUN_FINISHED"')
  expect(savedSnapshot?.payload.run.result?.summary).toBe("Private saved body")
  expect(savedSnapshot?.payload.watermark).toBe(savedSnapshot?.sequence)
  expect(wire).toContain('"run.snapshot"')
  expect(stream.headers.get("cache-control")).toBe("no-store, no-transform")
 })
 it("disconnects presentation without canceling execution or inventing a terminal event",async()=>{
  let release!:()=>void
  const pending=new Promise<void>(resolve=>{release=resolve}),finished=vi.fn()
  const stream=researchProgressStream(identity,async()=>{await pending;finished();return Response.json({error:"Private exception",reserved:true})})
  const reader=stream.body!.getReader()
  await reader.read();await reader.cancel();release()
  await pending;await Promise.resolve()
  expect(finished).toHaveBeenCalledTimes(1)
 })
})


it("binds the first new-objective stream event to its requested canvas", () => {
 const target = {mode:"new_objective" as const,organizationId:WORKSPACE,canvasId:ID(60),revision:0}
 const receive=createResearchProgressReceiver({...expected,target})
 expect(()=>receive(researchProgressWire(event(1,{target})))).toThrow(/scope changed/)
 const valid=createResearchProgressReceiver({...expected,target})
 expect(valid(researchProgressWire(event(1,{target,scope:{...identity.scope,canvasId:ID(60)}})))?.kind).toBe("run.started")
})

describe("incremental item presentation", () => {
 const item = { key:"prepare", kind:"note" as const, title:"Prepare", description:"" }
 it("streams inert items and clears them without declaring a result ready", async () => {
  const partial=vi.fn()
  const wire=await researchProgressStream(identity,async(_phase,_preview,onPartial)=>{
   onPartial(item);onPartial(null)
   return Response.json({run:{version:1,id:ID(2),credits:0,status:"failed",result:null,resultRevision:null,applicability:"unavailable"}})
  }).text()
  const snapshot=await readResearchProgress(response(wire,1),expected,vi.fn(),undefined,vi.fn(),partial)
  expect(partial.mock.calls).toEqual([[item],[null]])
  expect(snapshot?.payload.run.status).toBe("failed")
  expect(wire).not.toContain('"result.ready"')
 })
 it.each(["duplicate","overflow","binding","after ready","after complete"])("rejects %s partial items", failure=>{
  const receive=createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  let sequence=2
  const send=(value:unknown)=>receive({type:"CUSTOM",name:"coach-house.research.v1",value:{...event(sequence++),kind:"preview.item",resultRevision:0,payload:{item:value}}})
  if(failure==="duplicate")send(item)
  if(failure==="overflow")for(let i=0;i<12;i++)send({...item,key:`item${i}`})
  if(failure==="after ready")receive(researchProgressWire(event(sequence++,{kind:"result.ready",resultRevision:1,payload:{resultId:ID(2),applicability:"review_required"}})))
  if(failure==="after complete")receive(researchProgressWire(event(sequence++,{kind:"preview.updated",resultRevision:0,payload:{result:preview}})))
  expect(()=>send(failure==="binding"?{...item,referenceId:"private"}:item)).toThrow()
 })
 it("allows a repaired attempt only after clearing the previous item identities",()=>{
  const receive=createResearchProgressReceiver(expected)
  receive(researchProgressWire(event(1)))
  receive(researchProgressWire(event(2,{kind:"preview.item",resultRevision:0,payload:{item}})))
  receive(researchProgressWire(event(3,{kind:"preview.cleared",resultRevision:0,payload:{}})))
  expect(receive(researchProgressWire(event(4,{kind:"preview.item",resultRevision:0,payload:{item:{...item,title:"Repaired"}}})))?.kind).toBe("preview.item")
 })
})

it("withholds source effect identities from inert previews and retains them exactly in saved stream recovery", async () => {
 const result = { ...preview, items: [{ ...preview.items[0], kind: "data_view" as const, dataView: { kind: "projects" as const } }],
  outputBindings: [{ kind: "data_view" as const, itemKey: "prepare", viewId: ID(201), requestId: ID(202) }] }
 const updates = vi.fn()
 const snapshot = await readResearchProgress(researchProgressStream(identity, async (_phase, onPreview) => {
  onPreview(result)
  return Response.json({ run: { version: 1, id: ID(2), credits: 0, status: "succeeded", result, resultRevision: 1, applicability: "review_required" } })
 }), expected, vi.fn(), undefined, updates)
 expect(snapshot?.payload.run.result?.outputBindings).toEqual(result.outputBindings)
 const generated = updates.mock.calls[0][0]
 expect(generated.outputBindings).toBeUndefined()
 expect(generated.items[0].dataView).toEqual({ kind: "projects" })
})
