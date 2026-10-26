"use client"

import { useEffect, useId, useState } from "react"
import { CalendarPlusIcon, DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldMessage } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import type { CompanionSession } from "../hooks/use-companion-session"
import { PendingIcon } from "./companion-status"

export function parseCompanionCalendarTime(value: string, utc: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(utc ? `${value}:00Z` : value)
  if (!Number.isFinite(date.getTime())) return null
  // Reject normalized invalid dates and DST gaps instead of silently moving the block.
  const roundTrip = utc ? date.toISOString().slice(0, 16) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  return roundTrip === value ? date : null
}

export function CompanionCalendar({ session }: { session: CompanionSession }) {
  const id = useId()
  const [localZone, setLocalZone] = useState("UTC")
  const [zone, setZone] = useState("local")
  const [title, setTitle] = useState(`Continue ${session.snapshot.lesson.title}`)
  const [start, setStart] = useState("")
  const [duration, setDuration] = useState("25")
  const [error, setError] = useState("")
  const event = session.snapshot.calendar.event
  useEffect(() => { setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone) }, [])
  const timeZone = zone === "utc" ? "UTC" : localZone

  async function prepare() {
    const instant = parseCompanionCalendarTime(start, zone === "utc")
    const minutes = Number(duration)
    if (!title.trim()) { setError("Give your work block a title."); document.getElementById(`${id}-title`)?.focus(); return }
    if (!instant || instant.getTime() <= Date.now()) { setError("Choose a valid future date and time. Times skipped by daylight saving cannot be used."); document.getElementById(`${id}-start`)?.focus(); return }
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) { setError("Choose a duration from 5 to 240 minutes."); document.getElementById(`${id}-duration`)?.focus(); return }
    setError("")
    await session.run("companion_schedule_block", { title: title.trim(), startsAt: instant.toISOString(), endsAt: new Date(instant.getTime() + minutes * 60_000).toISOString(), timeZone, confirmed: true })
  }

  return <section className="flex flex-col gap-4" aria-label="Calendar export">
    <p className={WORKSPACE_TEXT_STYLES.bodyMuted}>Download a calendar file to import yourself. No connected calendar or availability check.</p>
    <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void prepare() }}>
      <FieldGroup className="gap-4">
        <Field className="gap-2"><FieldLabel htmlFor={`${id}-title`}>Work block</FieldLabel><Input id={`${id}-title`} name="eventTitle" value={title} disabled={Boolean(session.pending)} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="gap-2"><FieldLabel htmlFor={`${id}-start`}>Date and time</FieldLabel><Input id={`${id}-start`} name="startsAt" type="datetime-local" value={start} disabled={Boolean(session.pending)} onChange={(e) => setStart(e.target.value)} aria-describedby={`${id}-zone-help`} /></Field>
          <Field className="gap-2"><FieldLabel htmlFor={`${id}-duration`}>Duration (minutes)</FieldLabel><Input id={`${id}-duration`} name="duration" type="number" inputMode="numeric" min={5} max={240} value={duration} disabled={Boolean(session.pending)} onChange={(e) => setDuration(e.target.value)} /></Field>
        </div>
        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-zone`}>Timezone</FieldLabel>
          <Select value={zone} onValueChange={setZone} disabled={Boolean(session.pending)}><SelectTrigger id={`${id}-zone`}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="local">{localZone} (device timezone)</SelectItem><SelectItem value="utc">UTC</SelectItem></SelectGroup></SelectContent></Select>
          <FieldDescription id={`${id}-zone-help`}>Time is interpreted in {timeZone} and saved as a UTC instant. During a repeated daylight-saving hour, the earlier occurrence is used.</FieldDescription>
        </Field>
      </FieldGroup>
      {error && <FieldMessage role="alert">{error}</FieldMessage>}
      <div><Button type="submit" variant="outline" disabled={Boolean(session.pending)}><PendingIcon active={session.pending === "companion_schedule_block"} fallback={CalendarPlusIcon} />Prepare calendar export</Button></div>
    </form>
    {event && <div className="flex flex-col gap-2">
      <p className={WORKSPACE_TEXT_STYLES.sectionTitle}>{event.title}</p>
      <p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: event.timeZone }).format(new Date(event.startsAt))} · {event.timeZone}</p>
      <p className="text-sm">Export ready. Importing the file is still required; no external event has been created.</p>
      <div><Button asChild variant="outline"><a download="coach-house-work-block.ics" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(event.ics)}`}><DownloadIcon data-icon="inline-start" />Download calendar file</a></Button></div>
    </div>}
  </section>
}
