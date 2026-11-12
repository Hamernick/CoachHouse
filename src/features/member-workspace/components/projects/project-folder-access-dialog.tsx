"use client"
import { useCallback } from "react"
import { AccessDialog } from "@/components/workspace/access-dialog"
import type { AccessChange } from "@/lib/workspace/access"
import { loadProjectFolderAccess, saveProjectFolderAccess } from "../../server/project-folder-access-actions"
import type { FolderAccessTarget } from "../../lib/project-folder-access"
export function ProjectFolderAccessDialog({ target, orgId, returnFocus, fallbackFocus, onClose, onChanged }: {
  target: FolderAccessTarget; orgId: string; returnFocus: HTMLElement; fallbackFocus?: HTMLElement | null; onClose: () => void; onChanged?: () => void
}) {
  const { projectId, folderId, actionScope } = target
  const load = useCallback(() => loadProjectFolderAccess({ projectId, folderId, actionScope }), [projectId, folderId, actionScope])
  const save = useCallback((change: AccessChange) => saveProjectFolderAccess({ projectId, folderId, actionScope, ...change }), [projectId, folderId, actionScope])
  return <AccessDialog orgId={orgId} kind="Folder" load={load} saveChange={save} returnFocus={returnFocus} fallbackFocus={fallbackFocus} onClose={onClose} onChanged={onChanged} />
}
