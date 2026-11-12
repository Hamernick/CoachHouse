import "server-only"
import { assertTableAnalysesCurrent } from "./knowledge-table-analysis"
import type { TableAnalysisRequest } from "@/lib/workspace/table-analysis-schema"
import { researchDataViewFingerprint, assertResearchDataViewSources } from "./research-data-view-sources"
import { knowledgePersonFieldFingerprint } from "./knowledge-person"
import type { KnowledgePersonField } from "../lib/knowledge-person-fields"
import { KnowledgeChangedError } from "./knowledge-failure"
import { researchDependenciesSchema, type KnowledgeRecord } from "../research-types"
import { loadResearchContext, type ResearchContext } from "./research-context"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeLoader, particleKnowledgeRecord } from "./knowledge-records"
import { initialResearchParticleIds } from "./knowledge-particle-files"
import { inaccessibleNativeFiles, nativeFilesForRecords, particleNativeFileDependencies } from "@/lib/organization/particle-file-dependencies"

import { knowledgeFingerprint, researchContextFingerprint } from "./research-dependencies"

const unavailable = () => new Error("Research context changed or is unavailable. Reopen research before continuing.")
const sameRecord = (left: KnowledgeRecord, right: KnowledgeRecord) => knowledgeFingerprint(left) === knowledgeFingerprint(right)

