"use client"

import { useEffect, useId, useRef, useState } from "react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { formDeletionReceiptSchema, type FormIntakeCommand, type FormResponse } from "../lib"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"

export function OrganizationFormResponseDelete({ response, onDeleted, onCancel, onConflict, onDenied }: {
  response: FormResponse; onDeleted: () => void; onCancel: () => void; onConflict: () => void; onDenied: (message: string) => void
}) {
  const titleId = useId(); const cancel = useRef<HTMLButtonElement>(null); const busy = useRef(false)
  const [command] = useState<Extract<FormIntakeCommand, { action: "delete_response" }>>(() => ({ action: "delete_response", id: response.id,
    versionId: response.versionId, expectedRevision: response.revision, operationId: crypto.randomUUID() }))
  const [pending, setPending] = useState(false); const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false); const [error, setError] = useState("")
  useEffect(() => { cancel.current?.focus() }, [])
  async function remove() {
    if (busy.current) return
    busy.current = true; setPending(true); setError("")
    try {
      const receipt = formDeletionReceiptSchema.parse(await sendFormCommand(command))
      if (receipt.id !== response.id || receipt.versionId !== response.versionId || receipt.operationId !== command.operationId)
        throw new Error("Invalid deletion receipt")
      onDeleted()
    } catch (failure) {
      if (failure instanceof IntakeRequestError && [401, 403].includes(failure.status)) {
        onDenied(failure.message); return
      }
      setUncertain(!(failure instanceof IntakeRequestError) || failure.uncertain)
      setConflict(failure instanceof IntakeRequestError && failure.status === 409)
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry the same request.")
    } finally { busy.current = false; setPending(false) }
  }
  return <div role="group" aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3">
    <h4 id={titleId} className="text-sm font-medium">Delete this response?</h4>
    <p className="text-muted-foreground text-sm">This removes its answers from Coach House. You cannot undo this. Previously downloaded copies and backups are not erased here.</p>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button ref={cancel} type="button" variant="outline" className="min-h-11 rounded-xl" disabled={pending || uncertain} onClick={onCancel}>Cancel</Button>
      {conflict ? <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={onConflict}>Review latest response</Button>
        : <Button type="button" variant="destructive" className="min-h-11 rounded-xl" disabled={pending} onClick={() => void remove()}>
          {pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}{uncertain ? "Retry deletion" : "Delete permanently"}
        </Button>}
    </div>
  </div>
}
