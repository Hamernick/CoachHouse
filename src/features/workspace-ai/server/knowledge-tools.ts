import "server-only"
import { readKnowledgeTableAnalysis } from "./knowledge-table-analysis"
import { validateKnowledgeToolResult } from "../lib/knowledge-tool-contract"
import { projectKnowledgePerson } from "./knowledge-person"
import { knowledgeReadFailure } from "./knowledge-failure"
import { knowledgeSearchSchema, knowledgeReadSchema, type KnowledgeRecord, type ResearchSource, type KnowledgeEvidence } from "../research-types"
import { searchKnowledge } from "../lib/research-contract"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeLoader, particleKnowledgeRecord, readKnowledgeRecord } from "./knowledge-records"
import { knowledgeDisclosure, retainKnowledgeEvidence } from "./knowledge-evidence"
import { createKnowledgeFreshness } from "./knowledge-freshness"
import { searchDocumentKnowledge, searchPdfWindowKnowledge } from "./knowledge-document-search"
import { createUploadedDiscovery } from "./knowledge-uploaded-discovery"
import type { DocumentRetrieval } from "./document-retrieval"
import type { ResearchContext } from "./research-context"

export function createKnowledgeTools(context: ResearchContext, signal?: AbortSignal, documentRetrieval?: DocumentRetrieval) {
  const discovered = new Map<string,KnowledgeRecord>(), sources = new Map<string,ResearchSource>()
  const freshness = createKnowledgeFreshness(context, signal)
  const discoverUploads = createUploadedDiscovery(freshness, signal)
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
    attachDocumentRetrieval(retrieval: DocumentRetrieval) {
      if (documentRetrieval || retrieval.scope.actorId !== context.user.id
        || retrieval.scope.organizationId !== context.target.organizationId || retrieval.scope.canvasId !== context.canvasId)
        throw new Error("Document retrieval scope changed.")
      documentRetrieval = retrieval
    },
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
    async execute(name: string, args: unknown, characterBudget = 6000) {
      const envelope = { version: 1, scope: { organizationId: context.target.organizationId, canvasId: context.canvasId ?? null }, effect: "internal_read",
        disclosure: { destination: "configured_workspace_model", sensitivity: "organization_private", publicDisclosure: false } }
      let result: unknown
      if(name === "search_workspace") {
        const input = knowledgeSearchSchema.parse(args)
        if (input.uploadCursor && !input.kinds.includes("document")) throw new Error("Search continuation requires document scope.")
        if (input.pdfWindow && (input.kinds.length !== 1 || input.kinds[0] !== "document" || input.uploadCursor || input.documentMode === "hybrid"))
          throw new Error("PDF window search requires only document keyword scope without a cursor.")
        const current = await freshness.context(), load = knowledgeLoader(current)
        const kinds=[...new Set(input.kinds)]
        if (documentRetrieval && (documentRetrieval.scope.actorId !== current.user.id || documentRetrieval.scope.organizationId !== current.target.organizationId || documentRetrieval.scope.canvasId !== current.canvasId))
          throw new Error("Document retrieval scope changed.")
        const documentRecords = new Map<string,KnowledgeRecord>()
        let pdfWindow: Awaited<ReturnType<typeof searchPdfWindowKnowledge>>["coverage"] | undefined
        let uploads: Awaited<ReturnType<typeof discoverUploads>>["coverage"] | undefined
        const loaded=await Promise.allSettled(kinds.map(async kind => {
          if (input.uploadCursor && kind !== "document") return []
          if (kind !== "document") return load(kind,input.query)
          if (input.pdfWindow) {
            const selected = await searchPdfWindowKnowledge(current,input.pdfWindow,input.query,freshness,signal)
            pdfWindow = selected.coverage
            return selected.hits.map(hit => { documentRecords.set(hit.record.id,hit.record); return hit.excerpt })
          }
          const discovery = await discoverUploads(current,input.query,JSON.stringify({query:input.query,kinds:[...kinds].sort(),mode:input.documentMode ?? "hybrid"}),input.uploadCursor)
          const matched = input.uploadCursor ? [] : await load(kind,input.query)
          const native = documentRetrieval && !input.uploadCursor ? await searchDocumentKnowledge(current,input.query,documentRetrieval,freshness,signal,input.documentMode ?? "hybrid") : []
          const hits = [...native,...discovery.hits]
          const hitIds = new Set(hits.map(hit => hit.record.id))
          uploads = discovery.coverage
          return [...hits.map(hit => { documentRecords.set(hit.record.id,hit.record); return hit.excerpt }),
            ...[...discovery.metadata,...matched.filter(record => !record.id.startsWith("file:") && !documentRetrieval)]
              .filter(record => !hitIds.has(record.id))]
        }))
        const records=loaded.flatMap(value=>value.status === "fulfilled"?value.value:[])
        const unavailableKinds=kinds.filter((_,index)=>loaded[index].status === "rejected")
        const documentHits = records.filter(record => record.excerptLocation)
        const ranked = [...documentHits, ...searchKnowledge(records.filter(record => !record.excerptLocation),input.query)].slice(0,8)
        const results = ranked.map(item => {
          const full = item.excerptLocation ? item : records.find(record => record.id === item.id)!
          const disclosed = knowledgeDisclosure(item, "search", 480)
          // Document search already observed the full canonical record/detail;
          // never replace its dependency fingerprint with an excerpt fingerprint.
          if (!full.excerptLocation) freshness.observe(full)
          remember(documentRecords.get(full.id) ?? full, disclosed.evidence)
          return disclosed
        })
        result = { ...envelope, results, unavailableKinds, limit:8, ...(uploads ? {uploads} : {}), ...(pdfWindow ? {pdfWindow} : {}), note: input.pdfWindow
          ? "Selected PDF window only. Matching excerpts are not full review; other text, outside pages and no-text pages remain unread. No match does not establish absence. Read matching local offsets with the same pdfStartPage."
          : kinds.includes("document")
          ? `${documentRetrieval && !input.uploadCursor ? `${input.documentMode ?? "hybrid"} document search: up to 5 qualified native sources. ` : ""}Uploads: extracted-source page counts, not full-text review. Unread includes failures; unreadPriorPages includes skips. Cursors are single-use/run. Traversal is not a snapshot; missing hits never prove absence.`
          : "Bounded keyword search. Refine query if needed. A filename match is not evidence of its contents." }
      } else if(name === "read_workspace") {
        const input = knowledgeReadSchema.parse(args)
        const current = await freshness.context(), load = knowledgeLoader(current)
        const ids = [...new Set(input.ids)]
        const ranges = input.documentRanges ?? []
        if (input.tableAnalysis && (ids.length !== 1 || ids[0] !== input.tableAnalysis.id || ranges.length || input.personFields))
          throw new Error("Table analysis requires exactly its declared source reference.")
        if (new Set(ranges.map(range => range.id)).size !== ranges.length || ranges.some(range => !ids.includes(range.id)))
          throw new Error("Choose one document range per requested ID; use another read for additional sections.")
        result = { ...envelope, results: await Promise.all(ids.map(async id => {
          try {
            signal?.throwIfAborted()
            const previous = discovered.get(id)
            const record = previous ? await freshness.read(load, previous) : await readKnowledgeRecord(load, id)
            signal?.throwIfAborted()
            if (!record) throw new Error("Unavailable record")
            if (input.tableAnalysis) {
              const analysis = await readKnowledgeTableAnalysis(current,input.tableAnalysis,signal)
              if (analysis.content.length > Math.max(0,Math.min(6000,characterBudget))) throw new Error("Analysis exceeds the remaining read budget")
              const disclosed = knowledgeDisclosure({...record,content:analysis.content,contentAvailable:true,contentTruncated:false},"read",6000)
              disclosed.evidence = {...disclosed.evidence,tableAnalysis:analysis.evidence}
              freshness.observe(record)
              freshness.observeTableAnalysis(input.tableAnalysis,analysis.fingerprint)
              remember(record,disclosed.evidence)
              return disclosed
            }
            const detail=record.kind === "person" ? projectKnowledgePerson(record,input.personFields) : await readKnowledgeFile(current,record,freshness.fileCache,signal,ranges.find(range => range.id === id)?.pdfStartPage ?? undefined)
            if (ranges.some(range => range.id === id) && !id.startsWith("document:") && !detail.fileText && detail.contentAvailable)
              throw new Error("Ranges require supported TXT, Markdown, DOCX or PDF text.")
            signal?.throwIfAborted()
            if (detail.contactFields) freshness.observeContact(record,detail.contactFields)
            else freshness.observe(record,detail)
            const disclosed = knowledgeDisclosure(detail, "read", Math.floor(Math.max(0, Math.min(6000, characterBudget)) / ids.length), ranges.find(range => range.id === id))
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
