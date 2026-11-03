"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { readUploadedDocumentVersions } from "../actions"
import type { DocumentSource } from "../types"
import type { DocumentCanonicalWriter } from "../lib/canonical-writer"
import type { DocumentEditorSession } from "../lib/editor-session"
import { useDocumentEditorSession } from "../hooks/use-document-editor-session"

export function DocumentVersionHistory({ source, session, writer }: {
  source: DocumentSource; session: DocumentEditorSession; writer: DocumentCanonicalWriter
}) {
  const state = useDocumentEditorSession(session)
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof readUploadedDocumentVersions>> | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [restore, setRestore] = useState<string | null>(null)
  return <div className="px-3 py-2 text-sm">
    <Button variant="ghost" size="sm" disabled={pending || state.locked} onClick={async () => {
      if (versions) { setVersions(null); return }
      setPending(true); setError("")
      try { setVersions(await readUploadedDocumentVersions(source)) }
      catch { setError("Could not load versions. Try again.") }
      finally { setPending(false) }
    }}>Version history</Button>
    {error && <p role="alert">{error}</p>}
    {versions && <section aria-label="Document versions" className="space-y-2">
      {state.dirty && <p>Save the shared draft before restoring a version.</p>}
      {!versions.length && <p>No saved versions yet. The original file is unchanged.</p>}
      {versions.map(version => <div key={version.id} className="flex items-center justify-between gap-2">
        <span>{version.original ? "Original file" : "Saved version"} · {new Date(version.createdAt).toLocaleString()}</span>
        <Button variant="outline" size="sm" disabled={!state.editable || state.dirty || state.pending}
          aria-label={version.original ? "Restore original file" : `Restore version from ${new Date(version.createdAt).toLocaleString()}`}
          onClick={() => setRestore(version.id)}>Restore</Button>
      </div>)}
    </section>}
    <AlertDialog open={Boolean(restore)} onOpenChange={open => { if (!open) setRestore(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Restore this version?</AlertDialogTitle>
          <AlertDialogDescription>This becomes the saved file. Existing versions remain available. Other editors must reopen this document.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!state.editable || state.dirty || state.pending} onClick={() => {
          const id = restore; setRestore(null)
          if (id) void writer.restore(id).catch(value => setError(value instanceof Error ? value.message : "Could not restore this version."))
        }}>Restore version</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
