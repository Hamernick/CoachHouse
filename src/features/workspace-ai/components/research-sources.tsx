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
                <p className="text-xs text-muted-foreground">{source.evidence.contactFields ? `Selected contact fields: ${source.evidence.contactFields.map(field => knowledgePersonFieldLabels[field]).join(", ")}. Other contact fields were not included in this coverage.` : scopeLabels[source.evidence.scope]}</p>
                <p className="text-xs text-muted-foreground">Coverage recorded <time dateTime={source.evidence.checkedAt}>{new Date(source.evidence.checkedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></p>
              </>}
            </div>
            <ParticleButtonLink color="secondary" variant="outline" size="2xl" href={source.href} target={source.kind === "web" ? "_blank" : undefined} rel="noreferrer">Open source{source.kind === "web" && <span className="sr-only"> in a new tab</span>}</ParticleButtonLink>
          </section></Popover.Content>
        </Popover>
      </li>
    })}
  </ul>
}
