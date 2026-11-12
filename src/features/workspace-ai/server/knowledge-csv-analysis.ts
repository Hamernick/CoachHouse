import "server-only"
import { createHash } from "node:crypto"
import { calculateCsvBudget } from "@/features/workspace-data-views"
import { tableAnalysisEvidenceSchema, type TableAnalysisRequest } from "@/lib/workspace/table-analysis-schema"
import type { ResearchContext } from "./research-context"
import { knowledgeLoader, readKnowledgeRecord } from "./knowledge-records"
import { readKnowledgeCsvFile } from "./knowledge-file"

const fingerprint = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")

/** Reuse canonical actor AND canvas file readers for fresh reads and history.
 * No import command, file mutation, alternate store or extraction cache. */
export async function readKnowledgeCsvAnalysis(context:ResearchContext,request:TableAnalysisRequest,signal?:AbortSignal) {
  signal?.throwIfAborted()
  const record = await readKnowledgeRecord(knowledgeLoader(context),request.id)
  if (!record) throw Error("CSV unavailable")
  const file = await readKnowledgeCsvFile(context,record,signal)
  const calculated = calculateCsvBudget(file.content,request)
  const csv = {fileId:request.id.slice(5),revision:file.revision,byteLength:file.byteLength,contentHash:file.contentHash,
    encoding:"utf-8",delimiter:",",headerRows:1,dataRows:calculated.dataRows,columns:calculated.columns}
  const sourceRevision = fingerprint(csv)
  const evidence = tableAnalysisEvidenceSchema.parse({request,viewId:null,tableId:null,viewRevision:null,sourceRevision,
    filter:null,filterOperator:"case_insensitive_contains",selectedRows:calculated.dataRows,matchedRows:calculated.matchedRows,...(calculated.groups ? {groups:calculated.groups.map(({label,matchedRows}) => ({label,matchedRows}))} : {}),...(calculated.comparison ? {comparisonMatchedRows:calculated.comparison.matchedRows} : {}),
    csv,complete:true,amountUnit:"major",scale:2})
  signal?.throwIfAborted()
  return {evidence,fingerprint:fingerprint({request,sourceRevision}),content:JSON.stringify({budget:calculated.budget,
    actual:calculated.actual,delta:calculated.delta,deltaDefinition:calculated.deltaDefinition,currency:request.currency,
    period:request.period,matchedRows:calculated.matchedRows,...(calculated.groups ? {groups:calculated.groups} : {}),...(calculated.comparison ? {comparison:calculated.comparison} : {}),
    scope:request.compareToPeriod ? "Complete uploaded CSV intersected with the two declared months; no FX, forecasts, percentages, or whole-organization total." : "Complete uploaded CSV intersected with the declared month; no FX, forecasts, or whole-organization total."})}
}
