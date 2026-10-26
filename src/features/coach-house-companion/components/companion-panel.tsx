"use client"

import { useId, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import { useCompanionSession } from "../hooks/use-companion-session"
import type { CompanionSnapshot, CompanionTransport } from "../types"
import { CompanionCalendar } from "./companion-calendar"
import { CompanionDevelop } from "./companion-develop"
import { CompanionReview } from "./companion-review"
import { CompanionReceipt } from "./companion-receipt"
import { CompanionStatus } from "./companion-status"

export function CompanionPanel({ initialSnapshot, transport }: { initialSnapshot: CompanionSnapshot; transport: CompanionTransport }) {
  const id = useId()
  const session = useCompanionSession(initialSnapshot, transport)
  const [sections, setSections] = useState<string[]>([])
  const { snapshot } = session
  function openSection(section: string) {
    setSections((current) => current.includes(section) ? current : [...current, section])
    requestAnimationFrame(() => document.getElementById(`${id}-${section}`)?.focus())
  }

  return <section aria-labelledby={`${id}-title`} className="flex w-full min-w-0 touch-manipulation flex-col gap-4 px-4 py-4 sm:px-5 [&_button]:min-h-11 [&_input]:min-h-11 [&_textarea]:text-base [&_input]:text-base motion-reduce:[&_*]:animate-none motion-reduce:[&_*]:transition-none">
    <header className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className={WORKSPACE_TEXT_STYLES.meta}>{snapshot.organization.name}</p><h1 id={`${id}-title`} className={WORKSPACE_TEXT_STYLES.cardTitle}>{snapshot.lesson.title}</h1></div>
        <Badge variant="outline">Sandbox</Badge>
      </div>
      <p className={WORKSPACE_TEXT_STYLES.utility}>{snapshot.source.kind === "repository_fixture" ? "Practice curriculum" : "Coach House accelerator"} · Changes stay in this sandbox.</p>
    </header>
    <CompanionStatus session={session} />
    <CompanionDevelop session={session} onReview={() => openSection("document")} />
    <Accordion type="multiple" value={sections} onValueChange={setSections}>
      <AccordionItem value="document">
        <AccordionTrigger id={`${id}-document`}>Document review</AccordionTrigger>
        <AccordionContent forceMount hidden={!sections.includes("document")}><CompanionReview session={session} onReceipt={() => openSection("saved")} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="calendar">
        <AccordionTrigger id={`${id}-calendar`}>Calendar export</AccordionTrigger>
        <AccordionContent forceMount hidden={!sections.includes("calendar")}><CompanionCalendar session={session} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="saved">
        <AccordionTrigger id={`${id}-saved`}>Saved status{session.dirty ? " · Unsaved changes" : ""}</AccordionTrigger>
        <AccordionContent forceMount hidden={!sections.includes("saved")}><CompanionReceipt session={session} /></AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
}
