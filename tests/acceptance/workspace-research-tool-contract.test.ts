import { z } from "zod"
import { knowledgeSearchSchema, knowledgeProviderSearchSchema } from "@/features/workspace-ai/research-types"
import { describe, expect, it } from "vitest"
import { knowledgeDisclosure, retainKnowledgeEvidence } from "@/features/workspace-ai/server/knowledge-evidence"
import { knowledgeReadFailure, KnowledgeChangedError } from "@/features/workspace-ai/server/knowledge-failure"
import { knowledgeDisclosedRecordSchema, validateKnowledgeToolResult } from "@/features/workspace-ai/lib/knowledge-tool-contract"
import type { KnowledgeRecord } from "@/features/workspace-ai/research-types"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"
const scope = { organizationId: WORKSPACE, canvasId: null }
const envelope = { version: 1, scope, effect: "internal_read", disclosure: { destination: "configured_workspace_model", sensitivity: "organization_private", publicDisclosure: false } }
const record = (content = "Private approved excerpt"): KnowledgeRecord => ({ id: `document:${ID(1)}`, kind: "document", title: "Evidence", href: "/workspace", revision: "1", content, contentAvailable: true })
const read = () => ({ ...envelope, results: [knowledgeDisclosure(record(), "read", 6000)] })
const search = () => ({ ...envelope, results: [knowledgeDisclosure(record(), "search", 480)], unavailableKinds: [], limit: 8, note: "Bounded keyword search" })

describe("deterministic knowledge tool output boundary", () => {
  it("binds internal/private disclosure and exact scope without asserting processing approval", () => {
    const value = read()
    expect(validateKnowledgeToolResult("read_workspace", value, scope)).toEqual(value)
    expect(() => validateKnowledgeToolResult("read_workspace", read(), { ...scope, organizationId: ID(99) })).toThrow(/scope/)
    expect(() => validateKnowledgeToolResult("read_workspace", read(), { ...scope, canvasId: ID(99) })).toThrow(/scope/)
    expect(() => validateKnowledgeToolResult("external_search", search(), scope)).toThrow(/not available/)
  })
  it.each([
    { effect: "canonical_write" }, { disclosure: { ...envelope.disclosure, publicDisclosure: true } },
    { disclosure: { ...envelope.disclosure, destination: "public_search" } }, { credentials: "secret" }, { version: 2 },
  ])("rejects forged disclosure or envelope fields %j", patch => {
    expect(() => validateKnowledgeToolResult("read_workspace", { ...read(), ...patch }, scope)).toThrow()
  })
  it.each([
    { href: "https://storage.example/private?token=secret" }, { href: "//outside.example" }, { kind: "person" }, { storage_path: "private/path" },
    { status: "available", contentAvailable: false }, { status: "available", recovery: "restart_research" },
    { evidence: { ...read().results[0].evidence, characters: 0 } }, { title: "x".repeat(241) }, { revision: "x".repeat(2001) },
  ])("rejects unsafe or contradictory source output %j", patch => {
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: [{ ...read().results[0], ...patch }] }, scope)).toThrow()
  })
  it("enforces the unchanged four-reference/6000 UTF-16 limit independently of UTF-8 bytes and token estimates", () => {
    const text = "界".repeat(6000), bounded = knowledgeDisclosure(record(text), "read", 6000)
    expect(bounded.evidence.characters).toBe(6000)
    expect(Buffer.byteLength(bounded.content)).toBe(18000)
    expect(validateKnowledgeToolResult("read_workspace", { ...envelope, results: [bounded] }, scope)).toHaveProperty("results")
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: [bounded, ...read().results] }, scope)).toThrow(/budget/)
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: Array(5).fill(read().results[0]) }, scope)).toThrow()
    const emoji = knowledgeDisclosure(record("😀".repeat(4000)), "read", 6000)
    expect(emoji.evidence.characters).toBe(6000); expect(emoji.content.length).toBe(6000)
  })
  it("keeps search at eight matches, 480 characters each and six unavailable kinds", () => {
    expect(validateKnowledgeToolResult("search_workspace", search(), scope)).toHaveProperty("limit", 8)
    expect(() => validateKnowledgeToolResult("search_workspace", { ...search(), results: Array(9).fill(search().results[0]) }, scope)).toThrow()
    expect(() => validateKnowledgeToolResult("search_workspace", { ...search(), results: [knowledgeDisclosure(record("x".repeat(481)), "search", 481)] }, scope)).toThrow()
    expect(() => validateKnowledgeToolResult("search_workspace", { ...search(), unavailableKinds: Array(7).fill("person") }, scope)).toThrow()
  })
  it.each([
    ["unsupported_format", "choose_source"], ["exhausted_budget", "narrow_source"], ["empty", "choose_source"], ["unavailable", "retry_read"],
  ] as const)("reports verified %s extraction separately from complete body evidence", (availability, recovery) => {
    const disclosed = knowledgeDisclosure({ ...record(), contentAvailable: false, availability }, "read", 6000)
    expect(disclosed).toMatchObject({ status: availability, recovery, contentAvailable: false, evidence: { coverage: "unavailable", characters: 0 } })
    expect(knowledgeDisclosedRecordSchema.parse(disclosed)).toEqual(disclosed)
  })
  it("never upgrades unknown, denied or transient errors into confirmed revocation or change", () => {
    const outputs = [new Error("permission denied private details"), new Error("not found private id"), new Error("timeout"), null]
      .map(error => knowledgeReadFailure("person:requested", error))
    expect(outputs.every(value => JSON.stringify(value) === JSON.stringify(outputs[0]))).toBe(true)
    expect(outputs[0]).toMatchObject({ status: "unavailable", recovery: "retry_read" })
    expect(JSON.stringify(outputs)).not.toContain("private")
    expect(knowledgeReadFailure("person:requested", new KnowledgeChangedError())).toMatchObject({ status: "changed", recovery: "restart_research" })
    expect(() => validateKnowledgeToolResult("read_workspace", { ...envelope, results: [{ ...outputs[0], error: "secret database text" }] }, scope)).toThrow()
  })
})

