import "server-only"
import { knowledgeEvidenceSchema, type KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import type { DocumentRetrieval, DocumentRetrievalMode } from "./document-retrieval"
import type { createKnowledgeFreshness } from "./knowledge-freshness"
import { knowledgeLoader, readKnowledgeRecord } from "./knowledge-records"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeFingerprint } from "./research-dependencies"
import { KnowledgeChangedError } from "./knowledge-failure"
import { documentPassages } from "./document-passages"

export const readableUploadedDocument = (record: KnowledgeRecord) => Boolean(record.id.startsWith("file:") && record.revision && record.file &&
  ["txt","md","docx","pdf"].includes(record.file.format) && record.file.size <= (["docx","pdf"].includes(record.file.format) ? 2097152 : 256000))

export function rankUploadedDocumentCandidates(records: KnowledgeRecord[], query: string) {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0,80)
  const score = (record: KnowledgeRecord) => terms.reduce((sum,term) => sum + Number(record.title.toLowerCase().includes(term)),0)
  return records.filter(readableUploadedDocument).sort((a,b) => score(b) - score(a))
}

/** Ephemeral lexical discovery through the canonical reader. No index writes,
 * embeddings or legacy-source qualification follow from reading a passage. */
export async function searchUploadedDocumentKnowledge(context: ResearchContext, records: KnowledgeRecord[], query: string,
  freshness: ReturnType<typeof createKnowledgeFreshness>, signal?: AbortSignal, onRead?: () => void) {
  const selected = rankUploadedDocumentCandidates(records,query).slice(0,5)
  const hits = []
  for (const record of selected) {
    signal?.throwIfAborted()
    const detail = await readKnowledgeFile(context,record,undefined,signal)
    if (!detail.contentAvailable || !detail.fileText) continue
    onRead?.()
    const passages = matchingUploadedPassages(detail,query)
    if (!passages.length) continue
    freshness.observe(record,detail)
    for (const passage of passages) hits.push({ record, score: passage.score, excerpt: { ...detail,
      excerptSourceLength: detail.content.length, content: detail.content.slice(passage.start,passage.end), contentTruncated: true,
      excerptLocation: { kind: "reader_text" as const, start: passage.start, end: passage.end } } })
  }
  // Re-download observed bytes and recheck actor, canvas, revision and audience
  // before disclosing any batch, including a hit read before a later source.
  if (hits.length && !await freshness.revalidate()) throw new KnowledgeChangedError()
  signal?.throwIfAborted()
  return hits.sort((a,b) => b.score - a.score || a.record.id.localeCompare(b.record.id) || a.excerpt.excerptLocation.start - b.excerpt.excerptLocation.start).slice(0,8)
}


function matchingUploadedPassages(detail: KnowledgeRecord, query: string) {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0,80)
  return documentPassages(detail,query).map(range => ({...range,
    score:terms.reduce((sum,term) => sum + Number(detail.content.slice(range.start,range.end).toLowerCase().includes(term)),0)}))
    .filter(range => range.score > 0).sort((a,b) => b.score - a.score || a.start - b.start).slice(0,3)
}

/** Exact file/window selection never scans the library or advances other windows.
 * Even no-match coverage rechecks the observed bytes and current authority. */
export async function searchPdfWindowKnowledge(context: ResearchContext, window: {id:string;startPage:number}, query: string,
  freshness: ReturnType<typeof createKnowledgeFreshness>, signal?: AbortSignal) {
  const record = await readKnowledgeRecord(knowledgeLoader(context),window.id)
  if (!record) throw new Error("PDF window is unavailable.")
  const detail = await readKnowledgeFile(context,record,undefined,signal,window.startPage)
  const pdf = detail.pdfText
  if (!pdf || !detail.fileText) throw new Error("PDF window is unavailable.")
  freshness.observe(record,detail)
  const hits = matchingUploadedPassages(detail,query).map(passage => ({record,excerpt:{...detail,
    excerptSourceLength:detail.content.length,content:detail.content.slice(passage.start,passage.end),contentTruncated:true,
    excerptLocation:{kind:"reader_text" as const,start:passage.start,end:passage.end}}}))
  // No body was disclosed by scanning. Only returned passages count as read.
  const coverage = knowledgeEvidenceSchema.parse({version:1,coverage:"metadata_only",scope:"text",
    checkedAt:new Date().toISOString(),readAt:null,characters:0,
    pdf:{startPage:pdf.startPage ?? 1,totalPages:pdf.totalPages,processedPages:pdf.pages.length,pages:[],
      unreadPages:pdf.pages.filter(page=>page.start===page.end).map(page=>page.page)},
    textCoverage:{availableCharacters:detail.content.length,totalCharacters:null,ranges:[],complete:false}})
  if (!await freshness.revalidate()) throw new KnowledgeChangedError()
  signal?.throwIfAborted()
  return {hits,coverage:{id:record.id,evidence:coverage}}
}

/** No index-supplied text is disclosed. Reuse canonical readers before indexing
 * and again after ranking; this includes revision, actor, closure and audience.
 */
export async function searchDocumentKnowledge(context: ResearchContext, query: string, retrieval: DocumentRetrieval,
  freshness: ReturnType<typeof createKnowledgeFreshness>, signal?: AbortSignal, mode: DocumentRetrievalMode = "hybrid") {
  const records = (await knowledgeLoader(context)("document", "")).filter(record => retrieval.accepts(record))
    .sort((a,b) => a.id.localeCompare(b.id))
  const details: KnowledgeRecord[] = []
  for (let index = 0; index < records.length; index += 4) {
    signal?.throwIfAborted()
    details.push(...await Promise.all(records.slice(index,index+4).map(record => readKnowledgeFile(context,record,freshness.fileCache))))
  }
  const recheckSources = async () => {
    signal?.throwIfAborted()
    const current = await freshness.context(), load = knowledgeLoader(current)
    for (const original of records) {
      const checked = await freshness.read(load,original)
      const detail = await readKnowledgeFile(current,checked,freshness.fileCache)
      if (knowledgeFingerprint(detail) !== knowledgeFingerprint(details.find(value => value.id === original.id)!)) throw new KnowledgeChangedError()
    }
    signal?.throwIfAborted()
  }
  const hits = await retrieval.search(details,query,mode,signal,recheckSources)
  const current = await freshness.context(), load = knowledgeLoader(current)
  const results = []
  const reread = new Map<string,{ record: KnowledgeRecord; detail: KnowledgeRecord }>()
  for (const hit of hits) {
    if (reread.has(hit.record.id)) continue
    const original = records.find(record => record.id === hit.record.id)!
    const checked = await freshness.read(load,original)
    const detail = await readKnowledgeFile(current,checked,freshness.fileCache)
    if (knowledgeFingerprint(detail) !== knowledgeFingerprint(hit.record)) throw new KnowledgeChangedError()
    freshness.observe(checked,detail)
    reread.set(hit.record.id,{ record: checked, detail })
  }
  for (const hit of hits) {
    const { record: checked, detail } = reread.get(hit.record.id)!
    results.push({ record: checked, excerpt: { ...detail, excerptSourceLength: detail.content.length, content: detail.content.slice(hit.start,hit.end), contentTruncated: true,
      excerptLocation: { kind: "reader_text" as const, start: hit.start, end: hit.end } } })
  }
  // Repeat retained-source validation immediately before returning the batch;
  // serial document reads must not retain an earlier revoked hit.
  if (!await freshness.revalidate()) throw new KnowledgeChangedError()
  return results
}
