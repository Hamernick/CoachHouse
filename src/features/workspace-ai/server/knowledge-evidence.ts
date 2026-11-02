import "server-only"
import { knowledgeDisclosedRecordSchema } from "../lib/knowledge-tool-contract"
import { knowledgeEvidenceSchema, type KnowledgeRecord, type KnowledgeEvidence } from "../research-types"

/** Project only approved fields. Internal reader fields never cross the model boundary. */
export function knowledgeDisclosure(record: KnowledgeRecord, mode: "search" | "read", limit: number) {
  const content = record.content.slice(0, limit)
  const checkedAt = new Date().toISOString()
  const truncated = Boolean(record.contentTruncated) || record.content.length > limit
  const evidence = knowledgeEvidenceSchema.parse({
    version: 1,
    coverage: !record.contentAvailable ? (mode === "search" ? "metadata_only" : "unavailable")
      : mode === "search" || truncated ? "excerpt" : "complete",
    scope: record.contentScope ?? "record",
    checkedAt, readAt: mode === "read" ? checkedAt : null,
    characters: record.contentAvailable ? content.length : 0,
  })
  const status = mode === "search" ? record.contentAvailable ? "truncated" : "metadata_only"
    : record.contentAvailable ? truncated ? "truncated" : "available" : record.availability ?? "unavailable"
  const recovery = status === "available" ? "none" : status === "metadata_only" ? "read_detail" : status === "truncated" || status === "exhausted_budget" ? "narrow_source"
    : status === "unsupported_format" || status === "empty" ? "choose_source" : "retry_read"
  return knowledgeDisclosedRecordSchema.parse({
    status, recovery,
    id: record.id, kind: record.kind, title: record.title, href: record.href,
    revision: record.revision, content, contentAvailable: record.contentAvailable,
    truncated: truncated || mode === "search", evidence,
    ...(record.contentScope ? { contentScope: record.contentScope } : {}),
    ...(record.file ? { file: record.file } : {}),
  })
}

/** Keep the strongest actual disclosure; citation binding is not another read. */
export function retainKnowledgeEvidence(previous: KnowledgeEvidence | undefined, next: KnowledgeEvidence) {
  if (!previous) return next
  if (next.coverage === "unavailable" || (previous.coverage === "unavailable" && next.readAt === null)) return next.readAt ? next : previous
  const rank = { unavailable: 0, metadata_only: 1, excerpt: 2, complete: 3 }
  if (rank[previous.coverage] > rank[next.coverage]) return previous
  if (rank[previous.coverage] === rank[next.coverage] && previous.characters > next.characters) return previous
  return next
}
