"use client"

import { useId, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldMessage } from "@/components/ui/field"
import { useWorkspaceCommand } from "../hooks/use-workspace-command"
import type { WorkspaceSummary } from "../types"

export function WorkspaceNameDialog({ orgId, workspace, returnFocus, onClose, onSaved }: {
  orgId: string
  returnFocus: HTMLElement
  workspace: WorkspaceSummary | null
  onClose: () => void
  onSaved: (workspaces: WorkspaceSummary[], id: string | null, created: boolean) => void
}) {
  const inputId = useId()
  const [id] = useState(() => workspace?.id ?? crypto.randomUUID())
  const [name, setName] = useState(workspace?.name ?? "")
  const { pending, error, save } = useWorkspaceCommand()
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="gap-5 rounded-3xl border-border/70 bg-card p-5 shadow-none motion-reduce:animate-none sm:max-w-sm" showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.focus() }} onEscapeKeyDown={(event) => { if (pending) event.preventDefault() }} onPointerDownOutside={(event) => { if (pending) event.preventDefault() }}>
        <DialogHeader>
          <DialogTitle className="text-base">{workspace ? "Rename workspace" : "Create workspace"}</DialogTitle>
          <DialogDescription>{workspace ? "Choose a name your team will recognize." : "Start a separate canvas for your organization."}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={async (event) => {
          event.preventDefault()
          const result = await save(workspace
            ? { kind: "rename", orgId, id: workspace.id, name, previousName: workspace.name }
            : { kind: "create", orgId, id, name })
          if (result) onSaved(result.workspaces, result.id, !workspace)
        }}>
          <Field>
            <FieldLabel htmlFor={inputId}>Workspace name</FieldLabel>
            <Input className="h-11 rounded-xl border-border/70 bg-muted/40 px-3 shadow-none sm:h-9" id={inputId} autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={pending} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} />
            {error ? <FieldMessage id={`${inputId}-error`} role="alert">{error}</FieldMessage> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" className="h-11 rounded-full px-4 shadow-none transition-colors sm:h-9" disabled={pending} onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-11 rounded-full px-4 shadow-none transition-colors sm:h-9" disabled={pending || !name.trim()}>{pending ? "Saving…" : workspace ? "Save name" : "Create workspace"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
