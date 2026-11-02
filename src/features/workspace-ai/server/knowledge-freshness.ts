import "server-only"
import { knowledgePersonFieldFingerprint } from "./knowledge-person"
import type { KnowledgePersonField } from "../lib/knowledge-person-fields"
import { KnowledgeChangedError } from "./knowledge-failure"
import { researchDependenciesSchema, type KnowledgeRecord } from "../research-types"
import { loadResearchContext, type ResearchContext } from "./research-context"
import { readKnowledgeFile } from "./knowledge-file"
import { knowledgeLoader, particleKnowledgeRecord } from "./knowledge-records"

import { knowledgeFingerprint, researchContextFingerprint } from "./research-dependencies"

const unavailable = () => new Error("Research context changed or is unavailable. Reopen research before continuing.")
const sameRecord = (left: KnowledgeRecord, right: KnowledgeRecord) => knowledgeFingerprint(left) === knowledgeFingerprint(right)

/** Per-run observations are evidence snapshots, never cached permission grants. */
export function createKnowledgeFreshness(initial: ResearchContext, signal?: AbortSignal) {
  const contextFingerprint = researchContextFingerprint(initial)
  const observed = new Map<string, { record: KnowledgeRecord; detail?: KnowledgeRecord; contactFields?: Map<KnowledgePersonField,string> }>()
  const fileCache = new Map<string, KnowledgeRecord>()
  const selected = initial.objective?.data.planning?.plans.find(plan => plan.id === initial.target.plan?.id)
  for (const id of selected?.particleIds ?? []) {
    const particle = initial.graph.particles.find(item => item.id === id)
    if (particle) observed.set(`particle:${id}`, { record: particleKnowledgeRecord(particle) })
  }
  const context = async () => {
    signal?.throwIfAborted()
    const current = await loadResearchContext(initial.target)
    signal?.throwIfAborted()
    if (current.user.id !== initial.user.id || current.canvasId !== initial.canvasId || researchContextFingerprint(current, initial.target) !== contextFingerprint) throw unavailable()
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
    dependencies() {
      return researchDependenciesSchema.parse({ version: 1, contextFingerprint,
        records: [...observed.values()].map(({ record, detail, contactFields }) => ({
          id: record.id, kind: record.kind, fingerprint: knowledgeFingerprint(record),
          ...(detail ? { detailFingerprint: knowledgeFingerprint(detail) } : {}),
          ...(contactFields ? { contactFields: [...contactFields].sort(([a],[b]) => a.localeCompare(b)).map(([field,fingerprint]) => ({ field,fingerprint })) } : {}),
        })),
      })
    },
    fileCache,
    read,
    observe(record: KnowledgeRecord, detail?: KnowledgeRecord) {
      signal?.throwIfAborted()
      const previous = observed.get(record.id)
      if (previous && !sameRecord(previous.record, record)) throw new KnowledgeChangedError()
      observed.set(record.id, { record, detail: detail ?? previous?.detail, ...(previous?.contactFields ? { contactFields: previous.contactFields } : {}) })
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
        const entries = [...observed.values()]
        // Profile reads coalesce inside this fresh loader; source reads are bounded.
        for (let index = 0; index < entries.length; index += 4) {
          await Promise.all(entries.slice(index, index + 4).map(async ({ record, detail, contactFields }) => {
            const checkedRecord = await read(load, record)
            for (const [field,fingerprint] of contactFields ?? []) if (knowledgePersonFieldFingerprint(checkedRecord,field) !== fingerprint) throw new KnowledgeChangedError()
            if (detail && record.id.startsWith("file:")) {
              const checked = await readKnowledgeFile(current, record, fileCache)
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
