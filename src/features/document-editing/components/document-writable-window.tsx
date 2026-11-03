"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { DocumentSource } from "../types"
import type { createWritableDocumentOwner, WritableDocumentState } from "../lib/writable-owner"
import { DocumentSharedEditor } from "./document-shared-editor"
import { DocumentVersionHistory } from "./document-version-history"

export function DocumentWritableWindow({ owner, state, source, label, active, onDirtyChange }: {
  owner: ReturnType<typeof createWritableDocumentOwner>; state: WritableDocumentState
  source: DocumentSource; label: string; active: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [error, setError] = useState("")
  if (state.status === "locked") return <p role="status" className="p-3 text-sm">{state.message}</p>
  if (state.status === "opening") return <p role="status" className="p-3 text-sm">Opening editor…</p>
  if (state.status === "recovery") return <section aria-label="Recover document draft" className="space-y-2 p-3 text-sm">
    <p>Unsaved changes are available on this device. Choose a draft to recover, or open the shared document and keep these drafts.</p>
    {error && <p role="alert">{error}</p>}
    {state.choices.map(choice => choice.previousGeneration ? <div key={choice.sessionId}>
      <p>A previous version has local changes. Download them before editing the restored document.</p>
      <Button variant="outline" onClick={async () => {
        setError("")
        try {
          const file = await owner.exportRecovery(choice.sessionId)
          const url = URL.createObjectURL(new Blob([file.content], { type: file.type }))
          const link = document.createElement("a"); link.href = url; link.download = file.name
          document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (value) { setError(value instanceof Error ? value.message : "Could not export this draft.") }
      }}>{choice.complete ? "Download previous draft" : "Download older recovery data"}</Button>
      {!choice.complete && <p>This older record contains native edit data, not a complete Markdown document.</p>}
    </div> : <Button key={choice.sessionId} variant="outline" onClick={() => void owner.recover(choice.sessionId)}>
      Recover draft from {new Date(choice.updatedAt).toLocaleString()}
    </Button>)}
    <Button variant="ghost" onClick={() => void owner.recover()}>Open shared document</Button>
  </section>
  if (!state.session || !state.writer) return null
  return <>
    <DocumentSharedEditor session={state.session} canonicalWriter={state.writer} label={label} active={active} onDirtyChange={onDirtyChange} />
    <DocumentVersionHistory source={source} session={state.session} writer={state.writer} />
  </>
}
