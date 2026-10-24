import { generatedResearchSchema, researchResultSchema, type KnowledgeRecord, type ResearchResult, type ResearchSource, type ResearchTarget } from "../research-types"

export function searchKnowledge(records: KnowledgeRecord[], query: string, limit = 8) {
  const terms = [...new Set(query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))].slice(0, 12)
  return records.map(record => {
    const title = record.title.toLocaleLowerCase(), text = record.content.toLocaleLowerCase()
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (text.includes(term) ? 1 : 0), 0)
    const offset = Math.max(0, Math.min(...terms.map(term => text.indexOf(term)).filter(index => index >= 0)) - 80)
    return { ...record, content: record.content.slice(Number.isFinite(offset) ? offset : 0, (Number.isFinite(offset) ? offset : 0) + 480), score }
  }).filter(record => record.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
}
export function bindResearch(text: string, sources: ResearchSource[], target: ResearchTarget, runId: string): ResearchResult {
  const result = generatedResearchSchema.parse(JSON.parse(text))
  const keys = new Set(result.items.map(item => item.key)), evidence = new Set(sources.map(source => source.id))
  if (keys.size !== result.items.length) throw new Error("Research contains duplicate items.")
  const references=result.items.flatMap(item=>item.referenceId?[item.referenceId]:[])
  if(new Set(references).size!==references.length)throw new Error("Research repeats a workspace reference.")
  for (const item of result.items) {
    if (item.evidenceIds.some(id => !evidence.has(id))) throw new Error("Research cites an unavailable source.")
    if (item.kind === "reference" && (!item.referenceId || !sources.some(source => source.kind === "workspace" && source.id === item.referenceId))) throw new Error("Research references an unavailable workspace record.")
    if (item.kind !== "reference" && item.referenceId !== null) throw new Error("Unexpected reference.")
    if (item.dependsOn.some(id => id === item.key || !keys.has(id)) || new Set(item.dependsOn).size !== item.dependsOn.length) throw new Error("Invalid research relationships.")
  }
  const decisionKeys = new Set(result.decisions.map(decision => decision.itemKey))
  if (decisionKeys.size !== result.decisions.length) throw new Error("Research repeats a decision.")
  if (result.items.some(item => (item.kind === "decision") !== decisionKeys.has(item.key))) throw new Error("Each decision requires declared outcomes.")
  const branches: {source:string;target:string}[] = []
  for (const decision of result.decisions) {
    if (!keys.has(decision.itemKey)) throw new Error("Decision references an unavailable item.")
    if (new Set(decision.outcomes.map(outcome => outcome.key)).size !== decision.outcomes.length || new Set(decision.outcomes.map(outcome => outcome.label.toLocaleLowerCase())).size !== decision.outcomes.length) throw new Error("Decision outcomes must be distinct.")
    for (const outcome of decision.outcomes) {
      if (new Set(outcome.next).size !== outcome.next.length || outcome.next.some(key => !keys.has(key) || key === decision.itemKey)) throw new Error("Invalid decision branch.")
      for (const target of outcome.next) {
        if (result.items.find(item => item.key === target)!.dependsOn.includes(decision.itemKey)) throw new Error("A branch cannot also be an unconditional dependency.")
        branches.push({source:decision.itemKey,target})
      }
    }
  }
  if (branches.length + result.items.reduce((count,item)=>count+item.dependsOn.length,0) > 60) throw new Error("Research has too many relationships.")
  const visiting = new Set<string>(), visited = new Set<string>()
  const visit = (key: string) => {
    if (visiting.has(key)) throw new Error("Research dependencies contain a cycle.")
    if (visited.has(key)) return
    visiting.add(key)
    result.items.find(item => item.key === key)!.dependsOn.forEach(visit)
    branches.filter(branch=>branch.target===key).forEach(branch=>visit(branch.source))
    visiting.delete(key); visited.add(key)
  }
  result.items.forEach(item => visit(item.key))
  const used = new Set(result.items.flatMap(item => [...item.evidenceIds, ...(item.referenceId ? [item.referenceId] : [])]))
  return researchResultSchema.parse({ ...result, target, runId, sources: sources.filter(source => used.has(source.id)) })
}
