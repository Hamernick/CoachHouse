"use client"

import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog"

export type NoteConfirmation = "delete" | "discard" | "reload" | null
export function NotesEditorDialogs({ confirmation, onCancel, onConfirm, pending, personal, error, returnFocusRef }: {
  confirmation: NoteConfirmation; onCancel: () => void; onConfirm: () => void; pending: boolean; personal: boolean; error: string | null; returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const deleting = confirmation === "delete"
  return <AlertDialog open={confirmation !== null} onOpenChange={(open) => { if (!open && !pending) onCancel() }}>
    <AlertDialogContent onCloseAutoFocus={(event) => {
      const target = returnFocusRef.current
      if (target?.isConnected) { event.preventDefault(); target.focus({ preventScroll: true }) }
    }} className="rounded-3xl border-border/70 bg-card p-5 shadow-none sm:max-w-sm">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-base">{deleting ? "Delete this note?" : confirmation === "reload" ? "Load the latest note?" : "Discard unsaved changes?"}</AlertDialogTitle>
        <AlertDialogDescription>{deleting
          ? personal ? "This clears your personal lesson note. Your lesson progress stays saved." : "This deletes the note from the workspace and Documents. This can’t be undone."
          : "Your unsaved draft will be discarded."}</AlertDialogDescription>
      </AlertDialogHeader>
      {deleting && error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel asChild><Button variant="ghost" disabled={pending} className="h-11 rounded-full shadow-none sm:h-9">Keep editing</Button></AlertDialogCancel>
        <Button variant="destructive" disabled={pending} aria-busy={pending} className="h-11 rounded-full shadow-none sm:h-9" onClick={onConfirm}>{deleting ? "Delete note" : confirmation === "reload" ? "Load latest" : "Discard changes"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