it("keeps keyword selection explicit and supplies a strict nullable provider mode", () => {
  expect(knowledgeSearchSchema.parse({ query: "budget", kinds: ["document"] }).documentMode).toBeUndefined()
  expect(knowledgeSearchSchema.parse({ query: "budget", kinds: ["document"], documentMode: "keyword" }).documentMode).toBe("keyword")
  expect(() => knowledgeSearchSchema.parse({ query: "budget", kinds: ["document"], documentMode: "arbitrary" })).toThrow()
  const schema = z.toJSONSchema(knowledgeProviderSearchSchema)
  expect(schema.required).toContain("documentMode")
  expect(schema.required).toContain("uploadCursor")
  expect(schema.required).toContain("pdfWindow")
  expect(knowledgeProviderSearchSchema.parse({ query: "budget", kinds: ["document"], documentMode: null, uploadCursor: null, pdfWindow: null }).documentMode).toBeNull()
})


it("validates native range inputs and binds returned locations to their requested scope", async () => {
 const { knowledgeReadSchema, knowledgeProviderReadSchema } = await import("@/features/workspace-ai/research-types")
 const id=record().id
 expect(z.toJSONSchema(knowledgeProviderReadSchema).required).toContain("documentRanges")
 expect(knowledgeReadSchema.parse({ids:[id]}).documentRanges).toBeUndefined()
 for(const range of [{id,start:-1,end:10},{id,start:10,end:10},{id,start:0,end:6001},{id,start:199999,end:200001},{id:"person:any",start:0,end:10}])
  expect(()=>knowledgeReadSchema.parse({ids:[id],documentRanges:[range]})).toThrow()
 const args={ids:[id],documentRanges:[{id,start:100,end:200}]}
 const value={...envelope,results:[knowledgeDisclosure(record("x".repeat(500)),"read",6000,{start:100,end:200})]}
 expect(validateKnowledgeToolResult("read_workspace",value,scope,args)).toEqual(value)
 expect(()=>validateKnowledgeToolResult("read_workspace",value,scope,{...args,documentRanges:[{id,start:0,end:100}]})).toThrow(/range/)
 expect(()=>validateKnowledgeToolResult("read_workspace",value,scope,{...args,documentRanges:[...args.documentRanges,...args.documentRanges]})).toThrow(/range/)
 expect(()=>validateKnowledgeToolResult("read_workspace",value,scope,{...args,documentRanges:[{id:"document:other",start:100,end:200}]})).toThrow(/range/)
 const forged=structuredClone(value);forged.results[0].evidence.textCoverage!.complete=true
 expect(()=>validateKnowledgeToolResult("read_workspace",forged,scope,args)).toThrow()
})

it("retains exact search passage coverage alongside range reads without double counting or losing read time",()=>{
 const whole=record("a".repeat(1000))
 const passage=(start:number,end:number)=>knowledgeDisclosure({...whole,content:whole.content.slice(start,end),excerptSourceLength:1000,
  excerptLocation:{kind:"reader_text",start,end},contentTruncated:true},"search",480)
 const first=passage(100,300),second=passage(200,400)
 expect(validateKnowledgeToolResult("search_workspace",{...search(),results:[first,second]},scope)).toHaveProperty("results")
 const combined=retainKnowledgeEvidence(first.evidence,second.evidence)
 expect(combined).toMatchObject({characters:300,readAt:null,textCoverage:{complete:false,ranges:[{start:100,end:400}]}})
 const read=knowledgeDisclosure(whole,"read",6000)
 const retained=retainKnowledgeEvidence(read.evidence,combined)
 expect(retained).toMatchObject({coverage:"complete",characters:1000,readAt:read.evidence.readAt,textCoverage:{complete:true}})
 const forged=structuredClone(first);forged.evidence.textCoverage!.ranges=[{start:101,end:301}]
 expect(()=>validateKnowledgeToolResult("search_workspace",{...search(),results:[forged]},scope)).toThrow()
})

