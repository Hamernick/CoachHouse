import "server-only"
import { createHash } from "node:crypto"
import { readTableAnalysisSnapshot } from "@/features/workspace-data-views/server"
import { calculateTableBudget } from "@/features/workspace-data-views"
import { tableAnalysisEvidenceSchema, type TableAnalysisRequest } from "@/lib/workspace/table-analysis-schema"
import type { KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import { readKnowledgeCsvAnalysis } from "./knowledge-csv-analysis"
import { ResearchRecoveryError } from "./research-recovery"

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
function viewFor(context: ResearchContext, id: string) {
  const particle = context.graph.particles.find(item => `particle:${item.id}` === id)
  return particle?.type === "activity" && particle.data.widget?.kind === "data_view" ? particle.data.widget.viewId : null
}
/** Normal read exposes column declarations, never a row sample for arithmetic. */
export async function readKnowledgeTableMetadata(context: ResearchContext, record: KnowledgeRecord): Promise<KnowledgeRecord> {
  const viewId = viewFor(context,record.id)
  if (!viewId) return record
  // Schema and arithmetic share the bounded source reader and current authority.
  const page = await readTableAnalysisSnapshot(context.target.organizationId,viewId,context.user.id)
  return { ...record, content: JSON.stringify({ table: { viewId, source:page.view.source, revision:page.view.revision,
    columns:page.columns.map(({key,label,type})=>({key,label,type})),filter:page.view.config.filter,total:page.total,...(page.sheet ? {sheet:{range:page.sheet.range,sheetTitle:page.sheet.sheetTitle,providerVersion:page.sheet.providerVersion,rangeRows:page.sheet.rangeRows,blankRows:page.sheet.blankRows,filterBasis:page.sheet.filterBasis,hiddenRows:page.sheet.hiddenRows}} : {}) },
    note:`Schema only; rows unread. For ${page.view.source === "sheets" ? "linked Sheets" : "native tables"} use tableAnalysis with explicit amount, currency and YYYY-MM columns. Totals require complete selected rows; never add search excerpts.` }), contentAvailable:true, contentTruncated:false }
}
export async function readKnowledgeTableAnalysis(context: ResearchContext, request: TableAnalysisRequest, signal?: AbortSignal) {
  if(request.id.startsWith("file:")) return readKnowledgeCsvAnalysis(context,request,signal)
  const viewId = viewFor(context,request.id)
  if (!viewId) throw Error("Table unavailable")
  const snapshot = await readTableAnalysisSnapshot(context.target.organizationId,viewId,context.user.id,signal)
  const calculated = calculateTableBudget(snapshot,request)
  const sourceRevision = fingerprint(snapshot)
  const sheet = snapshot.sheet
  const evidence = tableAnalysisEvidenceSchema.parse({ request,viewId,tableId:snapshot.view.tableId,viewRevision:snapshot.view.revision,
    sourceRevision,filter:snapshot.view.config.filter,filterOperator:"case_insensitive_contains",selectedRows:snapshot.total,
    matchedRows:calculated.matchedRows,...(calculated.groups ? {groups:calculated.groups.map(({label,matchedRows}) => ({label,matchedRows}))} : {}),...(calculated.comparison ? {comparisonMatchedRows:calculated.comparison.matchedRows} : {}),...(sheet ? {sheet:{range:sheet.range,title:sheet.title,sheetTitle:sheet.sheetTitle,sourceRevision:sheet.sourceRevision,providerVersion:sheet.providerVersion,rangeRows:sheet.rangeRows,blankRows:sheet.blankRows,filterBasis:sheet.filterBasis,hiddenRows:sheet.hiddenRows}} : {}),complete:true,amountUnit:"major",scale:2 })
  return { evidence, fingerprint:fingerprint({request,sourceRevision}), content:JSON.stringify({
    budget:calculated.budget,actual:calculated.actual,delta:calculated.delta,deltaDefinition:calculated.deltaDefinition,
    currency:request.currency,period:request.period,matchedRows:calculated.matchedRows,...(calculated.groups ? {groups:calculated.groups} : {}),...(calculated.comparison ? {comparison:calculated.comparison} : {}),
    scope:request.compareToPeriod ? "Complete saved-view filter intersected with the two declared months; no FX, forecasts, percentages, or whole-organization total." : "Complete saved-view filter intersected with the declared month; no FX, forecasts, or whole-organization total." }) }
}
export async function assertTableAnalysesCurrent(context: ResearchContext, dependencies: readonly { request: TableAnalysisRequest; fingerprint:string }[], signal?: AbortSignal) {
  for (const dependency of dependencies) {
    const current = await readKnowledgeTableAnalysis(context,dependency.request,signal)
    if (current.fingerprint !== dependency.fingerprint) throw new ResearchRecoveryError("sources_changed")
  }
}
