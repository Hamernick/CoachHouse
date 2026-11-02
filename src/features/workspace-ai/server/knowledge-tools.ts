import "server-only"
import { validateKnowledgeToolResult } from "../lib/knowledge-tool-contract"
import { projectKnowledgePerson } from "./knowledge-person"
import { knowledgeReadFailure } from "./knowledge-failure"
import { knowledgeSearchSchema, knowledgeReadSchema, type KnowledgeRecord, type ResearchSource, type KnowledgeEvidence } from "../research-types"
import { searchKnowledge } from "../lib/research-contract"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeLoader, particleKnowledgeRecord, readKnowledgeRecord } from "./knowledge-records"
import { knowledgeDisclosure, retainKnowledgeEvidence } from "./knowledge-evidence"
import { createKnowledgeFreshness } from "./knowledge-freshness"
import type { ResearchContext } from "./research-context"

export function createKnowledgeTools(context: ResearchContext, signal?: AbortSignal) {
  const discovered = new Map<string,KnowledgeRecord>(), sources = new Map<string,ResearchSource>()
  const freshness = createKnowledgeFreshness(context, signal)
  const remember = (item: KnowledgeRecord, evidence: KnowledgeEvidence) => {
    discovered.set(item.id, item)
    const retained = retainKnowledgeEvidence(sources.get(item.id)?.evidence, evidence)
    sources.set(item.id, { id: item.id, title: item.title, href: item.href, revision: item.revision,
      checkedAt: retained.checkedAt, kind: "workspace", evidence: retained, ...(item.file ? { file: item.file } : {}) })
  }
  const baselineAt = new Date().toISOString()
  const selected = context.target.plan ? context.objective?.data.planning?.plans.find(plan => plan.id === context.target.plan!.id) : undefined
  const members = new Set(selected?.particleIds ?? [])
  for (const particle of context.graph.particles) if (members.has(particle.id)) {
    const item = particleKnowledgeRecord(particle)
    discovered.set(item.id, item)
  }
  return {
    sources,
    revalidate: freshness.revalidate,
    dependencies: freshness.dependencies,
    evidence(ids: readonly string[]) {
      // Baseline metadata was supplied in full; only used members enter the evidence budget.
      for (const id of ids) {
        const item = discovered.get(id)
        if (item && !sources.has(id)) remember(item, { version: 1, coverage: "metadata_only", scope: "selected_plan",
          checkedAt: baselineAt, readAt: null, characters: 0 })
      }
      return [...sources.values()]
    },
    async execute(name: string, args: unknown) {
      const envelope = { version: 1, scope: { organizationId: context.target.organizationId, canvasId: context.canvasId ?? null }, effect: "internal_read",
        disclosure: { destination: "configured_workspace_model", sensitivity: "organization_private", publicDisclosure: false } }
      let result: unknown
      if(name === "search_workspace") {
        const input = knowledgeSearchSchema.parse(args)
        const current = await freshness.context(), load = knowledgeLoader(current)
        const kinds=[...new Set(input.kinds)]
        const loaded=await Promise.allSettled(kinds.map(kind=>load(kind,input.query)))
        const records=loaded.flatMap(value=>value.status === "fulfilled"?value.value:[])
        const unavailableKinds=kinds.filter((_,index)=>loaded[index].status === "rejected")
        const ranked = searchKnowledge(records,input.query)
        const results = ranked.map(item => {
          const full = records.find(record => record.id === item.id)!
          const disclosed = knowledgeDisclosure(item, "search", 480)
          freshness.observe(full); remember(full, disclosed.evidence)
          return disclosed
        })
        result = { ...envelope, results, unavailableKinds, limit:8, note:"Bounded keyword search. Refine query if needed. A filename match is not evidence of its contents." }
      } else if(name === "read_workspace") {
        const input = knowledgeReadSchema.parse(args)
        const current = await freshness.context(), load = knowledgeLoader(current)
        const ids = [...new Set(input.ids)]
        result = { ...envelope, results: await Promise.all(ids.map(async id => {
          try {
            signal?.throwIfAborted()
            const previous = discovered.get(id)
            const record = previous ? await freshness.read(load, previous) : await readKnowledgeRecord(load, id)
            signal?.throwIfAborted()
            if (!record) throw new Error("Unavailable record")
            const detail=record.kind === "person" ? projectKnowledgePerson(record,input.personFields) : await readKnowledgeFile(current,record,freshness.fileCache)
            if (detail.contactFields) freshness.observeContact(record,detail.contactFields)
            else freshness.observe(record,detail)
            const disclosed = knowledgeDisclosure(detail, "read", Math.floor(6000 / ids.length))
            remember(record, disclosed.evidence)
            return disclosed
          }catch(error){ signal?.throwIfAborted(); return knowledgeReadFailure(id,error) }
        })) }
      } else throw new Error("Tool is not available.")
      signal?.throwIfAborted()
      return validateKnowledgeToolResult(name,result,envelope.scope,args)
    },
  }
}
