"use client"
import { useCallback } from "react"
import { AccessDialog } from "@/components/workspace/access-dialog"
import type { AccessChange } from "@/lib/workspace/access"
import { loadWorkspaceAccess, saveWorkspaceAccess } from "../access-actions"
import type { WorkspaceAccessTarget } from "../lib/access"
export function WorkspaceAccessDialog({ target, returnFocus, fallbackFocus, onClose }: {
  target: WorkspaceAccessTarget; returnFocus: HTMLElement; fallbackFocus?: HTMLElement | null; onClose: () => void
}) {
  const { orgId, canvasId } = target
  const load = useCallback(() => loadWorkspaceAccess({ orgId, canvasId }), [orgId, canvasId])
  const save = useCallback((change: AccessChange) => saveWorkspaceAccess({ orgId, canvasId, ...change }), [orgId, canvasId])
  return <AccessDialog orgId={orgId} kind="Workspace" load={load} saveChange={save} returnFocus={returnFocus} fallbackFocus={fallbackFocus} onClose={onClose} />
}
