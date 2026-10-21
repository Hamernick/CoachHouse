"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, useReducedMotion } from "motion/react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import MoreIcon from "lucide-react/dist/esm/icons/ellipsis"
import CopyIcon from "lucide-react/dist/esm/icons/copy"
import LockIcon from "lucide-react/dist/esm/icons/lock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { loadWorkspacePageEditorAction } from "../server/actions"
import { usePageEditor } from "../hooks/use-page-editor"
import type { PageEditorData } from "../lib/page-editor"
import type { WorkspacePage } from "../types"
import { SharePageHeader, SHARE_HEADER_BUTTON } from "./share-page-header"
import { SharePageMembers } from "./share-page-members"

const Preview = dynamic(() => import("./public-workspace-page").then((module) => module.PublicWorkspacePage), {
  ssr: false, loading: () => <Skeleton className="m-3 h-64 rounded-3xl motion-reduce:animate-none" />,
})
const MENU_ITEM = "min-h-9 [@media(pointer:coarse)]:min-h-11"

export function WorkspaceSharePanel({ workspaceId, particleId, initialParticleIds, onBack, onDirtyChange }: {
  workspaceId: string; particleId: string; onBack: () => void; onDirtyChange: (dirty: boolean) => void
  initialParticleIds?: string[]
}) {
  const [data, setData] = useState<PageEditorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<{ pageId?: string; key: number }>({ key: 0 })
  const recordSaved = useCallback((page: WorkspacePage) => setData((current) => current ? {
    ...current, pages: [{ id: page.id, title: page.draft.title, visibility: page.visibility, particleIds: page.draft.particleIds },
      ...current.pages.filter((item) => item.id !== page.id)].slice(0, 50),
  } : current), [])
  useEffect(() => {
    let active = true
    setError(null)
    setData(null)
    void loadWorkspacePageEditorAction({ workspaceId, particleId, ...(initialParticleIds?.length ? { initialParticleIds } : {}), ...(request.pageId ? { pageId: request.pageId } : {}) })
      .then((result) => { if (active) { if (result.ok) setData(result.value); else setError(result.error) } })
      .catch(() => { if (active) setError("Unable to load Share. Try again.") })
    return () => { active = false }
  }, [workspaceId, particleId, initialParticleIds, request])
  const back = () => { onDirtyChange(false); onBack() }
  if (data) return <SharePageEditor key={`${data.workspaceId}:${data.page?.id ?? data.suggestedPageId}:${data.page?.revision ?? 0}`}
    data={data} particleId={particleId} onDirtyChange={onDirtyChange} onBack={back} onSaved={recordSaved}
    onChoose={(id) => {
      onDirtyChange(false)
      if (id === "new") setData({ ...data, page: null, suggestedPageId: crypto.randomUUID() })
      else setRequest((value) => ({ pageId: id, key: value.key + 1 }))
    }} />
  return <div className="flex flex-col gap-3 p-3">
    <SharePageHeader onBack={back} />
    {error ? <Alert variant="destructive"><AlertDescription>{error}<Button type="button" variant="outline" size="sm" className="mt-2 w-fit rounded-full" onClick={() => setRequest((value) => ({ ...value, key: value.key + 1 }))}>Retry</Button></AlertDescription></Alert>
      : <div role="status" aria-label="Loading Share" className="flex flex-col gap-3"><Skeleton className="h-9 rounded-xl motion-reduce:animate-none" /><Skeleton className="h-28 rounded-xl motion-reduce:animate-none" /><Skeleton className="h-44 rounded-3xl motion-reduce:animate-none" /></div>}
  </div>
}

