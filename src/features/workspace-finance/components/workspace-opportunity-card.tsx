"use client"
import { useRef, useState, type ComponentProps } from "react"
import { CalendarDays, Check, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { WorkspaceFinanceOpportunityInput, WorkspaceFinanceOpportunityWorkflowStatus } from "../types"
import { hasReportContent, readOpportunityReport } from "../lib/opportunity-report"
import { sourceKey } from "../lib/opportunity-sources"
import { OpportunitySourcePill } from "./opportunity-source-pill"
import { OpportunityReportContent } from "./opportunity-report-content"
import { WorkspaceOpportunityForm } from "./workspace-opportunity-form"

type FormContext = Omit<ComponentProps<typeof WorkspaceOpportunityForm>, "initial" | "onCancel" | "onCreated">
const labels = { new: "Suggested", saved: "Saved", applied: "Applied", awarded: "Awarded", not_awarded: "Not awarded", dismissed: "Dismissed" }
export function WorkspaceOpportunityCard({ item, status, canEdit, pending, onStatus, onSaved, onOpenSource, form }: {
  item: WorkspaceFinanceOpportunityInput; status: WorkspaceFinanceOpportunityWorkflowStatus; canEdit: boolean; pending: boolean
  onStatus: (status: WorkspaceFinanceOpportunityWorkflowStatus) => void; onSaved: (item: WorkspaceFinanceOpportunityInput) => void
  onOpenSource?: (id: string) => boolean; form: FormContext
}) {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const manual = item.origin === "manual"
  const report = readOpportunityReport(item.report)
  const text = report.blocks.find(block => block.kind === "text" && hasReportContent(block))
  const sources = item.sources ?? []
  const hasDetails = report.blocks.some(hasReportContent) || sources.length > 0
  const date = item.dueAt ? new Date(item.dueAt) : null
  const deadline = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date) : null
  const closeEditor = () => { setEditing(false); requestAnimationFrame(() => editButton.current?.focus()) }
  if (editing) return <li className="rounded-2xl border border-border/60 bg-background p-3"><WorkspaceOpportunityForm {...form} initial={item} onCancel={closeEditor} onCreated={value => { onSaved(value); closeEditor() }} /></li>
  return <li className="overflow-hidden rounded-2xl border border-border/60 bg-muted/40 p-3">
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words pt-1.5 text-sm font-semibold leading-snug">{item.title}</h3>
        {canEdit && (manual ? <Button ref={editButton} type="button" size="icon" variant="ghost" className="size-9 shrink-0 rounded-full [@media(pointer:coarse)]:size-11" aria-label={`Edit ${item.title}`} onClick={() => { form.loadSources(); setEditing(true) }}><Pencil className="size-4" aria-hidden="true" /></Button> : <div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" className="size-9 rounded-full text-destructive [@media(pointer:coarse)]:size-11" disabled={pending} aria-label={`Dismiss ${item.title}`} onClick={() => onStatus("dismissed")}><X className="size-4" aria-hidden="true" /></Button>{(status === "new" || status === "saved") && <Button size="icon" variant="ghost" className="size-9 rounded-full text-emerald-700 dark:text-emerald-400 [@media(pointer:coarse)]:size-11" disabled={pending || status === "saved"} aria-label={`${status === "saved" ? "Saved" : "Save"} ${item.title}`} onClick={() => onStatus("saved")}><Check className="size-4" aria-hidden="true" /></Button>}</div>)}
      </div>
      {!manual && <p className="text-xs text-muted-foreground">{labels[status]}</p>}
      {item.source && <p className="break-words text-sm text-muted-foreground">{item.source}</p>}
      {!open && text?.kind === "text" && <p className="line-clamp-2 break-words text-sm text-muted-foreground">{text.text}</p>}
      {deadline && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" /><time dateTime={item.dueAt ?? undefined}>{deadline}</time></p>}
      <CollapsibleContent className="space-y-4">
        <OpportunityReportContent report={report} options={form.sourceOptions} organizationId={form.organizationId} onOpenSource={onOpenSource} />
        {sources.length > 0 && <section className="space-y-2"><h4 className="text-xs font-medium text-muted-foreground">Sources</h4><div className="flex flex-wrap gap-1.5">{sources.map(source => <OpportunitySourcePill key={sourceKey(source)} source={source} organizationId={form.organizationId} option={form.sourceOptions.find(option => sourceKey(option.source) === sourceKey(source))} onOpen={onOpenSource} />)}</div></section>}
      </CollapsibleContent>
      {item.attribution === "grants_gov" && <p className="text-xs text-muted-foreground">Source: Grants.gov</p>}
      {hasDetails && <CollapsibleTrigger asChild><Button type="button" size="sm" variant="ghost" className="h-8 rounded-full px-2 text-xs" aria-label={`${open ? "Show less" : "Show more"} about ${item.title}`}>{open ? "Show less" : "Show more"}</Button></CollapsibleTrigger>}
    </Collapsible>
  </li>
}
