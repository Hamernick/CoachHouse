"use client"

import { useRef } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { NoteDocument } from "../lib/particle-notes"
import { NotesEditor } from "./notes-editor"

export function ParticleNoteDocumentDialog({ note, organizationId, editable, onClose }: {
  note: NoteDocument; organizationId: string; editable: boolean; onClose: () => void
}) {
  const closeRequestRef = useRef<(() => void) | null>(null)
  return <Dialog open onOpenChange={(open) => { if (!open) closeRequestRef.current?.() }}>
    <DialogContent showCloseButton={false} className="flex h-[min(720px,85dvh)] flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-none sm:max-w-[960px]">
      <DialogTitle className="sr-only">Notes</DialogTitle>
      <DialogDescription className="sr-only">Your workspace and personal lesson notes.</DialogDescription>
      <NotesEditor initialNote={note} organizationId={organizationId} editable={editable} onClose={onClose} closeRequestRef={closeRequestRef} />
    </DialogContent>
  </Dialog>
}