export function SharePageEditor({ data, particleId, onBack, onDirtyChange, onChoose, onSaved }: {
  data: PageEditorData; particleId: string; onBack: () => void; onDirtyChange: (dirty: boolean) => void; onChoose: (id: string) => void
  onSaved?: (page: WorkspacePage) => void
}) {
  const editor = usePageEditor({ data, particleId, onDirtyChange, onSaved })
  const { state, dirty, locked } = editor
  const [switchTo, setSwitchTo] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const errorRegion = useRef<HTMLDivElement>(null)
  const region = useRef<HTMLElement>(null)
  const id = useId()
  const reduce = useReducedMotion()
  useEffect(() => { region.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => { if (state.notice) region.current?.focus({ preventScroll: true }) }, [state.notice])
  useWorkspaceEditorStatus({ label: "Shared page", dirty, pending: state.pending || state.uncertain, error: Boolean(state.error) })
  useEffect(() => {
    if (!state.error) return
    const field = state.field ? region.current?.querySelector<HTMLElement>('[aria-invalid="true"]') : null
    ;(field ?? errorRegion.current)?.focus({ preventScroll: true })
  }, [state.error, state.field])
  const choose = (value: string) => { if (locked) return; if (dirty) setSwitchTo(value); else onChoose(value) }
  const currentPage = state.page
  const publicPath = currentPage?.visibility === "public" && currentPage.publishedSnapshot
    ? `/${currentPage.publishedSnapshot.brand.organizationSlug}/${currentPage.linkId}` : null
  async function copyLink() {
    if (!publicPath) return
    try { await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).href); setCopyNotice("Link copied.") }
    catch { setCopyNotice("Copy failed. Open the public page to copy its URL.") }
  }
  return <section {...getReactGrabOwnerProps({ ownerId: `workspace-sharing:${state.pageId}:editor`, component: "WorkspaceSharePanel", source: "src/features/workspace-sharing/components/workspace-share-panel.tsx", slot: "editor" })}
    ref={region} tabIndex={-1} aria-label="Share page" className="nodrag nopan nowheel focus-ring flex min-h-0 min-w-0 flex-col" aria-busy={state.pending}>
    <SharePageHeader dirty={dirty} locked={locked} onBack={onBack} actions={<>
      {state.preview ? <>
        <Button type="button" variant="ghost" className={SHARE_HEADER_BUTTON} disabled={locked} onClick={editor.edit}>Edit</Button>
        <Button type="button" className={SHARE_HEADER_BUTTON} disabled={locked || !data.publishingEnabled} onClick={() => void editor.write("publish")}>{editor.activeAction === "publish" && <LoaderIcon data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden />}{currentPage?.visibility === "public" ? "Update" : "Publish"}</Button>
      </> : <>
        <Button type="submit" form={id} variant="outline" className={SHARE_HEADER_BUTTON} disabled={locked}>{editor.activeAction === "review" && <LoaderIcon data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden />}Preview</Button>
      </>}
      <DropdownMenu key="page-actions"><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Page actions" className="size-7 rounded-full shadow-none [@media(pointer:coarse)]:size-11" disabled={locked}>{editor.activeAction === "save_draft" ? <LoaderIcon className="animate-spin motion-reduce:animate-none" aria-hidden /> : <MoreIcon aria-hidden />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-2xl shadow-none"><DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM} disabled={Boolean(currentPage && !dirty)} onSelect={() => void editor.write("save_draft")}>Save draft</DropdownMenuItem>
        {publicPath && <><DropdownMenuItem className={MENU_ITEM} onSelect={() => void copyLink()}><CopyIcon aria-hidden />Copy link</DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM} onSelect={() => { setCopyNotice(null); void editor.write("make_private") }}><LockIcon aria-hidden />Make Private</DropdownMenuItem></>}
      </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
    </>} />
    <div className="flex flex-col gap-3 p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Field className="min-w-0 flex-1"><FieldLabel htmlFor={`${id}-page`} className="sr-only">Recent pages</FieldLabel><Select value={currentPage?.id ?? "new"} onValueChange={choose} disabled={locked}>
          <SelectTrigger id={`${id}-page`} className="w-full [@media(pointer:coarse)]:min-h-11"><SelectValue placeholder="New page" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="new">New page</SelectItem>
            {currentPage && !data.pages.some((page) => page.id === currentPage.id) && <SelectItem value={currentPage.id}>{currentPage.draft.title || "Untitled page"}</SelectItem>}
            {data.pages.map((page) => <SelectItem key={page.id} value={page.id}>{page.id === currentPage?.id ? currentPage.draft.title || "Untitled page" : page.title || "Untitled page"}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select></Field>
        <Badge variant="outline" className="shrink-0 rounded-full">{currentPage?.visibility === "public" ? "Public" : "Private"}</Badge>
      </div>
      {!data.publishingEnabled && <p className="text-muted-foreground text-xs">Public sharing is unavailable. You can save a private draft.</p>}
      {publicPath && <a href={publicPath} target="_blank" rel="noopener noreferrer" className="focus-ring text-muted-foreground inline-flex min-h-7 w-fit items-center rounded-md text-xs underline underline-offset-4 [@media(pointer:coarse)]:min-h-11">Open public page</a>}
      {copyNotice && <p className="text-muted-foreground text-xs" role="status">{copyNotice}</p>}
      {state.error && <Alert ref={errorRegion} tabIndex={-1} variant="destructive" id={`${id}-error`} className="focus-ring rounded-2xl"><AlertDescription>{state.error}<Button type="button" variant="outline" size="sm" className="mt-2 w-fit rounded-full" disabled={state.pending} onClick={() => state.uncertain ? void editor.retry() : choose(currentPage?.id ?? "new")}>{state.uncertain ? "Retry save" : "Reload saved page"}</Button></AlertDescription></Alert>}
      <p className="sr-only" role="status" aria-live="polite">{state.pending ? "Saving or preparing preview…" : state.notice ?? ""}</p>
    </div>
    <motion.div key={state.preview ? "preview" : "edit"} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.15 }} className="min-w-0">
      {state.preview ? <Preview snapshot={state.preview.snapshot} embedded /> : <form id={id} className="flex min-w-0 flex-col gap-4 px-3 pb-4" onSubmit={(event) => { event.preventDefault(); void editor.review() }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void editor.review() } }}>
        <FieldGroup>
          <Field data-invalid={state.field === "title"}><FieldLabel htmlFor={`${id}-title`} className="sr-only">Page title</FieldLabel><Input id={`${id}-title`} name="page-title" placeholder="Name this page…" value={state.draft.title} disabled={locked} aria-invalid={state.field === "title"} aria-describedby={state.error ? `${id}-error` : undefined} onChange={(event) => editor.update({ ...state.draft, title: event.target.value })} /></Field>
          <Field data-invalid={state.field === "description"}><FieldLabel htmlFor={`${id}-description`} className="sr-only">Description</FieldLabel><Textarea id={`${id}-description`} name="page-description" className="min-h-28" placeholder="Add an introduction…" value={state.draft.description} disabled={locked} aria-invalid={state.field === "description"} aria-describedby={state.error ? `${id}-error` : undefined} onChange={(event) => editor.update({ ...state.draft, description: event.target.value })} /></Field>
        </FieldGroup>
        <SharePageMembers choices={data.choices} selected={state.draft.particleIds} disabled={locked} invalid={state.field === "particleIds"} errorId={state.error ? `${id}-error` : undefined} onToggle={editor.toggle} onMove={editor.move} onReorder={editor.reorder} />
      </form>}
    </motion.div>
    <AlertDialog open={switchTo !== null} onOpenChange={(open) => { if (!open) setSwitchTo(null) }}><AlertDialogContent className="rounded-3xl shadow-none"><AlertDialogHeader><AlertDialogTitle>Discard page changes?</AlertDialogTitle><AlertDialogDescription>Your saved page and current publication will stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-full">Keep editing</AlertDialogCancel><AlertDialogAction className="rounded-full" onClick={() => { const target = switchTo; setSwitchTo(null); if (target) onChoose(target) }}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}
