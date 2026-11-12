"use client"

import { knowledgePersonFieldLabels } from "../lib/knowledge-person-fields"
import { FileText, Globe } from "lucide-react"
import { ParticleButton as Button, ParticleButtonLink, ParticlePopover as Popover } from "@/components/ui/particle-ui"
import type { KnowledgeEvidence, ResearchSource } from "../research-types"

const scopeLabels: Record<KnowledgeEvidence["scope"], string> = {
  record: "Shared record fields only; not the entire underlying record.",
  text: "Extracted text only; not images or formatting.",
  document_body: "Document body only; not headers, footers or embedded content.",
  selected_plan: "Selected plan context only; not every linked source.",
}

function coverage(source: ResearchSource) {
  const evidence = source.evidence
  if (!evidence) return { label: "Coverage unknown", detail: "This result has no saved read coverage. Opening the source does not mean the AI read it." }
  if (evidence.tableAnalysis) return { label: "Calculated selection", detail: evidence.tableAnalysis.request.compareToPeriod ? "Exact totals over the complete saved selection and both stated months; not a whole-organization total." : "Exact totals over the complete saved selection and stated month; not a whole-organization total." }
  switch (evidence.coverage) {
    case "metadata_only": return { label: "Details only", detail: "Only source details were available. Content was not read." }
    case "unavailable": return { label: "Content unavailable", detail: "Content could not be read. No content-based claim is supported by this source." }
    case "excerpt": return { label: "Partial text", detail: evidence.readAt ? "Only part of the available text was read." : "Only a search excerpt was provided; no detailed read was recorded." }
    case "complete": return { label: "Available scope read", detail: "All text within the stated scope was read. This does not verify its accuracy." }
  }
}

