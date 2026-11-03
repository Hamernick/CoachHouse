import "server-only"
import type { ResponseInputItem } from "openai/resources/responses/responses"
import { validateKnowledgeToolResult } from "../lib/knowledge-tool-contract"

export const researchToolReferenceInstruction = "A tool result {id,sameAs:{callId,resultIndex},evidence} repeats the full record at zero-based results[resultIndex] in the earlier function_call_output for callId, replacing only its evidence with the supplied current evidence. It grants no additional access or content."

/** Lossless wire projection only: source outputs/evidence and the input transcript
 * stay intact. References always resolve to earlier full records in this request. */
export function compactResearchToolMessages(messages: ResponseInputItem[]) {
  const calls = new Map<string, { name: string; arguments: string }>()
  const callCounts = new Map<string, number>(), outputCounts = new Map<string, number>()
  for (const item of messages) {
    if (item.type === "function_call") callCounts.set(item.call_id, (callCounts.get(item.call_id) ?? 0) + 1)
    if (item.type === "function_call_output") outputCounts.set(item.call_id, (outputCounts.get(item.call_id) ?? 0) + 1)
  }
  const fullRecords = new Map<string, { callId: string; resultIndex: number }>()
  let compacted = false
  const projected = messages.map(item => {
    if (item.type === "function_call") calls.set(item.call_id, item)
    if (item.type !== "function_call_output" || typeof item.output !== "string"
      || callCounts.get(item.call_id) !== 1 || outputCounts.get(item.call_id) !== 1) return item
    const call = calls.get(item.call_id)
    if (!call || !["search_workspace", "read_workspace"].includes(call.name)) return item
    try {
      const raw = JSON.parse(item.output)
      const output = validateKnowledgeToolResult(call.name, raw, raw.scope, JSON.parse(call.arguments))
      const scope = JSON.stringify({ version: output.version, scope: output.scope, effect: output.effect, disclosure: output.disclosure })
      const remember: Array<[string, { callId: string; resultIndex: number }]> = []
      let changed = false
      const results = output.results.map((record, resultIndex) => {
        if (!("evidence" in record)) return record
        // Only time-of-observation may differ. Coverage, selected contact fields,
        // content, revision, availability and every other field must match.
        const key = JSON.stringify([scope, { ...record, evidence: { ...record.evidence, checkedAt: null, readAt: null } }])
        const earlier = fullRecords.get(key)
        const reference = earlier ? { id: record.id, sameAs: earlier, evidence: record.evidence } : null
        if (reference && Buffer.byteLength(JSON.stringify(reference)) < Buffer.byteLength(JSON.stringify(record))) {
          changed = true
          return reference
        }
        remember.push([key, { callId: item.call_id, resultIndex }])
        return record
      })
      // Do not make references to records in the current output or to references.
      for (const [key, value] of remember) if (!fullRecords.has(key)) fullRecords.set(key, value)
      if (!changed) return item
      compacted = true
      return { ...item, output: JSON.stringify({ ...output, results }) }
    } catch {
      // Invalid, unrelated and fallback outputs remain untouched and cannot seed references.
      return item
    }
  })
  return { messages: compacted ? projected : messages, compacted }
}
