import "server-only"
import { knowledgeDisclosedRecordSchema } from "../lib/knowledge-tool-contract"
import { knowledgeEvidenceSchema, type KnowledgeRecord, type KnowledgeEvidence } from "../research-types"

/** Project only approved fields. Internal reader fields never cross the model boundary. */
export function knowledgeDisclosure(record: KnowledgeRecord, mode: "search" | "read", limit: number, range?: { start: number; end: number }) {
  limit = Math.max(0, Math.floor(limit))
  const native = mode === "read" && (record.id.startsWith("document:") || Boolean(record.fileText)) && record.contentAvailable
  let start = native ? range?.start ?? 0 : 0
  let end = Math.min(record.content.length, range?.end ?? record.content.length, start + limit)
  // Never disclose half a surrogate pair; coverage records the actual interval.
  if (record.fileText) {
    if (/[\uDC00-\uDFFF]/.test(record.content[start] ?? "")) start++
    if (/[\uD800-\uDBFF]/.test(record.content[end - 1] ?? "")) end--
  }
  const content = record.content.slice(start, Math.max(start, end))
  const pdf = record.pdfText
  const pdfIncomplete = pdf && (pdf.pages.length < pdf.totalPages || pdf.pages.some(page => page.end === page.start))
  const totalCharacters = pdfIncomplete ? null : record.fileText?.totalCharacters ?? record.nativeTextLength ?? (record.contentTruncated ? null : record.content.length)
  const textCoverage = native || (pdf && mode === "read") ? {
    availableCharacters: record.content.length,
    totalCharacters,
    ranges: record.contentAvailable && content.length ? [{ start, end }] : [],
    complete: !pdfIncomplete && !record.contentTruncated && start === 0 && end === record.content.length,
  } : undefined
  if (native && !content.length && record.content.length) return knowledgeDisclosedRecordSchema.parse({
    id: record.id, kind: record.kind, title: record.title, href: record.href, revision: record.revision,
    content: "Requested range exceeds the available reader text or remaining read budget.", contentAvailable: false, truncated: false,
    status: "exhausted_budget", recovery: "narrow_source",
    evidence: { version: 1, coverage: "unavailable", scope: "record", checkedAt: new Date().toISOString(),
      readAt: new Date().toISOString(), characters: 0, textCoverage },
  })
  const searchCoverage = record.excerptLocation && record.excerptSourceLength !== undefined &&
    (pdfIncomplete || record.excerptLocation.start > 0 || record.excerptLocation.end < record.excerptSourceLength || (record.fileText?.totalCharacters ?? record.nativeTextLength ?? 0) > record.excerptSourceLength) ? {
      availableCharacters: record.excerptSourceLength, totalCharacters: pdfIncomplete ? null : record.fileText?.totalCharacters ?? record.nativeTextLength ?? record.excerptSourceLength,
      ranges: [{ start: record.excerptLocation.start, end: record.excerptLocation.start + content.length }], complete: false,
    } : undefined
  const checkedAt = new Date().toISOString()
  const truncated = Boolean(pdfIncomplete || record.contentTruncated) || start > 0 || end < record.content.length
  const disclosedStart = record.excerptLocation?.start ?? start
  const disclosedEnd = disclosedStart + content.length
  const evidence = knowledgeEvidenceSchema.parse({
    version: 1,
    coverage: !record.contentAvailable ? (mode === "search" ? "metadata_only" : "unavailable")
      : mode === "search" || truncated ? "excerpt" : "complete",
    scope: record.contentScope ?? "record",
    checkedAt, readAt: mode === "read" ? checkedAt : null,
    characters: record.contentAvailable ? content.length : 0,
    ...(pdf ? { pdf: { totalPages: pdf.totalPages, startPage: pdf.startPage ?? 1, processedPages: pdf.pages.length,
      pages: pdf.pages.filter(page => page.end > page.start && page.start < disclosedEnd && page.end > disclosedStart).map(page => page.page),
      unreadPages: pdf.pages.filter(page => page.start === page.end).map(page => page.page) } } : {}),
    ...(textCoverage ? { textCoverage, ...(content.length ? { location: { kind: "reader_text", start, end } } : {}) } : {}),
    ...(searchCoverage ? { textCoverage: searchCoverage } : {}),
    ...(record.contactFields ? { contactFields: record.contactFields } : {}),
    ...(record.excerptLocation ? { location: { ...record.excerptLocation, end: record.excerptLocation.start + content.length } } : {}),
  })
  const status = mode === "search" ? record.contentAvailable ? "truncated" : "metadata_only"
    : record.contentAvailable ? truncated ? "truncated" : "available" : record.availability ?? "unavailable"
  const recovery = status === "available" ? "none" : status === "metadata_only" ? "read_detail" : status === "truncated" ? mode === "search" ? "read_detail" : "narrow_source" : status === "exhausted_budget" ? "narrow_source"
    : status === "unsupported_format" || status === "empty" ? "choose_source" : "retry_read"
  return knowledgeDisclosedRecordSchema.parse({
    status, recovery,
    id: record.id, kind: record.kind, title: record.title, href: record.href,
    revision: record.revision, content, contentAvailable: record.contentAvailable,
    truncated: truncated || mode === "search", evidence,
    ...(record.contactFields ? { contactFields: record.contactFields } : {}),
    ...(record.contentScope ? { contentScope: record.contentScope } : {}),
    ...(record.file ? { file: record.file } : {}),
  })
}

