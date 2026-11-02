"use client"
import { useRef, useState, type ComponentProps, type ReactNode } from "react"
import { parseISO } from "date-fns"
import { CalendarDays } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { WorkspaceFinanceOpportunityInput, WorkspaceFinanceOpportunityWorkflowStatus } from "../types"
import { hasReportContent, readOpportunityReport } from "../lib/opportunity-report"
import { opportunityCardTitle, opportunityCardAmount } from "../lib/opportunity-card-summary"
import { sourceKey } from "../lib/opportunity-sources"
import { OpportunitySourcePill } from "./opportunity-source-pill"
import { OpportunitySiteIcon } from "./opportunity-site-icon"
import { OpportunityThumbnail } from "./opportunity-thumbnail"
import { OpportunityReportContent } from "./opportunity-report-content"
import { WorkspaceOpportunityMenu } from "./workspace-opportunity-menu"
import type { WorkspaceOpportunityForm } from "./workspace-opportunity-form"

type FormContext = Omit<ComponentProps<typeof WorkspaceOpportunityForm>, "initial" | "onCancel" | "onCreated">
const labels = { new: "Suggested", saved: "Active", applied: "Applied", awarded: "Awarded", not_awarded: "Not awarded", dismissed: "Archived" }
export function WorkspaceOpportunityCard({ compact = false, detail = false, onOpen, renderTitle, item, status, canEdit, pending, onStatus, onEdit, onOpenSource, onAdd, onDelete, form }: {
  compact?: boolean
  detail?: boolean
  onOpen?: () => void
  renderTitle?: (content: ReactNode, disclosure?: { onClick: () => void; expanded: boolean }) => ReactNode
  item: WorkspaceFinanceOpportunityInput; status: WorkspaceFinanceOpportunityWorkflowStatus; canEdit: boolean; pending: boolean
  onStatus: (status: WorkspaceFinanceOpportunityWorkflowStatus) => void; onEdit: () => void
  onOpenSource?: (id: string) => boolean; onAdd?: () => Promise<void>; onDelete: () => Promise<boolean>; form: FormContext
}) {
  const [expanded, setOpen] = useState(false)
  const open = detail || expanded
  const editButton = useRef<HTMLSpanElement>(null)
  const manual = item.origin === "manual"
  const report = readOpportunityReport(item.report)
  const text = report.blocks.find(block => block.kind === "text" && hasReportContent(block))
  const sources = item.sources ?? []
  const reportImage = report.blocks.find(block => block.kind === "image" && block.fileId)
  const allSources = [...sources, ...report.blocks.flatMap(block => block.kind === "sources" ? block.sources : [])]
  const sourceImage = allSources.find(source => source.kind === "file" && form.sourceOptions.some(option => sourceKey(option.source) === sourceKey(source) && option.mimeType?.startsWith("image/")))
  const imageId = reportImage?.kind === "image" ? reportImage.fileId : sourceImage?.kind === "file" ? sourceImage.id : null
  const website = allSources.find(source => source.kind === "link")
  const websiteUrl = item.attribution === "grants_gov" ? "https://www.grants.gov" : website?.kind === "link" ? website.url : null
  const siteIcon = websiteUrl ? <OpportunitySiteIcon key={websiteUrl} url={websiteUrl} /> : null
  const displayTitle = detail ? item.title : opportunityCardTitle(item.title, manual)
  const award = opportunityCardAmount(report)
  const fallbackIcon = compact ? <Avatar aria-hidden className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-foreground/5 text-xs font-medium">{displayTitle.trim().slice(0, 1).toUpperCase()}</AvatarFallback></Avatar> : null
  const icon = imageId ? <OpportunityThumbnail key={`${form.organizationId}:${imageId}`} fileId={imageId} organizationId={form.organizationId} fallback={siteIcon ?? fallbackIcon} /> : siteIcon ?? fallbackIcon
  const titleContent = <>{icon}{compact ? <span className="flex min-w-0 flex-1 flex-col text-left leading-tight"><span className="truncate text-[13px] font-medium text-foreground" title={item.title}>{displayTitle}</span><span data-opportunity-award={award ? "" : undefined} title={award?.detail} className="truncate text-xs font-normal leading-4 text-muted-foreground tabular-nums">{award ? `${award.label} per award` : "Amount not specified"}</span></span> : <span className="min-w-0 break-words" title={displayTitle !== item.title ? item.title : undefined}>{displayTitle}</span>}</>
  const hasDetails = displayTitle !== item.title || report.blocks.some(hasReportContent) || sources.length > 0
  const date = item.dueAt ? new Date(item.dueAt) : null
  const deadline = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date) : null
  return <div data-opportunity-id={item.id} data-opportunity-status={status} data-sidebar-opportunity={compact || undefined} data-open={open} className={`transition-colors duration-150 motion-reduce:transition-none ${detail ? "min-w-0 px-1" : compact ? "relative min-w-0 rounded-lg px-2 hover:bg-muted/50" : "overflow-hidden rounded-2xl border border-border/60 bg-card p-3 hover:bg-secondary/70 dark:bg-secondary/70 dark:hover:bg-secondary"}`}>
    <Collapsible open={open} onOpenChange={setOpen} className={compact ? "space-y-2 data-[state=open]:pb-2" : "space-y-3"}>
      <div className={`flex justify-between gap-2 ${compact ? "items-center" : "items-start"}`}><h3 className={`min-w-0 flex-1 ${compact ? "text-[13px] font-normal leading-5" : "text-sm font-semibold leading-snug"}`}>{renderTitle ? renderTitle(titleContent, compact ? { onClick: onOpen ?? (() => setOpen(value => !value)), expanded: open } : undefined) : <span className="flex min-h-8 items-center gap-2">{titleContent}</span>}</h3>
        {canEdit && <span ref={editButton} tabIndex={-1} className="shrink-0"><WorkspaceOpportunityMenu title={item.title} pending={pending} onEdit={onEdit} onAdd={onAdd} archived={status === "dismissed"} onArchive={() => onStatus(status === "dismissed" ? "saved" : "dismissed")} onDelete={onDelete} /></span>}
      </div>
      {(!compact || open) && <>
      {award && !compact && <p data-opportunity-award title={award.detail} className="text-sm font-semibold tabular-nums">{award.label}</p>}
      {!manual && <p data-opportunity-state-label className="text-xs text-muted-foreground">{labels[status]}</p>}
      {item.source && <p className="break-words text-sm text-muted-foreground">{item.source}</p>}
      {!open && text?.kind === "text" && <p className="line-clamp-2 break-words text-sm text-muted-foreground">{text.text}</p>}
      {(report.timeline || deadline) && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />{report.timeline ? <span><time dateTime={report.timeline.from}>{parseISO(report.timeline.from).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time> – <time dateTime={report.timeline.to}>{parseISO(report.timeline.to).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></span> : <time dateTime={item.dueAt ?? undefined}>{deadline}</time>}</p>}
      <CollapsibleContent className="space-y-4">
        {displayTitle !== item.title && <p className="text-sm text-muted-foreground">{item.title}</p>}
        <OpportunityReportContent report={report} options={form.sourceOptions} organizationId={form.organizationId} onOpenSource={onOpenSource} />
        {sources.length > 0 && <section className="space-y-2"><h4 className="text-xs font-medium text-muted-foreground">Sources</h4><div className="flex flex-wrap gap-1.5">{sources.map(source => <OpportunitySourcePill key={sourceKey(source)} source={source} organizationId={form.organizationId} option={form.sourceOptions.find(option => sourceKey(option.source) === sourceKey(source))} onOpen={onOpenSource} />)}</div></section>}
      </CollapsibleContent>
      {item.attribution === "grants_gov" && <p className="text-xs text-muted-foreground">Source: Grants.gov</p>}
      </>}
      {!compact && !detail && hasDetails && <CollapsibleTrigger asChild><Button type="button" size="sm" variant="ghost" className="h-8 rounded-full px-2 text-xs" aria-label={`${open ? "Show less" : "Show more"} about ${item.title}`}>{open ? "Show less" : "Show more"}</Button></CollapsibleTrigger>}
    </Collapsible>
  </div>
}