/** Per-run observations are evidence snapshots, never cached permission grants. */
export function createKnowledgeFreshness(initial: ResearchContext, signal?: AbortSignal) {
  const contextFingerprint = researchContextFingerprint(initial)
  const observed = new Map<string, { record: KnowledgeRecord; detail?: KnowledgeRecord; contactFields?: Map<KnowledgePersonField,string> }>()
  const fileCache = new Map<string, KnowledgeRecord>()
  const tableAnalyses = new Map<string, {request:TableAnalysisRequest;fingerprint:string}>()
  const particleFiles = particleNativeFileDependencies(initial.graph, initial.retainedParticleFiles)
  const contextParticleIds = initialResearchParticleIds(initial)
  const nativeFileIds = new Set(nativeFilesForRecords(particleFiles, contextParticleIds))
  const retainFiles = (record: KnowledgeRecord) => {
    // Tool reads can observe newer particles outside the selected objective.
    // Preserve both prior lineage and the freshly authorized reader's lineage.
    const next = new Set([...nativeFileIds, ...(record.nativeFileIds ?? []), ...nativeFilesForRecords(particleFiles, [record.id])])
    if (record.id.startsWith("file:")) next.add(record.id.slice(5))
    if (next.size > 256) throw unavailable()
    for (const id of next) nativeFileIds.add(id)
  }
  const selected = initial.objective?.data.planning?.plans.find(plan => plan.id === initial.target.plan?.id)
  for (const id of selected?.particleIds ?? []) {
    const particle = initial.graph.particles.find(item => item.id === id)
    if (particle) {
      const record = particleKnowledgeRecord(particle)
      retainFiles(record)
      observed.set(`particle:${id}`, { record })
    }
  }
  const context = async () => {
    signal?.throwIfAborted()
    const current = await loadResearchContext(initial.target)
    signal?.throwIfAborted()
    if (current.user.id !== initial.user.id || current.target.organizationId !== initial.target.organizationId || current.canvasId !== initial.canvasId || researchContextFingerprint(current, initial.target) !== contextFingerprint) throw unavailable()
    return current
  }
  const read = async (load: ReturnType<typeof knowledgeLoader>, record: KnowledgeRecord) => {
    signal?.throwIfAborted()
    const current = (await load(record.kind, "", record.id)).find(item => item.id === record.id)
    signal?.throwIfAborted()
    if (!current || current.kind !== record.kind) throw unavailable()
    if (!sameRecord(current, record)) throw new KnowledgeChangedError()
    return current
  }
  return {
    context,
    observeTableAnalysis(request: TableAnalysisRequest, fingerprint: string) {
      signal?.throwIfAborted()
      const key = JSON.stringify(request), previous = tableAnalyses.get(key)
      if (previous && previous.fingerprint !== fingerprint) throw new KnowledgeChangedError()
      // One retained citation cannot silently replace a different row declaration.
      if (!previous && [...tableAnalyses.values()].some(value => value.request.id === request.id)) throw unavailable()
      if (!previous && tableAnalyses.size >= 8) throw unavailable()
      tableAnalyses.set(key,{request,fingerprint})
    },
    dependencies() {
      return researchDependenciesSchema.parse({ version: 1, contextFingerprint, contextParticleIds,
        ...(tableAnalyses.size ? {tableAnalyses:[...tableAnalyses.values()]} : {}),
        ...(nativeFileIds.size ? { nativeFileIds: [...nativeFileIds].sort() } : {}),
        ...(initial.dataViewSources?.length ? {dataViews:initial.dataViewSources.map(value=>({viewId:value.viewId,fingerprint:researchDataViewFingerprint(value)}))}:{}),
        records: [...observed.values()].map(({ record, detail, contactFields }) => ({
          id: record.id, kind: record.kind, fingerprint: knowledgeFingerprint(record),
          ...(detail ? { detailFingerprint: knowledgeFingerprint(detail), ...(detail.pdfText ? {pdfStartPage:detail.pdfText.startPage ?? 1}: {}) } : {}),
          ...(contactFields ? { contactFields: [...contactFields].sort(([a],[b]) => a.localeCompare(b)).map(([field,fingerprint]) => ({ field,fingerprint })) } : {}),
        })),
      })
    },
    fileCache,
    read,
    observe(record: KnowledgeRecord, detail?: KnowledgeRecord) {
      signal?.throwIfAborted()
      retainFiles(record)
      const previous = observed.get(record.id)
      if (previous && !sameRecord(previous.record, record)) throw new KnowledgeChangedError()
      // Window text differs legitimately; original bytes and canonical metadata must not.
      const samePdf = previous?.detail?.pdfText && detail?.pdfText && previous.detail.fileText && detail.fileText && previous.detail.fileText.byteHash === detail.fileText.byteHash && previous.detail.fileText.byteLength === detail.fileText.byteLength && previous.detail.pdfText.totalPages === detail.pdfText.totalPages
      if (previous?.detail && detail && !samePdf && !sameRecord(previous.detail,detail)) throw new KnowledgeChangedError()
      observed.set(record.id, { record, detail: samePdf ? previous?.detail : detail ?? previous?.detail, ...(previous?.contactFields ? { contactFields: previous.contactFields } : {}) })
    },
    observeContact(record: KnowledgeRecord, fields: KnowledgePersonField[]) {
      signal?.throwIfAborted()
      const previous = observed.get(record.id)
      if (previous && !sameRecord(previous.record,record)) throw new KnowledgeChangedError()
      const contactFields = new Map(previous?.contactFields)
      for (const [field,fingerprint] of contactFields) if (knowledgePersonFieldFingerprint(record,field) !== fingerprint) throw new KnowledgeChangedError()
      for (const field of fields) contactFields.set(field,knowledgePersonFieldFingerprint(record,field))
      observed.set(record.id,{ record, contactFields })
    },
    async revalidate() {
      try {
        const current = await context(), load = knowledgeLoader(current)
        if ((await inaccessibleNativeFiles(nativeFileIds, current.user.id, { organizationId: current.target.organizationId, canvasId: current.canvasId })).size) return false
        await assertResearchDataViewSources(current,(initial.dataViewSources??[]).map(value=>({viewId:value.viewId,fingerprint:researchDataViewFingerprint(value)})))
        await assertTableAnalysesCurrent(current,[...tableAnalyses.values()],signal)
        const entries = [...observed.values()]
        // Profile reads coalesce inside this fresh loader; source reads are bounded.
        for (let index = 0; index < entries.length; index += 4) {
          await Promise.all(entries.slice(index, index + 4).map(async ({ record, detail, contactFields }) => {
            const checkedRecord = await read(load, record)
            for (const [field,fingerprint] of contactFields ?? []) if (knowledgePersonFieldFingerprint(checkedRecord,field) !== fingerprint) throw new KnowledgeChangedError()
            if (detail && (record.id.startsWith("file:") || record.id.startsWith("particle:"))) {
              const checked = await readKnowledgeFile(current, record, detail.fileText ? undefined : fileCache, signal, detail.pdfText?.startPage)
              if (!sameRecord(checked, detail)) throw unavailable()
            }
          }))
        }
        signal?.throwIfAborted()
        return true
      } catch { return false }
    },
  }
}
