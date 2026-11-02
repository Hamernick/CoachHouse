import "server-only"
import { createHash } from "node:crypto"
import type { KnowledgeRecord, ResearchTarget } from "../research-types"
import type { ResearchContext } from "./research-context"
import { researchContextProjection } from "./research-prompt"

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")

/** Hash explicit fields, not reader implementation details or raw private data. */
export function knowledgeFingerprint(record: KnowledgeRecord) {
  return fingerprint({ id: record.id, kind: record.kind, revision: record.revision,
    title: record.title, content: record.content, href: record.href,
    contentAvailable: record.contentAvailable, contentTruncated: Boolean(record.contentTruncated),
    searchContent: record.searchContent, contentScope: record.contentScope, file: record.file })
}

/** Exactly the organization-owned initial context supplied to the model. */
export function researchContextFingerprint(context: ResearchContext, target: ResearchTarget = context.target) {
  return fingerprint(researchContextProjection(context, target))
}
