import { z } from "zod"
import { tableAnalysisEvidenceSchema } from "./table-analysis-schema"

export const NATIVE_DOCUMENT_READER_CHARACTERS = 200000

/** Shared strict evidence contract for AI results and canonical saved plans. */
export const knowledgePersonFieldSchema = z.enum(["title", "email", "phone", "notes", "details.organization", "details.location", "details.website", "details.timezone", "details.relationshipStage", "details.followUpDate"])
export const knowledgePersonFieldsSchema = z.array(knowledgePersonFieldSchema).min(1).max(10).refine(fields => new Set(fields).size === fields.length, "Choose distinct contact fields")

const textRangeSchema = z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive() })
  .refine(value => value.end > value.start && value.end <= NATIVE_DOCUMENT_READER_CHARACTERS)
export const knowledgeTextCoverageSchema = z.strictObject({
  totalCharacters: z.number().int().nonnegative().nullable(), availableCharacters: z.number().int().nonnegative().max(NATIVE_DOCUMENT_READER_CHARACTERS),
  ranges: z.array(textRangeSchema).max(32), complete: z.boolean(),
}).refine(value => {
  if (value.totalCharacters !== null && value.totalCharacters < value.availableCharacters) return false
  if (value.ranges.some((range, index) => range.end > value.availableCharacters || (index > 0 && range.start <= value.ranges[index - 1].end))) return false
  return value.complete === (value.totalCharacters !== null && value.totalCharacters === value.availableCharacters &&
    (value.totalCharacters === 0 || (value.ranges.length === 1 && value.ranges[0].start === 0 && value.ranges[0].end === value.totalCharacters)))
}, "Invalid native text coverage")

const pdfWindowSchema = z.strictObject({ totalPages: z.number().int().positive(), startPage: z.number().int().positive().optional(), processedPages: z.number().int().min(1).max(40),
  pages: z.array(z.number().int().positive()).max(40), unreadPages: z.array(z.number().int().positive()).max(40),
}).refine(value => (value.startPage ?? 1) + value.processedPages - 1 <= value.totalPages && [value.pages,value.unreadPages].every(pages =>
  pages.every((page,index) => page >= (value.startPage ?? 1) && page < (value.startPage ?? 1)+value.processedPages && (!index || page > pages[index-1]))) && !value.pages.some(page => value.unreadPages.includes(page)), "Invalid PDF coverage")
const pdfPriorWindowSchema = pdfWindowSchema.safeExtend({textCoverage:knowledgeTextCoverageSchema})
  .refine(value => !(value.unreadPages.length || value.processedPages < value.totalPages) || (value.textCoverage.totalCharacters === null && !value.textCoverage.complete))
const pdfCoverageSchema = pdfWindowSchema.safeExtend({priorWindows:z.array(pdfPriorWindowSchema).max(32).optional()})
  .refine(value => {
    const starts = [value.startPage ?? 1,...(value.priorWindows ?? []).map(window => window.startPage ?? 1)]
    return new Set(starts).size === starts.length && (value.priorWindows ?? []).every(window => window.totalPages === value.totalPages)
  }, "Invalid retained PDF windows")

export const knowledgeEvidenceSchema = z.strictObject({
  version: z.literal(1),
  coverage: z.enum(["metadata_only", "excerpt", "complete", "unavailable"]),
  scope: z.enum(["record", "text", "document_body", "selected_plan"]),
  checkedAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
  // JavaScript string length: UTF-16 code units, not bytes or tokens.
  characters: z.number().int().nonnegative().max(NATIVE_DOCUMENT_READER_CHARACTERS),
  contactFields: knowledgePersonFieldsSchema.optional(),
  textCoverage: knowledgeTextCoverageSchema.optional(),
  tableAnalysis: tableAnalysisEvidenceSchema.optional(),
  pdf: pdfCoverageSchema.optional(),
  location: z.strictObject({ kind: z.literal("reader_text"), start: z.number().int().nonnegative(), end: z.number().int().positive() })
    .refine(value => value.end > value.start && value.end - value.start <= 6000).optional(),
}).refine(value => !value.pdf || (value.scope === "text" && !value.tableAnalysis &&
  (!(value.pdf.unreadPages.length || value.pdf.processedPages < value.pdf.totalPages) || (value.textCoverage?.totalCharacters === null && !value.textCoverage.complete))), "Inconsistent PDF coverage")
.refine(value => !value.tableAnalysis || (value.coverage === "complete" && value.scope === "record" && value.readAt !== null && value.characters > 0 && !value.textCoverage && !value.location && !value.contactFields), "Invalid table calculation coverage")
.refine(value => !value.textCoverage || (
  (value.coverage === "unavailable" ? value.characters === 0 :
    value.characters === value.textCoverage.ranges.reduce((sum,range) => sum + range.end - range.start, 0) &&
    (value.coverage === "complete") === value.textCoverage.complete)), "Inconsistent native text coverage")
  .refine(value => Boolean(value.textCoverage) || value.characters <= 20000, "Non-native evidence exceeds its existing character limit")
  .refine(value => !value.location || (["excerpt", "complete"].includes(value.coverage) && value.characters === value.location.end - value.location.start), "Invalid excerpt location")
export const researchSourceSchema = z.strictObject({ id: z.string().max(200), title: z.string().max(240), href: z.string().max(2000).refine(value => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value), "Invalid source link"), revision: z.string().nullable(), checkedAt: z.iso.datetime(), kind: z.enum(["workspace", "web"]), evidence: knowledgeEvidenceSchema.optional(), file: z.strictObject({size:z.number().int().positive().max(15728640),format:z.enum(["pdf","md","docx","doc","csv","txt","image"])}).optional() })
