import "server-only"
import { NATIVE_DOCUMENT_READER_CHARACTERS } from "@/lib/workspace/research-source-schema"
import type { KnowledgeRecord } from "../research-types"

type Range = { start: number; end: number }
/** Preserve the existing normalized text and offsets; keep block boundaries as
 * server-only derived metadata, never as a second document representation. */
export function nativeDocumentText(html: string) {
  const paragraphs: Range[] = []
  let content = ""
  for (const part of html.replace(/<\/?(?:p|div|h[1-6]|li|tr|blockquote|br)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ").split(/\r?\n/)) {
    const text = part.replace(/\s+/g, " ").trim()
    if (!text) continue
    const start = content.length + (content ? 1 : 0)
    content += (content ? " " : "") + text
    paragraphs.push({ start, end: content.length })
  }
  return { content, nativeParagraphs: paragraphs }
}

/** Split current canonical text locally. No text beyond the reader limit is
 * eligible, and no candidate is sent to a provider just because it was scanned. */
function passageRanges(record: KnowledgeRecord, cap: number): Range[] {
  const result: Range[] = []
  const paragraphs = record.nativeParagraphs ?? [...record.content.matchAll(/[^\r\n]+/g)]
    .map(match => ({ start: match.index, end: match.index + match[0].length }))
  for (const paragraph of paragraphs) {
    if (paragraph.start >= cap) break
    let start = paragraph.start
    while (start < Math.min(paragraph.end, cap)) {
      let end = Math.min(start + 480, paragraph.end, cap)
      if (end < Math.min(paragraph.end, cap)) {
        const candidate = record.content.slice(start, end)
        const sentence = [...candidate.matchAll(/[.!?]\s/g)].at(-1)
        const boundary = sentence ? sentence.index + 1 : candidate.lastIndexOf(" ")
        if (boundary >= 240) end = start + boundary
      }
      if (/[\uD800-\uDBFF]/.test(record.content[end - 1])) end--
      if (end <= start) break
      if (record.content.slice(start,end).trim()) result.push({ start, end })
      start = end
    }
  }
  if (result.length <= 96) return result
  // Very many short blocks must not shorten the existing search window. Pack
  // adjacent ranges only in that case, retaining the same normalized text.
  const packed: Range[] = []
  let smallRun = false
  for (const range of result) {
    const small = cap <= 9600 || range.end - range.start < 100
    const last = packed.at(-1)
    if (small && smallRun && last && range.end - last.start <= 480) last.end = range.end
    else packed.push({ ...range })
    smallRun = small
  }
  return packed
}

/** Query-selected windows extend late-section discovery without increasing the
 * 9,600-character / 96-passage per-source indexing and embedding allocation.
 * This lexical candidate selection is not exhaustive semantic document review.
 * Omitted/empty queries retain the established leading-window behavior. */
export function documentPassages(record: KnowledgeRecord, query = "") {
  const cap = Math.min(record.content.length, query ? NATIVE_DOCUMENT_READER_CHARACTERS : 9600)
  const terms = [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(term => !["or", "and", "not"].includes(term)))].slice(0,80)
  const occurrences = new Map<string,number>()
  const candidates = passageRanges(record,cap).map(range => {
    const text = record.content.slice(range.start,range.end)
    const occurrence = occurrences.get(text) ?? 0
    occurrences.set(text,occurrence + 1)
    const lower = text.toLowerCase()
    return { ...range, occurrence, score: terms.reduce((sum,term) => sum + Number(lower.includes(term)),0) }
  })
  // Preserve original paragraph splits/keys for small sources. For larger ones,
  // prefer matched passages, with stable source-order ties and bounded fallback.
  if (cap > 9600) candidates.sort((a,b) => b.score - a.score || a.start - b.start)
  const selected: (Range & { occurrence: number })[] = []
  let remaining = 9600
  for (const { start,end,occurrence } of candidates) {
    if (selected.length === 96) break
    if (end - start > remaining) continue
    selected.push({ start,end,occurrence }); remaining -= end - start
  }
  return selected.sort((a,b) => a.start - b.start)
}
