"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { displayChoiceAnswer } from "../lib/form-other-answer"
import { displayGridAnswer } from "../lib/form-grid-answers"
import { formResponsePageSchema, formResponseSchema } from "../lib"
import type { FormAnswer, FormResponse, FormResponsePage, FormIntakeCommand, FormSnapshotQuestion } from "../lib"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"
import { OrganizationFormResponseExport } from "./organization-form-response-export"
import { OrganizationFormResponseDelete } from "./organization-form-response-delete"
import { OrganizationFormReviewAccess } from "./organization-form-review-access"
import { OrganizationFormAnswerField } from "./organization-form-answer-field"
import { OrganizationFormResponseLink } from "./organization-form-response-link"

import { OrganizationFormResponseVersions } from "./organization-form-response-versions"
import { OrganizationFormResponseDirectory } from "./organization-form-response-directory"
import { OrganizationFormSourceEditor } from "./organization-form-source-editor"
import { OrganizationFormViewerInvitations } from "./organization-form-viewer-invitations"
import { OrganizationFormViewerOffer } from "./organization-form-viewer-offer"

function display(question: FormSnapshotQuestion, value: FormAnswer["value"] | undefined) {
  if (value === undefined) return "No answer"
  if ((question.type === "multiple_choice_grid" || question.type === "checkbox_grid") && typeof value === "object" && !Array.isArray(value)) return displayGridAnswer(question, value)
  if ("options" in question) return displayChoiceAnswer(question, value)
  return String(value)
}
const ResponseSavedViews = dynamic(() => import("@/features/workspace-data-views").then(module => module.ResponseSavedViews), { ssr: false })

