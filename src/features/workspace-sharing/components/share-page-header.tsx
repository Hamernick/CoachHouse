"use client"

import type { ReactNode } from "react"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import { Button } from "@/components/ui/button"
import { WorkspaceWindowHeaderPortal, WORKSPACE_HEADER_BUTTON } from "@/components/workspace/workspace-window-header-slots"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

export function SharePageHeader({ dirty = false, locked = false, onBack, actions }: {
  dirty?: boolean; locked?: boolean; onBack: () => void; actions?: ReactNode
}) {
  return <>
    <WorkspaceWindowHeaderPortal slot="title">
      <div className="flex min-w-0 items-center gap-1">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-7 rounded-full shadow-none transition-none [@media(pointer:coarse)]:size-11"
              aria-label="Back to Particle" disabled={locked} onClick={(event) => { if (!dirty) { event.preventDefault(); onBack() } }}>
              <ArrowLeftIcon aria-hidden />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="gap-4 rounded-3xl p-5 shadow-none motion-reduce:animate-none sm:max-w-sm">
            <AlertDialogHeader><AlertDialogTitle>Discard page changes?</AlertDialogTitle><AlertDialogDescription>Your saved page and current publication will stay unchanged.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-full">Keep editing</AlertDialogCancel><AlertDialogAction className="rounded-full" onClick={onBack}>Discard changes</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <h2 className="min-w-0 truncate text-sm font-medium">Share page</h2>
      </div>
    </WorkspaceWindowHeaderPortal>
    <WorkspaceWindowHeaderPortal><div className="flex shrink-0 items-center gap-1">{actions}</div></WorkspaceWindowHeaderPortal>
  </>
}
export const SHARE_HEADER_BUTTON = WORKSPACE_HEADER_BUTTON
