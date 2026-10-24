"use client"
import { OpportunityFactContent } from "./opportunity-fact-row"
import type { OpportunityReport, OpportunityReportBlock } from "../lib/opportunity-report"
import { hasReportContent } from "../lib/opportunity-report"
import { sourceKey, type OpportunitySourceOption } from "../lib/opportunity-sources"
import { OpportunitySourcePill } from "./opportunity-source-pill"
import { useOpportunityFilePreview } from "./use-opportunity-file-preview"

export function OpportunityReportImage({ block, organizationId }: { block: Extract<OpportunityReportBlock, { kind: "image" }>; organizationId?: string }) {
  const image = useOpportunityFilePreview(true, organizationId, block.fileId)
  if (!image.url) return <div className="flex aspect-video items-center justify-center rounded-xl bg-muted/40 p-3"><p role={image.error ? "alert" : "status"} className="text-xs text-muted-foreground">{image.error ?? "Loading image…"}</p></div>
  // Authenticated, short-lived storage URLs are issued by the existing file service.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.url} alt={block.alt} loading="lazy" className="aspect-video w-full rounded-xl bg-muted/40 object-contain" />
}
export function OpportunityReportContent({ report, options, organizationId, onOpenSource }: {
  report: OpportunityReport; options: OpportunitySourceOption[]; organizationId?: string; onOpenSource?: (id: string) => boolean
}) {
  return <div className="space-y-4">{report.blocks.filter(hasReportContent).map(block => <section key={block.id} className="space-y-2">
    {block.title && <h4 className="text-sm font-medium">{block.title}</h4>}
    {block.kind === "text" && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{block.text}</p>}
    {block.kind === "facts" && <dl className="space-y-2">{block.items.filter(item => item.label || item.value || item.costs?.items.length).map(item => <OpportunityFactContent key={item.id} item={item} />)}</dl>}
    {block.kind === "sources" && <div className="flex flex-wrap gap-1.5">{block.sources.map(source => <OpportunitySourcePill key={sourceKey(source)} source={source} option={options.find(item => sourceKey(item.source) === sourceKey(source))} organizationId={organizationId} onOpen={onOpenSource} />)}</div>}
    {block.kind === "image" && <OpportunityReportImage block={block} organizationId={organizationId} />}
  </section>)}</div>
}