export function OrganizationFormResponses({ versionId, onLockChange, standalone = false }: { versionId: string; onLockChange?: (locked: boolean) => void; standalone?: boolean }) {
  const refreshButton = useRef<HTMLButtonElement>(null); const deleteTriggers = useRef(new Map<string, HTMLButtonElement>())
  const [tableOpen, setTableOpen] = useState(false)
  const [tableDirty, setTableDirty] = useState(false)
  const [notice, setNotice] = useState("")
  const [exporting, setExporting] = useState(false)
  const [sourceEditing, setSourceEditing] = useState(false)
  const sourceTrigger = useRef<HTMLButtonElement>(null); const sourceWasOpen = useRef(false)
  useEffect(() => {
    if (!sourceEditing && sourceWasOpen.current) sourceTrigger.current?.focus()
    sourceWasOpen.current = sourceEditing
  }, [sourceEditing])
  const [data, setData] = useState<FormResponsePage | null>(null)
  const [before, setBefore] = useState<string | undefined>()
  const [denied, setDenied] = useState(false)
  const [accessLocked, setAccessLocked] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => { onLockChange?.(Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty); return () => onLockChange?.(false) }, [editing, accessLocked, sourceEditing, exporting, tableDirty, onLockChange])
  useEffect(() => {
    if (!editing) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [editing])
  useEffect(() => {
    if (editing || accessLocked || sourceEditing || exporting) return
    let active = true; let inFlight = false
    async function load() {
      if (inFlight || document.visibilityState === "hidden") return
      inFlight = true
      try {
        const next = formResponsePageSchema.parse(await sendFormCommand({ action: "responses", versionId, ...(before ? { before } : {}) }))
        if (active) { setData(next); setError(""); setDenied(false) }
      } catch (failure) {
        if (active) {
          setError(failure instanceof IntakeRequestError ? failure.message : "Unable to load responses.")
          if (failure instanceof IntakeRequestError && [401, 403].includes(failure.status)) { setData(null); setDenied(failure.status === 403) }
        }
      } finally { inFlight = false; if (active) setLoading(false) }
    }
    void load()
    const timer = before ? undefined : setInterval(() => void load(), 5000)
    const visible = () => { if (!before) void load() }
    document.addEventListener("visibilitychange", visible)
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
  }, [versionId, before, editing, refresh, accessLocked, sourceEditing, exporting])
  const versionsDenied = useCallback((message: string) => { setData(null); setError(message) }, [])
  const saved = useCallback((response: FormResponse) => {
    setData((current) => current ? { ...current, responses: current.responses.map((row) => row.id === response.id ? response : row) } : current)
    setEditing(null)
  }, [])
  if (sourceEditing && data) return <OrganizationFormSourceEditor versionId={versionId} formId={data.version.formId} onClose={() => { setSourceEditing(false); setRefresh((value) => value + 1) }} />
  return <section aria-label="Form responses" className="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      {standalone ? <h1 className="min-w-0 break-words text-lg font-medium [overflow-wrap:anywhere]">{data?.version.title ?? "Form responses"}</h1> : <h3 className="text-sm font-medium">Responses</h3>}
      <Button size="lg" color="primary" ref={refreshButton} type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} onClick={() => { setBefore(undefined); setRefresh((value) => value + 1) }}>Refresh</Button></header>
    {data && <OrganizationFormResponseExport key={`${versionId}:${before ?? "latest"}`} versionId={versionId} before={before}
      disabled={Boolean(editing) || accessLocked || sourceEditing || loading || exporting || tableDirty} onPending={setExporting}
      onDenied={(message) => { setData(null); setError(message); setDenied(true); setExporting(false) }} />}
    {standalone && data?.permissions.canEditDefinition && <Button size="lg" color="primary" ref={sourceTrigger} type="button" variant="outline" className="min-h-11 rounded-xl" disabled={Boolean(editing) || accessLocked || exporting || tableDirty} onClick={() => setSourceEditing(true)}>Edit form</Button>}
    {data && <OrganizationFormResponseLink key={versionId} versionId={versionId} disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} />}
    {standalone && data && <p className="text-muted-foreground text-xs">Version {data.version.revision}</p>}
    {standalone && data && <OrganizationFormResponseVersions key={`versions:${versionId}`} versionId={versionId} disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} onDenied={versionsDenied} />}
    {standalone && data && <OrganizationFormResponseDirectory key={`forms:${versionId}`} versionId={versionId} formId={data.version.formId} disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} onDenied={versionsDenied} />}
    <p className="text-muted-foreground text-xs">Private responses. New submissions appear within five seconds.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {standalone && (denied || data?.permissions.hasPendingInvitation) && <OrganizationFormViewerOffer key={`${versionId}:${refresh}`} versionId={versionId} onLockChange={setAccessLocked}
      onAccepted={() => { setDenied(false); setRefresh((value) => value + 1) }} />}
    {loading && <p role="status" className="text-muted-foreground text-sm">Loading responses…</p>}
    {data && <p className="text-muted-foreground text-xs">{data.permissions.canCorrect ? "You can correct answers." : "Read-only access."}</p>}
    {data?.permissions.canManageAccess && <OrganizationFormReviewAccess canManageInvitations={data.permissions.canManageInvitations} target={{ versionId }} disabled={Boolean(editing) || exporting || tableDirty} onLockChange={setAccessLocked} />}
    {data?.permissions.canManageInvitations && !data.permissions.canManageAccess && <OrganizationFormViewerInvitations versionId={versionId} disabled={Boolean(editing) || exporting || tableDirty} onLockChange={setAccessLocked} onRevisionChange={() => setRefresh((value) => value + 1)} />}
    {data && <Button size="lg" color="primary" variant="outline" disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} onClick={() => setTableOpen(value => !value)}>{tableOpen ? "Close saved table views" : "Saved table views"}</Button>}
    {data && tableOpen && <ResponseSavedViews versionId={versionId} onDirtyChange={setTableDirty} />}
    {data && !data.responses.length && <p className="text-muted-foreground text-sm">No responses yet.</p>}
    {data?.responses.map((response) => editing === `delete:${response.id}` ? <OrganizationFormResponseDelete key={response.id} response={response}
      onCancel={() => { setEditing(null); requestAnimationFrame(() => deleteTriggers.current.get(response.id)?.focus()) }}
      onConflict={() => { setData(null); setEditing(null); setRefresh((value) => value + 1); requestAnimationFrame(() => refreshButton.current?.focus()) }}
      onDenied={(message) => { setData(null); setEditing(null); setError(message); setDenied(true); requestAnimationFrame(() => refreshButton.current?.focus()) }}
      onDeleted={() => { setData((current) => current ? { ...current, responses: current.responses.filter((row) => row.id !== response.id) } : current); setEditing(null); setNotice("Response deleted."); requestAnimationFrame(() => refreshButton.current?.focus()) }}
    /> : <article key={response.id} className="flex min-w-0 flex-col gap-3 border-t pt-4">
      <p className="text-muted-foreground text-xs"><time dateTime={response.submittedAt}>{new Date(response.submittedAt).toLocaleString()}</time></p>
      {data.permissions.canDelete && <Button size="lg" color="primary" ref={(node) => { if (node) deleteTriggers.current.set(response.id, node); else deleteTriggers.current.delete(response.id) }} type="button" variant="ghost" className="min-h-11 self-end rounded-xl text-destructive"
        disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} onClick={() => { setNotice(""); setEditing(`delete:${response.id}`) }}>Delete response</Button>}
      {data.version.definition.questions.map((question) => {
        const key = `${response.id}:${question.id}`
        const value = response.answers.find((answer) => answer.questionId === question.id)?.value
        return editing === key ? <ResponseCellEditor key={key} response={response} question={question} value={value}
          onSaved={saved} onCancel={() => setEditing(null)} /> : <div key={key} className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground break-words text-xs">{question.label}</p>
          {data.permissions.canCorrect ? <Button size="lg" color="primary" type="button" variant="ghost" disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} aria-label={`Edit ${question.label}`}
            className="h-auto min-h-11 w-full justify-start whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-left font-normal [overflow-wrap:anywhere]"
            onClick={() => setEditing(key)}>{display(question, value)}</Button> : <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{display(question, value)}</p>}
        </div>
      })}
    </article>)}
    {data?.next && <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={Boolean(editing) || accessLocked || sourceEditing || exporting || tableDirty} onClick={() => { setBefore(data.next ?? undefined); setLoading(true) }}>Older responses</Button>}
  </section>
}
function ResponseCellEditor({ response, question, value: initial, onSaved, onCancel }: {
  response: FormResponse; question: FormSnapshotQuestion; value?: FormAnswer["value"];
  onSaved: (response: FormResponse) => void; onCancel: () => void
}) {
  const id = useId(); const busy = useRef(false)
  const [value, setValue] = useState<FormAnswer["value"]>(initial ?? "")
  const [pending, setPending] = useState(false); const [error, setError] = useState("")
  const [baseline, setBaseline] = useState(response.revision)
  const [conflict, setConflict] = useState(false)
  async function reload() {
    if (busy.current) return
    busy.current = true; setPending(true)
    try {
      const current = formResponseSchema.parse(await sendFormCommand({ action: "response", versionId: response.versionId, id: response.id }))
      setBaseline(current.revision); setConflict(false)
      setError(`Saved answer: ${display(question, current.answers.find((answer) => answer.questionId === question.id)?.value)}. Your edit is preserved. Review before saving.`)
    } catch { setError("Unable to reload. Your edit is preserved.") }
    finally { busy.current = false; setPending(false) }
  }
  const [retry, setRetry] = useState<FormIntakeCommand | null>(null)
  async function save() {
    if (busy.current) return
    const command: FormIntakeCommand = retry ?? { action: "correct", versionId: response.versionId, id: response.id,
      operationId: crypto.randomUUID(), expectedRevision: baseline, questionId: question.id, value }
    busy.current = true; setPending(true); setError("")
    try {
      const saved = formResponseSchema.parse(await sendFormCommand(command))
      if (saved.id !== response.id || saved.versionId !== response.versionId) throw new Error("Invalid response")
      onSaved(saved)
    }
    catch (failure) {
      const uncertain = !(failure instanceof IntakeRequestError) || failure.uncertain
      setConflict(failure instanceof IntakeRequestError && failure.status === 409)
      setRetry(uncertain ? command : null)
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry the same request.")
    } finally { busy.current = false; setPending(false) }
  }
  return <div className="flex flex-col gap-3 rounded-xl border p-3">
    <fieldset disabled={pending || Boolean(retry)} className="min-w-0"><legend className="sr-only">Correct answer</legend>
      <OrganizationFormAnswerField id={id} question={question} value={value} onChange={(_, next) => setValue(next)} error={error || undefined} />
    </fieldset>
    <div className="flex flex-wrap gap-2"><Button size="lg" color="primary" type="button" className="min-h-11 rounded-xl" disabled={pending || conflict} onClick={() => void save()}>{pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}{retry ? "Retry save" : "Save"}</Button>
      {conflict && <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={pending} onClick={() => void reload()}>Reload saved answer</Button>}
      <Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={pending || Boolean(retry)} onClick={onCancel}>Cancel</Button></div>
  </div>
}
