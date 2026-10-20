"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CircleNotch, FolderPlus, UploadSimple } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { loadProjectAssetFolders, mutateProjectAssetFolder } from "../../project-workflow-actions"
import { applyFolderMutation, type FolderFile, type FolderMutation, type ProjectAssetFolder } from "../../lib/project-asset-folders"
import { createProjectAssets } from "./project-assets-api"
import { ProjectAssetFolderGrid } from "./project-asset-folder-grid"
import { ProjectFolderDocumentEditor } from "./project-folder-document-editor"
import { getMemberWorkspaceProjectFiscalDocuments } from "./member-workspace-project-fiscal-documents"
import type { FiscalSponsorshipProjectWorkflowSummary } from "@/features/fiscal-sponsorship"

type Library = Extract<Awaited<ReturnType<typeof loadProjectAssetFolders>>, { state: unknown }>

export function ProjectAssetFolders({ projectId, workflowSummary, actionScope = "workspace" }: { actionScope?: "workspace" | "platform"; projectId: string; workflowSummary?: FiscalSponsorshipProjectWorkflowSummary | null }) {
  const [data, setData] = useState<Library | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [documentFile, setDocumentFile] = useState<FolderFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [failedUpload, setFailedUpload] = useState<{ files: File[]; destination: string | null } | null>(null)
  const pending = useRef(false)
  const uploadInput = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<ProjectAssetFolder | "new" | null>(null)
  const [name, setName] = useState("")
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ProjectAssetFolder | null>(null)
  const load = useCallback(async () => {
    try {
      const result = await loadProjectAssetFolders(projectId, actionScope)
      if ("error" in result) throw new Error(result.error)
      setData(result)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load folders.")
    }
  }, [projectId, actionScope])
  useEffect(() => { void load() }, [load])

  const mutate = async (change: FolderMutation) => {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setDialogError(null)
    const previousState = data?.state
    try {
      if (change.type === "move" && previousState) {
        const optimistic = applyFolderMutation(previousState, change, "")
        setData((current) => current ? { ...current, state: optimistic } : current)
      }
      const result = await mutateProjectAssetFolder(projectId, change, actionScope)
      if ("error" in result) throw new Error(result.error)
      setData((current) => current ? { ...current, state: result.state } : current)
      toast.success(change.type === "move" ? "File moved" : change.type === "remove" ? "Folder deleted; files kept" : "Folder saved")
      return true
    } catch (cause) {
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
    setBusy(true)
    setFailedUpload(null)
    let uploaded = false
    try {
      const result = await createProjectAssets({ projectId, files })
      uploaded = true
      let moveFailed = false
      if (destination) {
        for (const asset of result.assets) {
          const moved = await mutateProjectAssetFolder(projectId, { type: "move", fileKey: `project:${asset.id}`, folderId: destination }, actionScope)
          if ("error" in moved) moveFailed = true
        }
      }
      if (moveFailed) {
        setFolderId(null)
        toast.error("Files uploaded, but some could not be moved. They are available under All files.")
      } else toast.success("Files uploaded")
      await load()
    } catch (cause) {
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
    try {
      const response = await fetch(file.url)
      const payload = await response.json()
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Unable to open file.")
      if (tab) tab.location.href = payload.url
      else toast.error("Allow pop-ups to open this file.")
    } catch (cause) {
      tab?.close()
      toast.error(cause instanceof Error ? cause.message : "Unable to open file.")
    }
  }

  if (!data) return <div role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error ?? "Loading files and folders…"}{error ? <Button variant="outline" onClick={() => void load()}>Retry</Button> : null}</div>
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
    <section aria-label="Documents, files and folders" className="flex flex-col gap-4">
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
      <ProjectAssetFolderGrid state={data.state} files={files} folderId={activeFolderId} query={query} canEdit={data.canEdit} busy={busy} onOpenFolder={(id) => { setFolderId(id); setQuery("") }} onRename={edit} onRemove={(folder) => { setRemoving(folder); setDialogError(null) }} onMove={(file, id) => { void mutate({ type: "move", fileKey: file.key, folderId: id }) }} onUpload={(files, destination) => { void upload(files, destination) }} onOpenFile={(file) => { void openFile(file) }} />
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
    </section>
  )
}
