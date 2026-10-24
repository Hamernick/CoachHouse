"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { requestWorkspaceAcceleratorDrawer } from "@/lib/workspace/data-drawer-events"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import TrashIcon from "lucide-react/dist/esm/icons/trash-2"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty } from "@/components/ui/empty"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { notePreview } from "@/lib/modules/note-content"
import type { NoteDocument } from "../lib/particle-notes"
import { useNoteEditor } from "../hooks/use-note-editor"
import { useNotePages } from "../hooks/use-note-pages"
import { ParticleEditorHeader, PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"
import { NotesList } from "./notes-list"
import { NotesRichEditor } from "./notes-rich-editor"
import { NotesEditorDialogs, type NoteConfirmation } from "./notes-editor-dialogs"
import styles from "./notes-editor.module.css"

export function NotesEditor({ initialNote, organizationId, editable, onClose, onDirtyChange, closeRequestRef }: {
  initialNote: NoteDocument; organizationId: string; editable: boolean; onClose: () => void
  onDirtyChange?: (dirty: boolean) => void
  closeRequestRef?: React.MutableRefObject<(() => void) | null>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<NoteDocument | null>(initialNote)
  const [query, setQuery] = useState("")
  const [showDetail, setShowDetail] = useState(true)
  const [navigating, setNavigating] = useState(false)
  const [confirmation, setConfirmation] = useState<NoteConfirmation>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const continuation = useRef<(() => void) | null>(null)
  const toolbarId = useId()
  const editor = useNoteEditor(selected, organizationId, editable)
  const pages = useNotePages(organizationId, query)
  useWorkspaceEditorStatus({ label: "Notes", dirty: editor.dirty, pending: editor.pending, error: Boolean(editor.error && editor.dirty) })
  useEffect(() => {
    onDirtyChange?.(editor.dirty || editor.pending)
    return () => onDirtyChange?.(false)
  }, [editor.dirty, editor.pending, onDirtyChange])
  const { dirty, pending, save } = editor
  const navigate = useCallback(async (next: () => void) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setNavigating(true)
    const saved = !dirty && !pending || await save()
    setNavigating(false)
    if (saved) { onDirtyChange?.(false); next() }
    else { continuation.current = next; setConfirmation("discard") }
  }, [dirty, pending, save, onDirtyChange])
  useEffect(() => {
    if (!closeRequestRef) return
    closeRequestRef.current = () => void navigate(onClose)
    return () => { closeRequestRef.current = null }
  }, [closeRequestRef, navigate, onClose])
  const title = editor.detail ? notePreview(editor.draft.content).title : selected?.title ?? "Notes"
  const list = selected && editor.detail && !query ? {
    ...pages,
    notes: pages.notes.some((note) => note.id === selected.id)
      ? pages.notes.map((note) => note.id === selected.id ? { ...note, ...notePreview(editor.draft.content), updatedAt: editor.detail!.updatedAt ?? note.updatedAt } : note)
      : [{ ...selected, ...notePreview(editor.draft.content), updatedAt: editor.detail.updatedAt ?? selected.updatedAt }, ...pages.notes],
  } : pages
  return <section aria-label="Notes editor" className={cn("nodrag nopan nowheel", styles.root)}>
    <ParticleEditorHeader title="Notes" actions={<Button variant="ghost" size="icon" className={PARTICLE_EDITOR_HEADER_ACTION} aria-label="Close notes" disabled={navigating} onClick={() => void navigate(onClose)}><XIcon aria-hidden /></Button>} />
    <div className={styles.toolbar}>
      <Button variant="ghost" size="icon" className={cn(PARTICLE_EDITOR_HEADER_ACTION, styles.back)} aria-label="Back to notes" onClick={() => void navigate(() => setShowDetail(false))}><ArrowLeftIcon aria-hidden /></Button>
      <Input type="search" aria-label="Search notes" placeholder="Search notes…" value={query} onChange={(event) => { setQuery(event.target.value); setShowDetail(false) }} className={cn("h-9 rounded-full bg-muted/40 shadow-none md:h-8", styles.search)} />
      <div id={toolbarId} className={styles.formatting} />
      <Button variant="ghost" size="icon" className={PARTICLE_EDITOR_HEADER_ACTION} aria-label="Delete note" data-note-edit-control disabled={!editor.detail || !editor.canEdit || editor.pending || navigating} onClick={(event) => { returnFocusRef.current = event.currentTarget; setConfirmation("delete") }}><TrashIcon aria-hidden /></Button>
    </div>
    <div className={styles.layout} data-detail={showDetail && Boolean(selected)}>
      <aside className={styles.list}>
        <NotesList pages={list} selectedId={selected?.id} busy={navigating} onSelect={(note) => {
          if (note.id === selected?.id) { setShowDetail(true); return }
          void navigate(() => { setSelected(note); setShowDetail(true) })
        }} />
      </aside>
      <div className={styles.detail}>
        {!selected ? <Empty title="Select a note" size="sm" className="border-0 bg-transparent shadow-none" /> : editor.detail ? <>
          <div className="flex flex-col items-center gap-1 px-4 pt-3 pb-1">
            <div className="text-muted-foreground flex max-w-full flex-wrap items-center justify-center gap-x-1.5 text-center text-xs">
              {editor.detail.updatedAt && <time className="tabular-nums" dateTime={editor.detail.updatedAt} aria-label="Last edited">{new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(editor.detail.updatedAt))}</time>}
              {editor.detail.lesson && <>
                {editor.detail.updatedAt && <span aria-hidden>•</span>}
                <Link href={editor.detail.lesson.href} className="focus-ring min-w-0 max-w-full rounded-sm py-1 underline decoration-border underline-offset-2 hover:text-foreground hover:decoration-current [@media(pointer:coarse)]:py-3" aria-label={`Open Accelerator lesson: ${editor.detail.lesson.title}`} onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  const lesson = editor.detail?.lesson
                  if (lesson && !navigating) void navigate(() => {
                    if (requestWorkspaceAcceleratorDrawer(lesson.moduleId)) onClose()
                    else if (window.location.pathname === "/workspace") toast.error("This lesson is not available in this workspace.")
                    else router.push(lesson.href)
                  })
                }}><span className="line-clamp-1 break-all">{editor.detail.lesson.title}</span></Link>
              </>}
            </div>
            <span role="status" className="text-muted-foreground min-h-4 text-xs">{editor.pending ? "Saving…" : editor.dirty ? "Unsaved changes" : "Saved"}</span>
          </div>
          <NotesRichEditor key={`${selected.id}:${editor.generation}`} initialBody={editor.initialBody} onChange={editor.update} toolbarId={toolbarId} readOnly={!editor.canEdit} />
        </> : !editor.error ? <div role="status" aria-label="Loading note" className="flex flex-col gap-3 p-5"><Skeleton className="mx-auto h-4 w-48" /><Skeleton className="mt-5 h-6 w-2/3" /><Skeleton className="h-4 w-full" /></div> : null}
        {editor.error && <div role="alert" className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-card p-3 text-sm">
          <p className="w-full text-destructive">{editor.error}</p>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void (editor.detail ? editor.save() : editor.reload())}>Retry</Button>
          {editor.detail && <><Button variant="ghost" size="sm" className="rounded-full" onClick={() => void navigator.clipboard.writeText(editor.draft.content).catch(() => toast.error("Unable to copy. Select and copy the note text."))}>Copy draft</Button><Button variant="ghost" size="sm" className="rounded-full" onClick={(event) => { returnFocusRef.current = event.currentTarget; setConfirmation("reload") }}>Load latest</Button></>}
        </div>}
      </div>
    </div>
    <span className="sr-only" aria-live="polite">{title}</span>
    <NotesEditorDialogs returnFocusRef={returnFocusRef} confirmation={confirmation} pending={editor.pending} personal={selected?.source.kind === "module_note"} error={editor.error} onCancel={() => setConfirmation(null)} onConfirm={() => {
      if (confirmation === "delete") {
        void editor.remove().then((removed) => {
          if (!removed) return
          setConfirmation(null)
          onDirtyChange?.(false)
          setSelected(pages.notes.find((note) => note.id !== selected?.id) ?? null)
          pages.reload()
        })
      } else if (confirmation === "reload") { setConfirmation(null); void editor.reload() }
      else { setConfirmation(null); onDirtyChange?.(false); continuation.current?.(); continuation.current = null }
    }} />
  </section>
}
