"use client"

import { useId } from "react"
import { DownloadIcon, ExternalLinkIcon, LoaderCircleIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import { useCompanionCard } from "../hooks/use-companion-card"
import type { CompanionProposal, CompanionSnapshot, CompanionTransport } from "../types"

export function CompanionPanel({ initialSnapshot, proposal, transport }: { initialSnapshot: CompanionSnapshot; proposal?: CompanionProposal; transport: CompanionTransport }) {
  const id = useId()
  const card = useCompanionCard(initialSnapshot, proposal, transport)
  const { snapshot, activeProposal, pending } = card
  const answered = snapshot.lesson.fields.filter((field) => snapshot.draft.answers[field.name]?.trim()).length
  let lessonUrl = "https://coachhouse.app/accelerator"
  try {
    const destination = new URL(snapshot.lesson.href, "https://coachhouse.app")
    if (destination.origin === "https://coachhouse.app") lessonUrl = destination.href
  } catch { /* Keep the known Coach House destination for an invalid source URL. */ }
  const event = snapshot.calendar.event

  return <div className="flex w-full min-w-0 touch-manipulation flex-col gap-3 [&_button]:min-h-11 [&_a]:min-h-11 motion-reduce:[&_*]:transition-none">
    <Card>
      <CardHeader className="px-4 py-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardDescription>{snapshot.organization.name}</CardDescription><CardTitle><h2 className={WORKSPACE_TEXT_STYLES.cardTitle}>{snapshot.lesson.title}</h2></CardTitle></div><Badge variant="outline">Sandbox</Badge></div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 pb-3">
        <p className={WORKSPACE_TEXT_STYLES.body}>{answered} of {snapshot.lesson.fields.length} answers saved · {snapshot.submission.status === "submitted" ? "Submitted" : "Not submitted"} · {snapshot.submission.completed ? "Completed in sandbox" : "Not completed"}</p>
        <p className={WORKSPACE_TEXT_STYLES.utility}>{snapshot.source.kind === "repository_fixture" ? "Repository fixture" : "Published curriculum"}: {snapshot.source.label}. Sandbox changes stay here; links open live Coach House.</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 px-4 pb-3">
        <Button asChild size="sm" variant="outline"><a href={lessonUrl} target="_blank" rel="noopener noreferrer">Open lesson<ExternalLinkIcon data-icon="inline-end" aria-hidden="true" /></a></Button>
        <Button asChild size="sm" variant="ghost"><a href="https://coachhouse.app/workspace" target="_blank" rel="noopener noreferrer">Open workspace<ExternalLinkIcon data-icon="inline-end" aria-hidden="true" /></a></Button>
      </CardFooter>
    </Card>
    <div aria-live="polite" aria-atomic="true">
      {card.error && <Alert variant="destructive"><AlertTitle>Change not saved</AlertTitle><AlertDescription>{card.error} {card.canRetry && <Button size="sm" variant="outline" disabled={pending} onClick={() => void card.save(true)}>Retry save</Button>}</AlertDescription></Alert>}
      {card.notice && !card.error && <p className={WORKSPACE_TEXT_STYLES.bodyMuted}>{card.notice}</p>}
    </div>
    {activeProposal && !card.matches && <Alert variant="destructive"><AlertDescription>This proposal belongs to another document or organization. Request a new proposal.</AlertDescription></Alert>}
    {activeProposal && card.matches && <Card aria-labelledby={`${id}-review`}>
      <CardHeader className="px-4 py-3"><CardTitle><h3 id={`${id}-review`} className={WORKSPACE_TEXT_STYLES.cardTitle}>{snapshot.document.title}</h3></CardTitle><CardDescription>Review change · Sandbox document only</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-3">
        <p className={WORKSPACE_TEXT_STYLES.utility}>Destination: {snapshot.organization.name} / {snapshot.document.title}. Not public.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <section aria-label="Saved document" className="min-w-0"><h4 className={WORKSPACE_TEXT_STYLES.sectionTitle}>Saved · Revision {snapshot.document.revision}</h4><p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[13px] leading-6" tabIndex={0}>{snapshot.document.content || "No saved text."}</p></section>
          <section aria-label="Proposed document" className="min-w-0"><h4 className={WORKSPACE_TEXT_STYLES.sectionTitle}>Proposed change</h4><p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[13px] leading-6" tabIndex={0}>{activeProposal.content}</p></section>
        </div>
        {card.matches && activeProposal.expectedRevision !== snapshot.document.revision && <p className={WORKSPACE_TEXT_STYLES.bodyMuted}>The saved document changed after this proposal. Request a refreshed proposal before saving.</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 px-4 pb-3">
        <Button size="sm" disabled={pending || !card.matches} onClick={() => void card.save(card.canRetry)}>{pending && <LoaderCircleIcon data-icon="inline-start" className="motion-safe:animate-spin" aria-hidden="true" />}Save change</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={card.dismiss}>Dismiss</Button>
      </CardFooter>
    </Card>}
    {event && <Card>
      <CardHeader className="px-4 py-3"><CardTitle><h3 className={WORKSPACE_TEXT_STYLES.cardTitle}>{event.title}</h3></CardTitle><CardDescription>Calendar export ready</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 pb-3">
        <p className={WORKSPACE_TEXT_STYLES.body}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone }).format(new Date(event.startsAt))} – {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone }).format(new Date(event.endsAt))} · {event.timeZone}</p>
        <p className={WORKSPACE_TEXT_STYLES.utility}>Import this file into your calendar. No external event has been created.</p>
      </CardContent>
      <CardFooter className="px-4 pb-3"><Button asChild size="sm" variant="outline"><a download="coach-house-work-block.ics" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(event.ics)}`}><DownloadIcon data-icon="inline-start" aria-hidden="true" />Download .ics</a></Button></CardFooter>
    </Card>}
  </div>
}
