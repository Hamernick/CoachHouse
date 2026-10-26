"use client"

import { useEffect, useId, useRef, useState } from "react"
import { DownloadIcon, ExternalLinkIcon, LoaderCircleIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import { isAssignmentFieldAnswerable, isAssignmentFieldAnswered } from "@/lib/modules/assignment-completion"
import type { LiveCompanionProposal, LiveCompanionSnapshot, LiveCompanionToolArguments, LiveCompanionToolName, LiveCompanionToolResult } from "../types"

type Transport = (name: LiveCompanionToolName, args: LiveCompanionToolArguments) => Promise<LiveCompanionToolResult>
type CalendarEvent = NonNullable<LiveCompanionSnapshot["calendar"]["event"]>
type SaveAttempt = { key: string; proposal: LiveCompanionProposal; args: LiveCompanionToolArguments }

const contextKey = (snapshot: LiveCompanionSnapshot) => JSON.stringify([snapshot.organization.id, snapshot.lesson.id, snapshot.document.id])
const proposalKey = (proposal: LiveCompanionProposal) => JSON.stringify([proposal.organizationId, proposal.lessonId, proposal.documentId, proposal.expectedRevision, proposal.content])

export function connectedProposalMatches(proposal: LiveCompanionProposal, snapshot: LiveCompanionSnapshot) {
  return snapshot.mode === "connected" && proposal.visibility === "organization" && snapshot.document.visibility === "organization" &&
    proposal.organizationId === snapshot.organization.id && proposal.lessonId === snapshot.lesson.id && proposal.documentId === snapshot.document.id
}

export function connectedProposalIsCurrent(proposal: LiveCompanionProposal, snapshot: LiveCompanionSnapshot) {
  return connectedProposalMatches(proposal, snapshot) && proposal.expectedRevision === snapshot.document.revision
}

export function connectedSaveConfirmed(proposal: LiveCompanionProposal, snapshot: LiveCompanionSnapshot | undefined) {
  return Boolean(snapshot && connectedProposalMatches(proposal, snapshot) && snapshot.document.revision &&
    snapshot.document.revision !== proposal.expectedRevision && snapshot.document.content === proposal.content)
}

export function connectedSaveArguments(proposal: LiveCompanionProposal, requestId: string): LiveCompanionToolArguments {
  return { organizationId: proposal.organizationId, lessonId: proposal.lessonId, documentId: proposal.documentId,
    expectedRevision: proposal.expectedRevision, content: proposal.content, requestId, confirmed: true }
}

function safeNativeUrl(value: string) {
  try {
    if (/[\\\s]/.test(value)) return null
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url : null
  } catch { return null }
}

function nativeHref(value: string, origin: string | undefined, fallback: string) {
  if (!origin) return undefined
  const url = safeNativeUrl(value)
  return url?.origin === origin ? url.href : `${origin}${fallback}`
}

function NativeLink({ href, children, variant = "ghost" }: {
  href: string | undefined; children: string; variant?: "ghost" | "outline"
}) {
  return href ? <Button asChild size="sm" variant={variant}><a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLinkIcon aria-hidden="true" /></a></Button>
    : <Button size="sm" variant={variant} disabled>{children}<ExternalLinkIcon aria-hidden="true" /></Button>
}

export function ConnectedCompanionPanel({ initialSnapshot, proposal, transport, onDownloadCalendar }: {
  initialSnapshot: LiveCompanionSnapshot; proposal?: LiveCompanionProposal; transport: Transport;
  onDownloadCalendar?: (event: CalendarEvent) => Promise<void>
}) {
  const id = useId()
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [currentProposal, setCurrentProposal] = useState(proposal)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [downloadMessage, setDownloadMessage] = useState("")
  const [downloading, setDownloading] = useState(false)
  const snapshotRef = useRef(snapshot)
  const inFlight = useRef(false)
  const attempt = useRef<SaveAttempt | null>(null)
  const lastSave = useRef<{ context: string; before: string; after: string } | null>(null)
  const incomingProposalKey = proposal ? proposalKey(proposal) : null
  const previousIncomingKey = useRef(incomingProposalKey)
  const key = currentProposal ? proposalKey(currentProposal) : null
  const matches = Boolean(currentProposal && connectedProposalMatches(currentProposal, snapshot))
  const current = Boolean(currentProposal && connectedProposalIsCurrent(currentProposal, snapshot))
  const alreadyMatches = Boolean(currentProposal && connectedSaveConfirmed(currentProposal, snapshot))
  const activeProposal = currentProposal && key !== dismissedKey && !alreadyMatches ? currentProposal : null
  const canRetry = Boolean(error && key && attempt.current?.key === key && matches)
  const lessonUrl = safeNativeUrl(snapshot.lesson.href)
  const appOrigin = lessonUrl && /^\/(?:accelerator(?:\/|$)|class\/[^/]+\/module\/\d+\/?$)/.test(lessonUrl.pathname) ? lessonUrl.origin : undefined
  const fields = snapshot.lesson.fields.filter(isAssignmentFieldAnswerable)
  const answered = fields.filter((field) => isAssignmentFieldAnswered(field, snapshot.draft.answers)).length

  useEffect(() => {
    const changedContext = contextKey(initialSnapshot) !== contextKey(snapshotRef.current)
    const saved = lastSave.current
    if (!changedContext && saved?.context === contextKey(initialSnapshot) && initialSnapshot.document.revision === saved.before && snapshotRef.current.document.revision === saved.after) return
    snapshotRef.current = initialSnapshot
    setSnapshot(initialSnapshot)
    if (changedContext) {
      setCurrentProposal(proposal)
      setDismissedKey(null)
      setError(null)
      setNotice("")
      attempt.current = null
      lastSave.current = null
    }
  }, [initialSnapshot, proposal])

  useEffect(() => {
    if (proposal && incomingProposalKey !== previousIncomingKey.current) {
      setCurrentProposal(proposal)
      setError(null)
      setNotice("")
      if (attempt.current?.key !== incomingProposalKey) attempt.current = null
    }
    previousIncomingKey.current = incomingProposalKey
  }, [incomingProposalKey, proposal])

  async function save(retry = false) {
    if (inFlight.current || !currentProposal || !matches || !key || (!current && !(retry && attempt.current?.key === key))) return
    const operation = retry && attempt.current?.key === key ? attempt.current : {
      key, proposal: { ...currentProposal }, args: connectedSaveArguments(currentProposal, crypto.randomUUID()),
    }
    const originalContext = contextKey(snapshotRef.current)
    inFlight.current = true
    attempt.current = operation
    setPending(true)
    setError(null)
    try {
      await transport("companion_save_document", operation.args)
      const verified = await transport("companion_get_session", {
        organizationId: operation.proposal.organizationId, lessonId: operation.proposal.lessonId, documentId: operation.proposal.documentId,
      })
      if (contextKey(snapshotRef.current) !== originalContext) return
      if (!connectedSaveConfirmed(operation.proposal, verified.snapshot)) {
        throw new Error("The latest saved record did not confirm this exact change. Retry the same save to check it.")
      }
      const saved = verified.snapshot!
      lastSave.current = { context: originalContext, before: operation.proposal.expectedRevision, after: saved.document.revision }
      snapshotRef.current = saved
      setSnapshot(saved)
      setDismissedKey(operation.key)
      setNotice("Organization document draft saved. The previously published version was preserved.")
      attempt.current = null
    } catch (cause) {
      if (contextKey(snapshotRef.current) === originalContext) setError(cause instanceof Error ? cause.message : "The change could not be confirmed. Your proposal is still available.")
    } finally { inFlight.current = false; setPending(false) }
  }

  const event = snapshot.calendar.event
  async function download() {
    if (!event || !onDownloadCalendar || downloading) return
    setDownloading(true)
    setDownloadMessage("")
    try { await onDownloadCalendar(event); setDownloadMessage("Download requested") }
    catch { setDownloadMessage("Download was canceled or blocked. Retry the download.") }
    finally { setDownloading(false) }
  }
  const submissionLabel = { not_submitted: "Not submitted", submitted: "Submitted", accepted: "Accepted", revise: "Revision requested" }[snapshot.submission.status]

  return <div className="flex w-full min-w-0 touch-manipulation flex-col gap-3 [&_button]:min-h-11 [&_a]:min-h-11 motion-reduce:[&_*]:transition-none">
    <Card>
      <CardHeader className="px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardDescription>{snapshot.organization.name}</CardDescription><CardTitle><h2 className={WORKSPACE_TEXT_STYLES.cardTitle}>{snapshot.lesson.title}</h2></CardTitle></div><Badge variant="outline">Connected</Badge></div></CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 pb-3">
        <p className={WORKSPACE_TEXT_STYLES.body}>{answered} of {fields.length} draft answers saved · {submissionLabel} · {snapshot.submission.completed ? "Completed" : "Not completed"}</p>
        <p className={WORKSPACE_TEXT_STYLES.utility}>Continue in conversation. Open Coach House for full lessons and documents.</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 px-4 pb-3">
        <NativeLink variant="outline" href={nativeHref(snapshot.lesson.href, appOrigin, "/accelerator")}>Open lesson</NativeLink>
        <NativeLink href={appOrigin ? `${appOrigin}/workspace` : undefined}>Open workspace</NativeLink>
        <NativeLink href={nativeHref(snapshot.coachingHref, appOrigin, "/coaching")}>Book coaching</NativeLink>
      </CardFooter>
    </Card>
    <div aria-live="polite" aria-atomic="true">
      {error && <Alert variant="destructive"><AlertTitle>Change not confirmed</AlertTitle><AlertDescription>{error}{canRetry && <Button size="sm" variant="outline" disabled={pending} onClick={() => void save(true)}>Retry same save</Button>}</AlertDescription></Alert>}
      {notice && !error && <p className={WORKSPACE_TEXT_STYLES.bodyMuted}>{notice}</p>}
      {alreadyMatches && !notice && !error && <p className={WORKSPACE_TEXT_STYLES.bodyMuted}>The saved document already matches this proposal.</p>}
    </div>
    {activeProposal && !matches && <Alert variant="destructive"><AlertDescription>This proposal belongs to another organization, lesson, or document. Request a new proposal.</AlertDescription></Alert>}
    {activeProposal && matches && <Card aria-labelledby={`${id}-review`}>
      <CardHeader className="px-4 py-3"><CardTitle><h3 id={`${id}-review`} className={WORKSPACE_TEXT_STYLES.cardTitle}>{snapshot.document.title}</h3></CardTitle><CardDescription>Review organization draft change</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-3">
        <p className={WORKSPACE_TEXT_STYLES.utility}>Destination: {snapshot.organization.name} / {snapshot.document.title}. Shared within your organization; the previously published version stays unchanged.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <section aria-label="Saved organization draft" className="min-w-0"><h4 className={WORKSPACE_TEXT_STYLES.sectionTitle}>Current draft</h4><p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[13px] leading-6" tabIndex={0}>{snapshot.document.content || "No saved text."}</p></section>
          <section aria-label="Proposed organization draft" className="min-w-0"><h4 className={WORKSPACE_TEXT_STYLES.sectionTitle}>Proposed change</h4><p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[13px] leading-6" tabIndex={0}>{activeProposal.content}</p></section>
        </div>
        {!current && <p className={WORKSPACE_TEXT_STYLES.bodyMuted}>The document changed after this review. Request a refreshed proposal before saving.</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 px-4 pb-3">
        <Button size="sm" disabled={pending || !current} onClick={() => void save(canRetry)}>{pending && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}Save change</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setDismissedKey(key); setError(null) }}>Dismiss</Button>
        <NativeLink href={nativeHref(snapshot.document.href, appOrigin, "/workspace")}>Open document</NativeLink>
      </CardFooter>
    </Card>}
    {event && <Card>
      <CardHeader className="px-4 py-3"><CardTitle><h3 className={WORKSPACE_TEXT_STYLES.cardTitle}>{event.title}</h3></CardTitle><CardDescription>Calendar export ready</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-2 px-4 pb-3"><p className={WORKSPACE_TEXT_STYLES.body}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone }).format(new Date(event.startsAt))} – {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone }).format(new Date(event.endsAt))} · {event.timeZone}</p><p className={WORKSPACE_TEXT_STYLES.utility}>Import the file into your calendar. No external event has been created.</p></CardContent>
      <CardFooter className="flex flex-wrap gap-2 px-4 pb-3">{onDownloadCalendar ? <Button size="sm" variant="outline" disabled={downloading} onClick={() => void download()}><DownloadIcon aria-hidden="true" />Download .ics</Button> : <Button asChild size="sm" variant="outline"><a download="coach-house-work-block.ics" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(event.ics)}`}><DownloadIcon aria-hidden="true" />Download .ics</a></Button>}{downloadMessage && <span role="status" className={WORKSPACE_TEXT_STYLES.utility}>{downloadMessage}</span>}</CardFooter>
    </Card>}
  </div>
}
