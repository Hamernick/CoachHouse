"use client"

import { useState, type DragEvent } from "react"
import { DotsThree, DotsSixVertical, File, Folder, ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getFolderDropFile, type FolderFile, type ProjectAssetFolder, type ProjectAssetFolderState } from "../../lib/project-asset-folders"

import { ProjectFolderMenu } from "./project-folder-menu"

const FILE_DRAG_TYPE = "application/x-coach-house-document"
const sourceLabels = { organization: "Organization file", project: "Project file", core: "Core document", policy: "Policy", upload: "Organization document", drive: "Google Drive", fiscal: "Signed document · Read-only" }

type Props = {
  state: ProjectAssetFolderState
  files: FolderFile[]
  folderId: string | null
  query: string
  canEdit: boolean
  busy: boolean
  onAccess?: (folder: ProjectAssetFolder, trigger: HTMLButtonElement) => void
  onOpenFolder: (id: string | null) => void
  onRename: (folder: ProjectAssetFolder) => void
  onRemove: (folder: ProjectAssetFolder) => void
  onMove: (file: FolderFile, folderId: string | null) => void
  onUpload?: (files: globalThis.File[], folderId: string | null) => void
  onOpenFile: (file: FolderFile) => void
}

export function ProjectAssetFolderGrid({ state, files, folderId, query, canEdit, busy, onAccess, onOpenFolder, onRename, onRemove, onMove, onUpload, onOpenFile }: Props) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const location = new Map(state.placements.map((item) => [item.fileKey, item.folderId]))
  const matches = (name: string) => name.toLowerCase().includes(query.trim().toLowerCase())
  // Keep destinations visible while browsing a folder or dragging a filtered file.
  const folders = state.folders.filter((folder) => folderId || draggingKey || matches(folder.name))
  const visibleFiles = files.filter((file) => (location.get(file.key) ?? null) === folderId && matches(file.name))
  const targetKey = (id: string | null) => id ?? "root"
  const dropFile = (key: string, id: string | null) => getFolderDropFile({ state, files, key, folderId: id, canEdit, busy })
  const isUpload = (event: DragEvent) => event.dataTransfer.types.includes("Files")
  const dropProps = (id: string | null) => ({
    onDragOver(event: DragEvent<HTMLElement>) {
      const upload = isUpload(event)
      const allowed = canEdit && !busy && (upload ? Boolean(onUpload) : Boolean(draggingKey && dropFile(draggingKey, id)))
      if (upload || draggingKey) { event.preventDefault(); event.stopPropagation() }
      event.dataTransfer.dropEffect = allowed ? upload ? "copy" : "move" : "none"
      if (allowed) setDropTarget(targetKey(id))
    },
    onDragLeave(event: DragEvent<HTMLElement>) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
    },
    onDrop(event: DragEvent<HTMLElement>) {
      event.preventDefault()
      event.stopPropagation()
      setDropTarget(null)
      if (isUpload(event)) {
        if (canEdit && !busy && onUpload) onUpload(Array.from(event.dataTransfer.files), id)
      } else {
        const key = event.dataTransfer.getData(FILE_DRAG_TYPE)
        const file = key === draggingKey ? dropFile(key, id) : null
        if (file) onMove(file, id)
      }
      setDraggingKey(null)
    },
  })
  const menuTrigger = (name: string) => (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" disabled={busy} className="size-6 text-muted-foreground" aria-label={`Actions for ${name}`}><DotsThree weight="bold" /></Button>
    </DropdownMenuTrigger>
  )
  return (
    <div {...dropProps(folderId)} className="flex flex-col gap-4">
      {folderId ? <div {...dropProps(null)} className={cn("w-fit rounded-lg", dropTarget === "root" && "bg-accent ring-2 ring-primary")}>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onOpenFolder(null)}><ArrowLeft />All files</Button>
      </div> : null}
      {folders.length ? <div aria-label="Folders" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {folders.map((folder) => {
          const count = files.filter((file) => location.get(file.key) === folder.id).length
          return (
            <div key={folder.id} {...dropProps(folder.id)} data-drop-folder={folder.id} className={cn("flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-muted p-1 transition-colors", folderId === folder.id && "border-primary", dropTarget === folder.id && "bg-accent ring-2 ring-primary")}>
              <div className="flex items-center justify-between gap-2 p-1">
                <Folder className="size-5 text-muted-foreground" />
                <ProjectFolderMenu folder={folder} canEdit={canEdit} busy={busy} onAccess={onAccess} onRename={onRename} onRemove={onRemove} />
              </div>
              <Button variant="ghost" disabled={busy} className="h-auto w-full min-w-0 flex-col items-start gap-1 rounded-lg bg-background px-3 py-3 text-left" onClick={() => onOpenFolder(folder.id)} aria-label={`Open folder ${folder.name}`}>
                <span className="w-full truncate">{folder.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{dropTarget === folder.id ? "Drop here" : `${count} ${count === 1 ? "item" : "items"}`}</span>
              </Button>
            </div>
          )
        })}
      </div> : null}
      {canEdit && state.folders.length ? <p role="status" className="text-xs text-muted-foreground">{draggingKey ? "Drop onto a folder to move this item." : "Drag files into a folder, or use the Move to menu."}</p> : null}
      <div {...dropProps(folderId)} aria-label="Files" className={cn("divide-y rounded-lg border border-border bg-card", dropTarget === targetKey(folderId) && "ring-2 ring-primary")}>
        {!visibleFiles.length ? <p className="p-4 text-sm text-muted-foreground">{query ? "No documents or files match your search." : folderId ? "This folder is empty. Drop files here or move them from another folder." : "No unfiled documents or files."}</p> : null}
        {visibleFiles.map((file) => (
          <div key={file.key} data-file-row={file.key} draggable={canEdit && !busy} className={cn("flex flex-wrap items-center justify-between gap-3 p-3", canEdit && !busy && "cursor-grab active:cursor-grabbing", draggingKey === file.key && "opacity-50")}
            onDragStart={(event) => {
              if (!canEdit || busy || (event.target instanceof Element && event.target.closest("button, a, input"))) { event.preventDefault(); return }
              event.dataTransfer.setData(FILE_DRAG_TYPE, file.key)
              event.dataTransfer.effectAllowed = "move"
              setDraggingKey(file.key)
            }}
            onDragEnd={() => { setDraggingKey(null); setDropTarget(null) }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {canEdit ? <DotsSixVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : null}
              <File aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{sourceLabels[file.source]}</p></div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenFile(file)} aria-label={`Open file ${file.name}`}>{["core", "policy"].includes(file.source) ? "View / edit" : file.source === "upload" ? "Open / upload" : "Open"}</Button>
              {file.downloadUrl ? <Button variant="ghost" size="sm" asChild><a href={file.downloadUrl} draggable={false}>Download</a></Button> : null}
              {canEdit && state.folders.length ? <DropdownMenu>{menuTrigger(file.name)}<DropdownMenuContent align="end"><DropdownMenuLabel>Move to</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={location.get(file.key) ?? "root"} onValueChange={(id) => onMove(file, id === "root" ? null : id)}>
                  <DropdownMenuRadioItem value="root">All files</DropdownMenuRadioItem>
                  {state.folders.map((folder) => <DropdownMenuRadioItem key={folder.id} value={folder.id}>{folder.name}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent></DropdownMenu> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
