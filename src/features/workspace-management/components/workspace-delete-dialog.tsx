"use client"

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useWorkspaceCommand } from "../hooks/use-workspace-command"
import type { WorkspaceSummary } from "../types"

export function WorkspaceDeleteDialog({ orgId, workspace, returnFocus, onClose, onDeleted }: {
  orgId: string
  workspace: WorkspaceSummary
  returnFocus: HTMLElement
  onClose: () => void
  onDeleted: (workspaces: WorkspaceSummary[]) => void
}) {
  const { pending, error, save } = useWorkspaceCommand()
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <AlertDialogContent className="rounded-3xl border-border/70 bg-card p-5 shadow-none sm:max-w-sm" onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.focus() }} onEscapeKeyDown={(event) => { if (pending) event.preventDefault() }}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">Delete {workspace.name}?</AlertDialogTitle>
          <AlertDialogDescription>This permanently deletes this canvas and its cards for everyone. Shared organization records and files stay available.</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button variant="ghost" className="h-11 rounded-full shadow-none sm:h-9" disabled={pending} onClick={onClose}>Cancel</Button></AlertDialogCancel>
          <Button variant="destructive" className="h-11 rounded-full shadow-none sm:h-9" disabled={pending} onClick={async () => {
            const result = await save({ kind: "delete", orgId, id: workspace.id, previousName: workspace.name })
            if (result) onDeleted(result.workspaces)
          }}>{pending ? "Deleting…" : "Delete workspace"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
