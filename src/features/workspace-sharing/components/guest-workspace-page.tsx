"use client"

import { useEffect, useId, useState } from "react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { usePageAccess, type PageAccessController } from "../hooks/use-page-access"
import type { PageAccessData } from "../lib/page-access"
import { PageAccessFeedback, PageInvitationControls } from "./page-access-manager"
import { GuestPageNoteEditor } from "./guest-page-note-editor"
import { PublicWorkspacePage } from "./public-workspace-page"

export function GuestWorkspacePage({ pageId, invitationId }: { pageId: string; invitationId?: string }) {
  const access = usePageAccess(pageId)
  const [accepted, setAccepted] = useState(false)
  const [sourceLocked,setSourceLocked]=useState(false),[detailsDirty,setDetailsDirty]=useState(false)
  const returnPath = `/public/pages/${pageId}${invitationId ? `?invite=${invitationId}` : ""}`
  return <main className="mx-auto flex min-h-svh w-full max-w-[46rem] flex-col gap-6 px-4 py-8 sm:px-6">
    <h1 className="text-lg font-semibold">Shared page</h1>
    {access.signIn ? <div className="flex flex-col items-start gap-3"><p className="text-sm">Sign in with the invited account.</p><Button asChild><a href={`/login?redirect=${encodeURIComponent(returnPath)}`}>Sign in</a></Button></div> : <>
      {invitationId && !accepted && <Button type="button" className="min-h-11 w-fit rounded-xl" disabled={access.locked} onClick={() => {
        void access.send({ action: "accept", pageId, invitationId }).then((ok) => { if (ok) setAccepted(true) })
      }}>{access.pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}Accept invitation</Button>}
      <PageAccessFeedback access={access} hideReload={Boolean(access.data?.draft)} />
      {access.pending && !access.data && <p role="status" className="text-muted-foreground text-sm">Loading shared page…</p>}
      {access.data && <>
        {access.data.draft && <GuestPageDetails key={`${access.readVersion}:${access.editVersion}`} data={access.data} access={access} disabled={sourceLocked} onDirtyChange={setDetailsDirty} />}
        {access.data.permission !== "view" && <GuestPageNoteEditor key={pageId} pageId={pageId} disabled={access.locked || detailsDirty} onLockChange={setSourceLocked} />}
        <PublicWorkspacePage snapshot={access.data.snapshot} imageAudience="guest" embedded interactiveForms />
        {access.data.permission === "manage" && <fieldset disabled={sourceLocked || detailsDirty}><PageInvitationControls access={access} data={access.data} /></fieldset>}
      </>}
    </>}
  </main>
}
function GuestPageDetails({ data, access, disabled, onDirtyChange }: { data: PageAccessData; access: PageAccessController; disabled: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const id = useId()
  // Access updates may include another editor's newer revision. Keep this
  // draft's original base until an explicit reload or our own edit succeeds.
  const [baseline] = useState({ ...data.draft, revision: data.revision })
  const [title, setTitle] = useState(data.draft?.title ?? "")
  const [description, setDescription] = useState(data.draft?.description ?? "")
  const dirty = title !== baseline.title || description !== baseline.description
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  return <form aria-label="Edit shared page details" className="flex flex-col gap-4 rounded-2xl border p-4" onSubmit={(event) => {
    event.preventDefault()
    if (access.locked || disabled) return
    void access.send({ action: "edit", pageId: data.pageId, operationId: crypto.randomUUID(), expectedRevision: baseline.revision, title, description })
  }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.requestSubmit() } }}>
    <h2 className="text-sm font-medium">Page details</h2>
    <Field><FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel><Input id={`${id}-title`} name="title" autoComplete="off" maxLength={240} className="min-h-11 text-base" value={title} disabled={access.locked || disabled} onChange={(event) => setTitle(event.target.value)} /></Field>
    <Field><FieldLabel htmlFor={`${id}-description`}>Introduction</FieldLabel><Textarea id={`${id}-description`} name="description" autoComplete="off" maxLength={2000} className="min-h-28 text-base" value={description} disabled={access.locked || disabled} onChange={(event) => setDescription(event.target.value)} /></Field>
    <p className="text-muted-foreground text-xs">Saved changes stay private until an organization editor reviews and shares them.</p>
    <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11 rounded-xl" disabled={access.locked || disabled}>{access.pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}Save details</Button>
      <AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={access.locked || disabled}>Reload</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reload saved details?</AlertDialogTitle><AlertDialogDescription>Unsaved changes will be discarded.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => void access.reload()}>Reload</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
    <p className="text-muted-foreground text-xs" role="status">{dirty ? "Unsaved changes" : "Saved details"}</p>
  </form>
}