it("bounds continuation coverage and rejects forged source scope and impossible counts",()=>{
 const uploads={scope:"library",candidates:20,attempted:5,read:5,unread:15,pending:15,unreadPriorPages:0,continuation:ID(91),nextPage:ID(92)}
 const value={...search(),uploads},args={query:"budget",kinds:["document"],uploadCursor:null}
 expect(validateKnowledgeToolResult("search_workspace",value,scope,args)).toEqual(value)
 for(const patch of [{candidates:21},{attempted:6},{read:6},{unread:21},{pending:16},{unreadPriorPages:161},{continuation:null},{nextPage:"raw-filter"}])
  expect(()=>validateKnowledgeToolResult("search_workspace",{...value,uploads:{...uploads,...patch}},scope,args)).toThrow()
 expect(()=>validateKnowledgeToolResult("search_workspace",{...value,results:[]},scope,{query:"budget",kinds:["person"]})).toThrow(/coverage scope/)
 expect(()=>validateKnowledgeToolResult("search_workspace",{...value,unavailableKinds:["document"]},scope,args)).toThrow(/coverage scope/)
 expect(()=>knowledgeSearchSchema.parse({...args,uploadCursor:"raw-filter"})).toThrow()
})


it("binds PDF windows to their requested origin and rejects fabricated window coverage", async()=>{
 const {knowledgeReadSchema,knowledgeProviderReadSchema}=await import("@/features/workspace-ai/research-types")
 const id="file:packet"
 const detail={...record("Governance"),id,kind:"document" as const,contentScope:"text" as const,
   fileText:{byteHash:"a".repeat(64),byteLength:100,textHash:"b".repeat(64),totalCharacters:10},pdfText:{startPage:41,totalPages:100,pages:[{page:41,start:0,end:10}]}}
 const args={ids:[id],documentRanges:[{id,start:0,end:10,pdfStartPage:41}]}
 const value={...envelope,results:[knowledgeDisclosure(detail,"read",6000)]}
 expect(validateKnowledgeToolResult("read_workspace",value,scope,args)).toEqual(value)
 expect(()=>validateKnowledgeToolResult("read_workspace",value,scope,{...args,documentRanges:[{id,start:0,end:10,pdfStartPage:1}]})).toThrow(/window/)
 for(const pdfStartPage of [0,-1,1.5,2147483648]) expect(knowledgeReadSchema.safeParse({ids:[id],documentRanges:[{id,start:0,end:10,pdfStartPage}]}).success).toBe(false)
 expect(knowledgeReadSchema.safeParse({ids:["document:core"],documentRanges:[{id:"document:core",start:0,end:10,pdfStartPage:41}]}).success).toBe(false)
 expect(JSON.stringify(z.toJSONSchema(knowledgeProviderReadSchema))).toContain('"pdfStartPage"')
 for(const patch of [{startPage:1},{pages:[1]},{processedPages:41},{unreadPages:[41]},{priorWindows:[{...value.results[0].evidence.pdf,textCoverage:value.results[0].evidence.textCoverage}]}]) {
  const forged=structuredClone(value);Object.assign(forged.results[0].evidence.pdf!,patch)
  expect(()=>validateKnowledgeToolResult("read_workspace",forged,scope,args)).toThrow()
 }
})

it("binds selected PDF search results and no-match coverage to the exact file and window",()=>{
 const id=`file:${ID(10)}`
 const detail:KnowledgeRecord={...record("Governance"),id,fileText:{byteHash:"a".repeat(64),byteLength:100,textHash:"b".repeat(64),totalCharacters:10},pdfText:{startPage:41,totalPages:100,pages:[{page:41,start:0,end:10}]},contentScope:"text",excerptSourceLength:10,excerptLocation:{kind:"reader_text",start:0,end:10}}
 const hit=knowledgeDisclosure(detail,"search",480),evidence={...hit.evidence,coverage:"metadata_only",characters:0,location:undefined,pdf:{...hit.evidence.pdf!,pages:[]},textCoverage:{...hit.evidence.textCoverage!,ranges:[]}}
 const value={...envelope,results:[hit],limit:8,unavailableKinds:[],note:"Selected window",pdfWindow:{id,evidence}}
 const args={query:"governance",kinds:["document"],pdfWindow:{id,startPage:41}}
 expect(()=>validateKnowledgeToolResult("search_workspace",value,scope,args)).not.toThrow()
 for(const patch of [{pdfWindow:{id,startPage:1}},{pdfWindow:{id:`file:${ID(11)}`,startPage:41}},{pdfWindow:null},{kinds:["document","person"]},{documentMode:"hybrid"},{uploadCursor:ID(77)}])
  expect(()=>validateKnowledgeToolResult("search_workspace",value,scope,{...args,...patch})).toThrow(/scope/)
 expect(()=>validateKnowledgeToolResult("search_workspace",{...value,pdfWindow:undefined},scope,args)).toThrow(/scope/)
 expect(()=>validateKnowledgeToolResult("search_workspace",{...value,results:[]},scope,args)).not.toThrow()
 for(const startPage of [0,-1,1.5,2147483648])expect(knowledgeSearchSchema.safeParse({...args,pdfWindow:{id,startPage}}).success).toBe(false)
 expect(knowledgeSearchSchema.safeParse({...args,pdfWindow:{id:"document:core",startPage:41}}).success).toBe(false)
})