/** Keep the strongest actual disclosure; citation binding is not another read. */
export function retainKnowledgeEvidence(previous: KnowledgeEvidence | undefined, next: KnowledgeEvidence): KnowledgeEvidence {
  if (!previous) return next
  if (previous.pdf && next.pdf && previous.textCoverage && next.textCoverage) return retainPdfWindows(previous,next)
  if (next.tableAnalysis) return next
  if (previous.tableAnalysis && next.coverage !== "unavailable") return previous
  if (previous.textCoverage && !next.textCoverage && next.readAt === null) return previous
  if (previous.textCoverage && next.textCoverage && next.coverage !== "unavailable") {
    const ranges: { start: number; end: number }[] = []
    for (const range of [...previous.textCoverage.ranges, ...next.textCoverage.ranges].sort((a,b) => a.start - b.start)) {
      const last = ranges.at(-1)
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
      else ranges.push({ ...range })
    }
    const pdf = next.pdf && previous.pdf ? { ...next.pdf, pages: [...new Set([...previous.pdf.pages,...next.pdf.pages])].sort((a,b) => a-b) } : next.pdf
    const textCoverage = { ...next.textCoverage, ranges, complete: next.textCoverage.totalCharacters !== null &&
      next.textCoverage.totalCharacters === next.textCoverage.availableCharacters &&
      (next.textCoverage.totalCharacters === 0 || (ranges.length === 1 && ranges[0].start === 0 && ranges[0].end === next.textCoverage.totalCharacters)) }
    // Retained evidence describes union coverage, not a fictitious single passage.
    const { location: _location, ...retained } = next
    return knowledgeEvidenceSchema.parse({ ...retained, ...(pdf ? {pdf} : {}), readAt: next.readAt ?? previous.readAt, textCoverage,
      coverage: textCoverage.complete ? "complete" : "excerpt", characters: ranges.reduce((sum,range) => sum + range.end - range.start, 0) })
  }
  if (previous.contactFields && !next.contactFields) return previous
  if (previous.contactFields && next.contactFields) return { ...next,
    contactFields: [...new Set([...previous.contactFields,...next.contactFields])].sort(),
    coverage: previous.coverage === "excerpt" || next.coverage === "excerpt" ? "excerpt" : next.coverage,
    // Strongest individual read length, not an invented cumulative/token count.
    characters: Math.max(previous.characters,next.characters),
  }
  if (next.coverage === "unavailable" || (previous.coverage === "unavailable" && next.readAt === null)) return next.readAt ? next : previous
  const rank = { unavailable: 0, metadata_only: 1, excerpt: 2, complete: 3 }
  if (rank[previous.coverage] > rank[next.coverage]) return previous
  if (rank[previous.coverage] === rank[next.coverage] && previous.characters > next.characters) return previous
  return next
}

/** Each PDF window owns its own text origin. Never union offsets across windows. */
function retainPdfWindows(previous: KnowledgeEvidence, next: KnowledgeEvidence): KnowledgeEvidence {
  const prior = previous.pdf!, current = next.pdf!
  const {priorWindows: _priorWindows,...priorWindow} = prior
  const {priorWindows: _currentWindows,...currentWindow} = current
  const windows = new Map((prior.priorWindows ?? []).map(window => [window.startPage ?? 1,window]))
  windows.set(prior.startPage ?? 1,{...priorWindow,textCoverage:previous.textCoverage!})
  const old = windows.get(current.startPage ?? 1)
  const ranges = [...(old?.textCoverage.ranges ?? []),...next.textCoverage!.ranges].sort((a,b)=>a.start-b.start)
  const merged: {start:number;end:number}[] = []
  for(const range of ranges) {
    const last = merged.at(-1)
    if(last && range.start <= last.end) last.end = Math.max(last.end,range.end)
    else merged.push({...range})
  }
  const coverage = next.textCoverage!
  const textCoverage = {...coverage,ranges:merged,complete:coverage.totalCharacters !== null && coverage.totalCharacters === coverage.availableCharacters &&
    (coverage.totalCharacters === 0 || (merged.length === 1 && merged[0].start === 0 && merged[0].end === coverage.totalCharacters))}
  windows.delete(current.startPage ?? 1)
  const {location: _location,...retained} = next
  return knowledgeEvidenceSchema.parse({...retained,readAt:next.readAt ?? previous.readAt,textCoverage,
    characters:merged.reduce((sum,range)=>sum+range.end-range.start,0),
    coverage:merged.length || [...windows.values()].some(window=>window.textCoverage.ranges.length) ? textCoverage.complete ? "complete" : "excerpt" : next.coverage,
    pdf:{...currentWindow,pages:[...new Set([...(old?.pages ?? []),...current.pages])].sort((a,b)=>a-b),
      ...(windows.size ? {priorWindows:[...windows.values()].sort((a,b)=>(a.startPage ?? 1)-(b.startPage ?? 1))}:{})}})
}
