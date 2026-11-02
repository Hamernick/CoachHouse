"use client"

import type { ComponentProps } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkspaceOpportunityCard } from "./workspace-opportunity-card"
import { OpportunityViewControls } from "./opportunity-view-transition"

export function OpportunityReportView({ card, headerTarget, onBack, onPrevious, onNext }: {
  card: ComponentProps<typeof WorkspaceOpportunityCard>
  headerTarget?: HTMLDivElement | null
  onBack: () => void
  onPrevious?: () => void
  onNext?: () => void
}) {
  const navigation = <OpportunityViewControls><nav aria-label="Opportunity navigation" className="flex items-center gap-1 pb-2">
    <Button data-opportunity-back variant="ghost" size="sm" className="mr-auto h-8 gap-1 rounded-md px-1 text-xs" onClick={onBack}><ArrowLeft className="size-3.5" aria-hidden />Back</Button>
    <Button variant="ghost" size="icon" className="size-7 rounded-md [@media(pointer:coarse)]:size-11" aria-label="Previous opportunity" disabled={!onPrevious} onClick={onPrevious}><ChevronLeft className="size-4" aria-hidden /></Button>
    <Button variant="ghost" size="icon" className="size-7 rounded-md [@media(pointer:coarse)]:size-11" aria-label="Next opportunity" disabled={!onNext} onClick={onNext}><ChevronRight className="size-4" aria-hidden /></Button>
  </nav></OpportunityViewControls>
  return <section aria-label="Opportunity report" onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onBack() } }}>
    {headerTarget ? createPortal(navigation, headerTarget) : navigation}
    <WorkspaceOpportunityCard {...card} detail />
  </section>
}
