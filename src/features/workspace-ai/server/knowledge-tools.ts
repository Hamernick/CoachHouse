import "server-only"
import { knowledgeSearchSchema, knowledgeReadSchema, type KnowledgeRecord, type ResearchSource } from "../research-types"
import { searchKnowledge } from "../lib/research-contract"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeLoader, particleKnowledgeRecord } from "./knowledge-records"
import type { ResearchContext } from "./research-context"

export function createKnowledgeTools(context: ResearchContext) {
  const load = knowledgeLoader(context), discovered = new Map<string,KnowledgeRecord>(), sources = new Map<string,ResearchSource>()
  const cache = new Map<string, unknown>()
  const remember = (item: KnowledgeRecord) => { discovered.set(item.id,item); sources.set(item.id,{ id:item.id,title:item.title,href:item.href,revision:item.revision,checkedAt:new Date().toISOString(),kind:"workspace",...(item.file?{file:item.file}:{}) }) }
  const selected = context.target.plan ? context.objective.data.planning?.plans.find(plan => plan.id === context.target.plan!.id) : undefined
  const members = new Set(selected?.particleIds ?? [])
  for (const particle of context.graph.particles) if (members.has(particle.id)) {
    const item = particleKnowledgeRecord(particle)
    discovered.set(item.id, item)
  }
  return {
    sources,
    evidence(ids: readonly string[]) {
      // Baseline metadata was supplied in full; only used members enter the evidence budget.
      for (const id of ids) { const item = discovered.get(id); if (item) remember(item) }
      return [...sources.values()]
    },
    async execute(name: string, args: unknown) {
      const key = JSON.stringify([name,args])
      if(cache.has(key)) return cache.get(key)
      let result: unknown
      if(name === "search_workspace") {
        const input = knowledgeSearchSchema.parse(args)
        const kinds=[...new Set(input.kinds)]
        const loaded=await Promise.allSettled(kinds.map(kind=>load(kind,input.query)))
        const records=loaded.flatMap(value=>value.status === "fulfilled"?value.value:[])
        const unavailableKinds=kinds.filter((_,index)=>loaded[index].status === "rejected")
        const ranked = searchKnowledge(records,input.query)
        for(const item of ranked) { const full = records.find(record => record.id === item.id)!; remember(full) }
        result = { results: ranked.map(({score: _score,...item})=>item), unavailableKinds, limit:8, note:"Bounded keyword search. Refine query if needed. A filename match is not evidence of its contents." }
      } else if(name === "read_workspace") {
        const input = knowledgeReadSchema.parse(args)
        result = { results: await Promise.all(input.ids.map(async id => {
          const record = discovered.get(id)
          if(!record) return {id,error:"Search for this record first."}
          try {
            const detail=await readKnowledgeFile(context,record)
            return {...detail,content:detail.content.slice(0,Math.floor(6000/input.ids.length)),truncated:Boolean(detail.contentTruncated)||detail.content.length>Math.floor(6000/input.ids.length)}
          }catch{return {id,error:"Contents are unavailable or changed. Search again before using this source."}}
        })) }
      } else throw new Error("Tool is not available.")
      cache.set(key,result)
      return result
    },
  }
}
