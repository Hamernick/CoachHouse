import { describe, expect, it } from "vitest"
import { knowledgeDisclosure, retainKnowledgeEvidence } from "@/features/workspace-ai/server/knowledge-evidence"
import { researchResultSchema, researchSourceSchema, type KnowledgeRecord } from "@/features/workspace-ai/research-types"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import { particleKnowledgeRecord } from "@/features/workspace-ai/server/knowledge-records"
import { ID, WORKSPACE, particle, graph } from "./fixtures/particle-fixtures"
import { researchPlanOperations } from "@/features/workspace-particles/lib/research-plan"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { particleGraphSchema } from "@/features/workspace-particles/lib/particle-schema"
import { particlePlanSchema, particlePlanProposalSchema, planFromProposal } from "@/features/workspace-particles/lib/particle-plan-schema"

const record: KnowledgeRecord = { id: `particle:${ID(2)}`, kind: "particle", title: "Evidence", content: "A".repeat(7000), revision: "1", href: "/workspace", contentAvailable: true }
describe("research evidence envelopes", () => {
  it("bounds disclosed text and preserves upstream truncation and extraction scope", () => {
    expect(knowledgeDisclosure(record,"read",6000)).toMatchObject({content:"A".repeat(6000),truncated:true,evidence:{coverage:"excerpt",characters:6000,scope:"record"}})
    expect(knowledgeDisclosure({...record,content:"body",contentTruncated:true,contentScope:"document_body"},"read",6000)).toMatchObject({evidence:{coverage:"excerpt",scope:"document_body",characters:4}})
    expect(knowledgeDisclosure({...record,content:"body",contentScope:"document_body"},"read",6000)).toMatchObject({evidence:{coverage:"complete",scope:"document_body"}})
  })
  it("projects only approved fields, never reader internals or storage paths", () => {
    const internal={...record,storage_path:"private/library/secret",searchContent:"internal index",credentials:"never disclose"}
    const disclosed=knowledgeDisclosure(internal,"read",6000)
    expect(disclosed).not.toHaveProperty("storage_path")
    expect(disclosed).not.toHaveProperty("searchContent")
    expect(disclosed).not.toHaveProperty("credentials")
  })
  it("reports upstream record clipping instead of labeling a bounded record complete", () => {
    const objective=particle(1,"objective")
    objective.description="A".repeat(21000)
    const projected=particleKnowledgeRecord(objective)
    expect(projected.content.length).toBe(20000)
    expect(projected.contentTruncated).toBe(true)
    expect(knowledgeDisclosure(projected,"read",20000).evidence.coverage).toBe("excerpt")
  })
  it("persists server evidence through result binding and reload without upgrading legacy citations", () => {
    const evidence=knowledgeDisclosure(record,"read",6000).evidence
    const source={id:record.id,title:record.title,href:record.href,revision:record.revision,checkedAt:evidence.checkedAt,kind:"workspace" as const,evidence}
    const draft={title:"Plan",summary:"Proposed",questions:[],decisions:[],removeReferences:[],items:[{key:"next",title:"Next step",kind:"note",description:"Proposed",referenceId:null,evidenceIds:[record.id],dependsOn:[]}]}
    const result=bindResearch(JSON.stringify(draft),[source],{organizationId:WORKSPACE,objectiveId:ID(1),revision:0},ID(9))
    expect(researchResultSchema.parse(JSON.parse(JSON.stringify(result))).sources).toEqual([source])
    const {evidence:_evidence,...legacy}=source
    expect(researchSourceSchema.parse(legacy)).not.toHaveProperty("evidence")
    expect(()=>researchSourceSchema.parse({...source,evidence:{...evidence,coverage:"verified"}})).toThrow()
    expect(()=>researchSourceSchema.parse({...source,evidence:{...evidence,storage_path:"private"}})).toThrow()
  })
  it("preserves actual disclosure and retained contact scope through proposal, acceptance and graph reload",async()=>{
    const evidence=knowledgeDisclosure({...record,contentScope:"document_body"},"read",6000).evidence
    const contact:KnowledgeRecord={id:`person:${ID(3)}`,kind:"person",title:"Contact",href:"/workspace",revision:"1",content:"Approved email field",contentAvailable:true,contactFields:["email"]}
    const email=knowledgeDisclosure(contact,"read",6000).evidence
    const notes=knowledgeDisclosure({...contact,content:"N".repeat(7000),contactFields:["notes"]},"read",3000).evidence
    const retained=retainKnowledgeEvidence(email,notes)
    const sources=[
      {id:record.id,title:record.title,href:record.href,revision:record.revision,checkedAt:evidence.checkedAt,kind:"workspace" as const,evidence},
      {id:contact.id,title:contact.title,href:contact.href,revision:contact.revision,checkedAt:retained.checkedAt,kind:"workspace" as const,evidence:retained},
      {id:"https://example.org/legacy",title:"Legacy citation",href:"https://example.org/legacy",revision:null,checkedAt:evidence.checkedAt,kind:"web" as const},
      {id:`file:${ID(17)}`,title:"Board packet",href:"/workspace",revision:"1",checkedAt:evidence.checkedAt,kind:"workspace" as const,evidence:knowledgeDisclosure({id:`file:${ID(17)}`,kind:"document",title:"Board packet",href:"/workspace",revision:"1",content:"Opening.\n\nGovernance.",contentAvailable:true,contentScope:"text",fileText:{byteHash:"a".repeat(64),byteLength:100,textHash:"b".repeat(64),totalCharacters:21},pdfText:{totalPages:3,pages:[{page:1,start:0,end:8},{page:2,start:10,end:21},{page:3,start:21,end:21}]}},"read",11,{start:10,end:21}).evidence},
    ]
    const pdfEvidence = sources[3].evidence!
    pdfEvidence.pdf = {...pdfEvidence.pdf!,totalPages:90,startPage:41,pages:[42],unreadPages:[43],priorWindows:[{totalPages:90,startPage:1,processedPages:40,pages:[2],unreadPages:[3],textCoverage:{availableCharacters:100,totalCharacters:null,complete:false,ranges:[{start:10,end:21}]}}]}
    const draft={title:"Plan",summary:"Proposed",questions:[],decisions:[],removeReferences:[],items:[{key:"next",title:"Next step",kind:"note",description:"Proposed",referenceId:null,evidenceIds:sources.map(source=>source.id),dependsOn:[]}]}
    const result=bindResearch(JSON.stringify(draft),sources,{organizationId:WORKSPACE,objectiveId:ID(1),revision:0},ID(9))
    const before=graph(),now=evidence.checkedAt;let next=20
    const operations=researchPlanOperations(before,result,ID(6),now,()=>ID(next++))
    const applied=await applyParticleBatch(before,{id:ID(8),workspaceId:WORKSPACE,baseRevision:0,requireExactRevision:true,operations},now)
    if(!applied.ok)throw Error(applied.error)
    const pending=particleGraphSchema.parse(JSON.parse(JSON.stringify(applied.value.graph)))
    const objective=pending.particles.find(item=>item.id===ID(1))!
    if(objective.type!=="objective")throw Error("Objective missing")
    const proposal=objective.data.planning!.proposals[0]
    expect(proposal.sources).toEqual(sources)
    const accepted=particlePlanSchema.parse(planFromProposal(proposal))
    expect(accepted.sources).toEqual(sources)
    const reviewed={...objective,data:{...objective.data,planning:{plans:[accepted],proposals:[{...proposal,status:"accepted" as const,reviewedBy:ID(6),reviewedAt:now}]}}}
    const saved=await applyParticleBatch(pending,{id:ID(10),workspaceId:WORKSPACE,baseRevision:pending.revision,requireExactRevision:true,operations:[{kind:"put_particle",particle:reviewed,expectedRevision:objective.revision}]},now)
    if(!saved.ok)throw Error(saved.error)
    const reloaded=particleGraphSchema.parse(JSON.parse(JSON.stringify(saved.value.graph)))
    const savedObjective=reloaded.particles.find(item=>item.id===ID(1))!
    if(savedObjective.type!=="objective")throw Error("Objective missing")
    expect(savedObjective.data.planning!.plans[0].sources).toEqual(sources)
    expect(savedObjective.data.planning!.proposals[0].sources).toEqual(sources)
    expect(sources[0].evidence).toMatchObject({coverage:"excerpt",scope:"document_body",characters:6000})
    expect(sources[1].evidence).toMatchObject({coverage:"excerpt",contactFields:["email","notes"],characters:3000})
    expect(savedObjective.data.planning!.plans[0].sources![2]).not.toHaveProperty("evidence")
  })
  it.each(["source extra","evidence extra","invalid coverage","invalid contact field","duplicate contact field","oversized count"])("rejects %s metadata in both research and canonical plan sources",kind=>{
    const evidence=knowledgeDisclosure(record,"read",6000).evidence
    const source={id:record.id,title:record.title,href:record.href,revision:record.revision,checkedAt:evidence.checkedAt,kind:"workspace",evidence}
    const corruptions:Record<string,Record<string,unknown>>={
      "evidence extra":{storage_path:"private"},"invalid coverage":{coverage:"verified"},"invalid contact field":{contactFields:["credentials"]},
      "duplicate contact field":{contactFields:["email","email"]},"oversized count":{characters:20001},
    }
    const invalid=kind==="source extra"?{...source,storage_path:"private"}:{...source,evidence:{...evidence,...corruptions[kind]}}
    expect(researchSourceSchema.safeParse(invalid).success).toBe(false)
    const plan={id:ID(4),revision:0,title:"Plan",particleIds:[],sources:[invalid]}
    expect(particlePlanSchema.safeParse(plan).success).toBe(false)
    const {revision:_revision,...contents}=plan
    expect(particlePlanProposalSchema.safeParse({...contents,planId:ID(5),baseRevision:null,authorId:ID(6),createdAt:evidence.checkedAt,status:"pending"}).success).toBe(false)
  })
})
