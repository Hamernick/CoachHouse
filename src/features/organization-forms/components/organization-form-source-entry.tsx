"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { z } from "zod"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { formSourceEntrySchema, formSourceDirectorySchema } from "../lib/form-source"
import { formSourcePath } from "../lib/form-source-link"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"
import { OrganizationFormSourceEditor } from "./organization-form-source-editor"
import { OrganizationFormViewerOffer } from "./organization-form-viewer-offer"
import { OrganizationFormViewerInvitations } from "./organization-form-viewer-invitations"

type Entry = z.infer<typeof formSourceEntrySchema>
type Directory = z.infer<typeof formSourceDirectorySchema>
/** Standalone draft collaboration never enters the organization's workspace. */
export function OrganizationFormSourceEntry({ organizationId, formId }: { organizationId: string; formId: string }) {
  const target = useMemo(() => ({ organizationId, formId }), [organizationId, formId])
  const [entry, setEntry] = useState<Entry | null>(null)
  const [directory, setDirectory] = useState<Directory | null>(null)
  const [after, setAfter] = useState<string | undefined>()
  const [editing, setEditing] = useState(false); const [locked, setLocked] = useState(false)
  const [reload, setReload] = useState(0); const [error, setError] = useState("")
  const editButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (editing || locked) return
    let active = true; let inFlight = false
    const load = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const value = formSourceEntrySchema.parse(await sendFormCommand({ action: "form_source_entry", ...target }))
        if (value.formId !== formId) throw new Error("Invalid form entry")
        const forms = formSourceDirectorySchema.parse(await sendFormCommand({ action: "form_source_directory", ...target, ...(after ? { after } : {}) }))
        if (active) { setEntry(value); setDirectory(forms); setError("") }
      } catch (failure) {
        if (active) { setEntry(null); setDirectory(null); setError(failure instanceof IntakeRequestError ? failure.message : "Unable to load this form.") }
      } finally { inFlight = false }
    }
    void load()
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load() }, 5000)
    const visible = () => { if (document.visibilityState === "visible") void load() }
    document.addEventListener("visibilitychange", visible)
    return () => { active = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", visible) }
  }, [target, formId, editing, locked, reload, after])
  if (editing) return <OrganizationFormSourceEditor target={target} formId={formId} onClose={() => {
    setEditing(false); setReload(value => value + 1); requestAnimationFrame(() => editButton.current?.focus())
  }} />
  return <section className="flex min-w-0 flex-col gap-4">
    <h1 className="break-words text-xl font-semibold">{entry?.title ?? "Form collaboration"}</h1>
    {entry ? <>
      <Button ref={editButton} type="button" size="lg" color="primary" className="min-h-11 self-start rounded-xl" disabled={locked} onClick={() => setEditing(true)}>Edit form</Button>
      {entry.canManageInvitations && <OrganizationFormViewerInvitations target={target} disabled={false} onLockChange={setLocked} onRevisionChange={() => setReload(value => value + 1)} />}
      {directory && <nav aria-label="Forms you can edit" className="space-y-2 border-t pt-3">
        <h2 className="text-sm font-medium">Forms you can edit</h2>
        {directory.forms.map(form => <div key={form.formId}>{locked
          ? <span className="break-words text-sm">{form.title}</span>
          : <Link className="inline-flex min-h-11 items-center break-words text-sm underline" aria-current={form.formId === formId ? "page" : undefined} href={formSourcePath(organizationId, form.formId)}>{form.title}</Link>}</div>)}
        {after && <Button type="button" size="lg" color="primary" variant="ghost" disabled={locked} onClick={() => { setDirectory(null); setAfter(undefined) }}>First forms</Button>}
        {directory.next && <Button type="button" size="lg" color="primary" variant="ghost" disabled={locked} onClick={() => { setDirectory(null); setAfter(directory.next!) }}>More forms</Button>}
      </nav>}
    </> : <>
      {error ? <p role="alert" className="text-sm">{error}</p> : <p role="status" className="text-sm">Loading form…</p>}
      <OrganizationFormViewerOffer key={reload} target={target} onAccepted={() => { setError(""); setReload(value => value + 1) }} onLockChange={setLocked} />
    </>}
  </section>
}
