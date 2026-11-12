"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CircleNotch, FolderPlus, UploadSimple } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { loadProjectAssetFolders, mutateProjectAssetFolder } from "../../project-workflow-actions"
import { applyFolderMutation, type FolderFile, type FolderMutation, type ProjectAssetFolder } from "../../lib/project-asset-folders"
import { createProjectAssets } from "./project-assets-api"
import { ProjectFolderAccessDialog } from "./project-folder-access-dialog"
import { ProjectAssetFolderGrid } from "./project-asset-folder-grid"
import { ProjectFolderDocumentEditor } from "./project-folder-document-editor"
import { getMemberWorkspaceProjectFiscalDocuments } from "./member-workspace-project-fiscal-documents"
import type { FiscalSponsorshipProjectWorkflowSummary } from "@/features/fiscal-sponsorship"

type Library = Extract<Awaited<ReturnType<typeof loadProjectAssetFolders>>, { state: unknown }>

type Props = { actionScope?: "workspace" | "platform"; projectId: string; workflowSummary?: FiscalSponsorshipProjectWorkflowSummary | null }
export function ProjectAssetFolders(props: Props) {
  return <ProjectAssetFoldersSession key={`${props.projectId}:${props.actionScope ?? "workspace"}`} {...props} />
}
function ProjectAssetFoldersSession({ projectId, workflowSummary, actionScope = "workspace" }: Props) {
  const [access, setAccess] = useState<{ folderId: string; trigger: HTMLButtonElement } | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const epoch = useRef(0), readVersion = useRef(0), active = useRef(false)
  const [data, setData] = useState<Library | null>(null)
  const authorized = useRef<Library | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [documentFile, setDocumentFile] = useState<FolderFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [failedUpload, setFailedUpload] = useState<{ files: File[]; destination: string | null } | null>(null)
  const pending = useRef(false)
  const surface = useRef<HTMLDivElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<ProjectAssetFolder | "new" | null>(null)
  const [name, setName] = useState("")
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ProjectAssetFolder | null>(null)
  const load = useCallback(async () => {
    const version = ++readVersion.current, generation = epoch.current
    const current = () => active.current && version === readVersion.current && generation === epoch.current
    try {
      const result = await loadProjectAssetFolders(projectId, actionScope)
      if (!current()) return
      if ("error" in result) throw new Error(result.error)
      const prior = authorized.current
      if (prior && ((prior.canEdit && !result.canEdit) || (prior.canUpload && !result.canUpload)
        || prior.files.some(file => !result.files.some(item => item.key === file.key))
        || prior.state.folders.some(folder => !result.state.folders.some(item => item.id === folder.id)))) epoch.current += 1
      authorized.current = result
      setEditing(value => value === "new" || (value && result.state.folders.some(folder => folder.id === value.id)) ? value : null)
      setRemoving(value => value && result.state.folders.some(folder => folder.id === value.id) ? value : null)
      setOrganizationId(result.organizationId)
      setDocumentFile(file => file && result.organizationDocuments ? result.files.find(item => item.key === file.key) ?? null : null)
      setData(result)
      setError(null)
    } catch (cause) {
      if (!current()) return
      epoch.current += 1
      authorized.current = null
      setData(null)
      setDocumentFile(null)
      setEditing(null)
      setRemoving(null)
      setFailedUpload(null)
      setError(cause instanceof Error ? cause.message : "Unable to load folders.")
    }
  }, [projectId, actionScope])
  const accessChanged = useCallback(() => {
    epoch.current += 1
    authorized.current = null
    setDocumentFile(null)
    setData(null)
    setError(null)
    setEditing(null)
    setRemoving(null)
    setFailedUpload(null)
    if (document.visibilityState !== "hidden") void load()
  }, [load])
  useEffect(() => {
    active.current = true
    void load()
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load()
    }
    window.addEventListener("focus", refresh)
    window.addEventListener("online", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      active.current = false
      epoch.current += 1
      window.removeEventListener("focus", refresh)
      window.removeEventListener("online", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [load])
  useEffect(() => organizationId ? subscribeWorkspaceAccessChanged(organizationId, accessChanged) : undefined, [organizationId, accessChanged])

  const mutate = async (change: FolderMutation) => {
    if (pending.current) return false
    pending.current = true
    const generation = epoch.current
    const current = () => active.current && generation === epoch.current
    setBusy(true)
    setDialogError(null)
    const previousState = data?.state
    try {
      if (change.type === "move" && previousState) {
        const optimistic = applyFolderMutation(previousState, change, "")
        setData((current) => current ? { ...current, state: optimistic } : current)
      }
      const result = await mutateProjectAssetFolder(projectId, change, actionScope)
      if (!current()) return false
      if ("error" in result) throw new Error(result.error)
      // A successful move may change which files this actor can still see.
      await load()
      if (!current()) return false
      toast.success(change.type === "move" ? "File moved" : change.type === "remove" ? "Folder deleted; files kept" : "Folder saved")
      return true
    } catch (cause) {
      if (!current()) return false
      if (change.type === "move" && previousState) setData((current) => current ? { ...current, state: previousState } : current)
      const message = cause instanceof Error ? cause.message : "Unable to save folders."
      setDialogError(message)
      toast.error(message)
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const upload = async (files: File[], destination: string | null = folderId) => {
    if (!files.length || pending.current) return
    pending.current = true
    const generation = epoch.current
    const current = () => active.current && generation === epoch.current
    setBusy(true)
    setFailedUpload(null)
    let uploaded = false
    try {
      const result = await createProjectAssets({ projectId, files })
      if (!current()) return
      uploaded = true
      let moveFailed = false
      if (destination) {
        for (const asset of result.assets) {
          const moved = await mutateProjectAssetFolder(projectId, { type: "move", fileKey: `project:${asset.id}`, folderId: destination }, actionScope)
          if (!current()) return
          if ("error" in moved) moveFailed = true
        }
      }
      if (moveFailed) {
        setFolderId(null)
        toast.error("Files uploaded, but some could not be moved. They are available under All files.")
      } else toast.success("Files uploaded")
      await load()
    } catch (cause) {
      if (!current()) return
      if (uploaded) {
        setFolderId(null)
        toast.error("Files uploaded, but folder organization failed. Find them under All files and try moving them again.")
        await load()
      } else {
        setFailedUpload({ files, destination })
        toast.error(cause instanceof Error ? cause.message : "Unable to upload files.")
        await load()
      }
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const openFile = async (file: FolderFile) => {
    if (["core", "policy", "upload"].includes(file.source)) { setDocumentFile(file); return }
    if (!file.url) { toast.error("This document is currently unavailable."); return }
    const direct = file.source !== "organization"
    const tab = window.open(direct ? file.url : "about:blank", "_blank")
    if (tab) tab.opener = null
    if (direct) { if (!tab) toast.error("Allow pop-ups to open this file."); return }
    const generation = epoch.current
    try {
      const response = await fetch(file.url)
      const payload = await response.json()
      if (!active.current || generation !== epoch.current) { tab?.close(); return }
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to open file.")
      if (tab) tab.location.href = payload.url
      else toast.error("Allow pop-ups to open this file.")
    } catch (cause) {
      tab?.close()
      if (!active.current || generation !== epoch.current) return
      toast.error(cause instanceof Error ? cause.message : "Unable to open file.")
    }
  }

  const accessDialog = access && organizationId ? <ProjectFolderAccessDialog key={`${projectId}:${access.folderId}`} orgId={organizationId} target={{ projectId, folderId: access.folderId, actionScope }} returnFocus={access.trigger} fallbackFocus={surface.current} onClose={() => setAccess(null)} /> : null
  if (!data) return <div ref={surface} tabIndex={-1}>{accessDialog}<div role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error ?? "Loading files and folders…"}{error ? <Button variant="outline" onClick={() => void load()}>Retry</Button> : null}</div></div>
  const currentFolder = data.state.folders.find((folder) => folder.id === folderId)
  const activeFolderId = currentFolder?.id ?? null
  const signedDocuments = getMemberWorkspaceProjectFiscalDocuments(workflowSummary)
  const signedAssetIds = new Set(signedDocuments.map((document) => document.assetId))
  const files: FolderFile[] = [
    ...data.files.filter((file) => file.source !== "project" || !signedAssetIds.has(file.key.slice("project:".length))),
    ...signedDocuments.map((document) => ({ key: `fiscal:${document.id}`, name: document.title, source: "fiscal" as const, url: document.viewHref ?? document.downloadHref ?? "", downloadUrl: document.downloadHref ?? undefined })),
  ]
  const edit = (folder: ProjectAssetFolder | "new") => { setEditing(folder); setName(folder === "new" ? "" : folder.name); setDialogError(null) }
  return (
    <div ref={surface} tabIndex={-1}>{accessDialog}<section aria-label="Documents, files and folders" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Documents and files</h2>
        {data.canUpload ? <div className="flex flex-wrap gap-2">
          {data.canEdit && !currentFolder ? <Button variant="outline" size="sm" disabled={busy} onClick={() => edit("new")}><FolderPlus />New folder</Button> : null}
          <Button variant="outline" size="sm" disabled={busy} onClick={() => uploadInput.current?.click()}><UploadSimple />Upload files</Button>
          <Input ref={uploadInput} type="file" multiple className="hidden" aria-label="Upload files" onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = "" }} />
        </div> : null}
      </div>
      {failedUpload ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        <span>Upload incomplete. Retry the same files to finish safely.</span>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void upload(failedUpload.files, failedUpload.destination)}>Retry upload</Button>
      </div> : null}
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 truncate text-sm font-medium">{currentFolder?.name ?? "All files"}</span>
        <Input type="search" aria-label="Search documents, files and folders" placeholder="Search documents, files and folders" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full sm:ml-auto sm:max-w-xs" />
      </div>
      {busy ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><CircleNotch className="size-4 motion-safe:animate-spin" />Saving…</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error} <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button></p> : null}
      <ProjectAssetFolderGrid state={data.state} files={files} folderId={activeFolderId} query={query} canEdit={data.canEdit} busy={busy} onAccess={data.canReviewAccess ? (folder, trigger) => setAccess({ folderId: folder.id, trigger }) : undefined} onOpenFolder={(id) => { setFolderId(id); setQuery("") }} onRename={edit} onRemove={(folder) => { setRemoving(folder); setDialogError(null) }} onMove={(file, id) => { void mutate({ type: "move", fileKey: file.key, folderId: id }) }} onUpload={(files, destination) => { void upload(files, destination) }} onOpenFile={(file) => { void openFile(file) }} />
      {documentFile && data.organizationDocuments ? <ProjectFolderDocumentEditor key={documentFile.key} file={documentFile} documents={data.organizationDocuments} organizationId={data.organizationId} onClose={() => setDocumentFile(null)} onSaved={() => { void load() }} onOpen={(url) => openFile({ key: "document", name: documentFile.name, source: "organization", url })} /> : null}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !busy) setEditing(null) }}>
        <DialogContent><DialogHeader><DialogTitle>{editing === "new" ? "New folder" : "Rename folder"}</DialogTitle><DialogDescription>Organize files within this project.</DialogDescription></DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={async (event) => {
            event.preventDefault()
            if (!editing) return
            if (await mutate(editing === "new" ? { type: "create", name: name.trim() } : { type: "rename", folderId: editing.id, name: name.trim() })) { setEditing(null); setFolderId(null); setQuery("") }
          }}>
            <Field><FieldLabel htmlFor="asset-folder-name">Folder name</FieldLabel><Input id="asset-folder-name" value={name} maxLength={80} disabled={busy} onChange={(event) => setName(event.target.value)} autoFocus /></Field>
            {dialogError ? <p role="alert" className="text-sm text-destructive">{dialogError}</p> : null}
            <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : editing === "new" ? "Create folder" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => { if (!open && !busy) setRemoving(null) }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {removing?.name}?</AlertDialogTitle><AlertDialogDescription>Files inside this folder will return to All files. No files will be deleted.</AlertDialogDescription></AlertDialogHeader>
          {dialogError ? <p role="alert" className="text-sm text-destructive">{dialogError}</p> : null}
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async (event) => { event.preventDefault(); if (removing && await mutate({ type: "remove", folderId: removing.id })) setRemoving(null) }}>{busy ? "Deleting…" : "Delete folder"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section></div>
  )
}