export function ResearchSources({ sources }: { sources: ResearchSource[] }) {
  if (!sources.length) return <p className="text-xs text-muted-foreground">No sources cited.</p>
  return <ul aria-label="Research sources" className="flex flex-wrap gap-2">
    {sources.map(source => {
      const title = source.title || "Untitled source"
      const status = coverage(source)
      const table = source.evidence?.tableAnalysis
      const Icon = source.kind === "web" ? Globe : FileText
      return <li key={source.id} className="min-w-0 max-w-full">
        <Popover>
          <Popover.Trigger>
            <Button color="secondary" type="button" variant="soft" aria-label={`Source details: ${title}`} className="h-auto min-h-8 max-w-full gap-2 rounded-full px-3 py-1.5 text-xs font-normal [@media(pointer:coarse)]:min-h-11">
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 max-w-40 truncate">{title}</span>
              <span className="shrink-0 text-muted-foreground">{status.label}</span>
            </Button>
          </Popover.Trigger>
          <Popover.Content align="start" width={320} minWidth={0} className="particle-ui max-w-[calc(100vw-1.5rem)] text-sm motion-reduce:animate-none"><section aria-label={`Source details: ${title}`} className="space-y-3">
            <p className="break-words font-medium">{title}</p>
            <div className="space-y-1">
              <p className="font-medium">{status.label}</p>
              <p className="text-xs text-muted-foreground">{status.detail}</p>
              {source.evidence && <>
                {source.evidence.pdf && <div className="space-y-1 text-xs text-muted-foreground">
                  {[...(source.evidence.pdf.priorWindows ?? []), {...source.evidence.pdf,textCoverage:source.evidence.textCoverage}].map(window => <p key={window.startPage ?? 1}>
                    PDF text from pages {window.pages.join(", ") || "none"} of {window.totalPages}.
                    {" "}Window: pages {window.startPage ?? 1}–{(window.startPage ?? 1)+window.processedPages-1}; text positions start at 0 within this window.
                    {window.unreadPages.length > 0 && <> No readable text on pages {window.unreadPages.join(", ")}.</>}
                    {window.textCoverage && <> Read text positions: {window.textCoverage.ranges.map(range => `${range.start}–${range.end}`).join(", ") || "none"}.</>}
                  </p>)}
                  <p>Pages outside these windows and undisclosed text remain unread. Images, forms and layout were not read.</p>
                </div>}
                {table ? <div className="space-y-1 break-words text-xs text-muted-foreground">
                  <p className="tabular-nums">{table.matchedRows.toLocaleString()} of {table.selectedRows.toLocaleString()} {table.csv ? "CSV data" : "saved-view"} rows matched <time dateTime={table.request.period}>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${table.request.period}-01T12:00:00Z`))}</time> · {table.request.currency} in major units.</p>
                  {table.request.compareToPeriod && <p className="tabular-nums">Comparison: {table.comparisonMatchedRows?.toLocaleString()} rows matched <time dateTime={table.request.compareToPeriod}>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${table.request.compareToPeriod}-01T12:00:00Z`))}</time>. Differences = selected month − comparison month; same columns and currency. No percentage change.</p>}
                  {table.groups && <p className="tabular-nums">Grouped by {table.request.groupByColumn}: {table.groups.length.toLocaleString()} exact-label groups covering all {table.matchedRows.toLocaleString()} matched rows. Subtotals reconcile to the month totals; no labels merged or rows omitted.</p>}
                  <p>Filter: {table.filter ? `${table.filter.column} contains “${table.filter.value}” (case-insensitive).` : table.csv ? "All CSV data rows." : "All saved-view rows."}</p>
                  {table.sheet && <>
                    <p>{table.sheet.title} · {table.sheet.sheetTitle} (tab {table.sheet.range.sheetId}) · rows {table.sheet.range.startRow}–{table.sheet.range.startRow+table.sheet.range.rowCount-1}, columns {table.sheet.range.startColumn}–{table.sheet.range.startColumn+table.sheet.range.columnCount-1}; first row is the header.</p>
                    <p>{table.sheet.rangeRows} data rows read; {table.sheet.blankRows} blank rows excluded. Filter uses displayed values; hidden rows included. Amounts use unformatted values and formula results.</p>
                    <p>Google file version {table.sheet.providerVersion}; range fingerprint <span className="break-all font-mono">{table.sheet.sourceRevision}</span>.</p>
                  </>}
                  {table.csv && <>
                    <p>Complete UTF-8 CSV · comma delimiter · first record is the header · {table.csv.dataRows.toLocaleString()} data records; no rows omitted. Quoted cells may span lines. Formulas are not evaluated.</p>
                    <p>{table.csv.columns.map(column => `${column.key}: ${column.label}`).join("; ")}</p>
                    <p>{table.csv.byteLength.toLocaleString()} original bytes · File revision {table.csv.revision} · SHA-256 <span className="break-all font-mono">{table.csv.contentHash}</span></p>
                  </>}
                  <p>Budget: {table.request.budgetColumn}; actual: {table.request.actualColumn}. Delta = actual − budget.</p>
                  <p>Currency: {table.request.currencyColumn}; month: {table.request.periodColumn} (YYYY-MM).</p>
                  <p>{table.viewRevision !== null && <>View revision {table.viewRevision.toLocaleString()} · </>}Source revision <span className="break-all font-mono">{table.sourceRevision}</span></p>
                </div> : <p className="text-xs text-muted-foreground">{source.evidence.contactFields ? `Selected contact fields: ${source.evidence.contactFields.map(field => knowledgePersonFieldLabels[field]).join(", ")}. Other contact fields were not included in this coverage.` : scopeLabels[source.evidence.scope]}</p>}
                <p className="text-xs text-muted-foreground">Coverage recorded <time dateTime={source.evidence.checkedAt}>{new Date(source.evidence.checkedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></p>
              </>}
            </div>
            <ParticleButtonLink color="secondary" variant="outline" size="md" href={source.href} target={source.kind === "web" ? "_blank" : undefined} rel="noreferrer">Open source{source.kind === "web" && <span className="sr-only"> in a new tab</span>}</ParticleButtonLink>
          </section></Popover.Content>
        </Popover>
      </li>
    })}
  </ul>
}
