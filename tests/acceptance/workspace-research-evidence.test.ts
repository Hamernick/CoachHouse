import { describe, expect, it } from "vitest"
import { knowledgeDisclosure } from "@/features/workspace-ai/server/knowledge-evidence"
import { researchResultSchema, researchSourceSchema, type KnowledgeRecord } from "@/features/workspace-ai/research-types"
import { bindResearch } from "@/features/workspace-ai/lib/research-contract"
import { particleKnowledgeRecord } from "@/features/workspace-ai/server/knowledge-records"
import { ID, WORKSPACE, particle } from "./fixtures/particle-fixtures"

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
})
