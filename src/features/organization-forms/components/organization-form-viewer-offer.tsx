"use client"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { formViewerAcceptanceSchema, formViewerOfferSchema } from "../lib/form-viewer-access"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"
export function OrganizationFormViewerOffer({ versionId, onAccepted, onLockChange }: {
  versionId: string; onAccepted: () => void; onLockChange: (locked: boolean) => void
}) {
  const [offer, setOffer] = useState<z.infer<typeof formViewerOfferSchema> | null>(null)
  const [pending, setPending] = useState(false); const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState(""); const busy = useRef(false)
  const locked = pending || uncertain
  useEffect(() => { onLockChange(locked); return () => onLockChange(false) }, [locked, onLockChange])
  useEffect(() => {
    if (!locked) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [locked])
  useEffect(() => {
    let active = true
    void sendFormCommand({ action: "viewer_offer", versionId }).then((value) => {
      const next = formViewerOfferSchema.parse(value)
      if (active && next.versionId === versionId) setOffer(next)
    }).catch(() => { /* Unknown, expired and other-account invitations disclose nothing. */ })
    return () => { active = false }
  }, [versionId])
  async function accept() {
    if (!offer || busy.current) return
    busy.current = true; setPending(true); setError("")
    try {
      const receipt = formViewerAcceptanceSchema.parse(await sendFormCommand({ action: "accept_viewer", versionId, invitationId: offer.invitationId }))
      if (receipt.versionId !== versionId || receipt.invitationId !== offer.invitationId) throw new Error("Invalid acceptance")
      setUncertain(false); onAccepted()
    } catch (failure) {
      setUncertain(!(failure instanceof IntakeRequestError) || failure.uncertain)
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry acceptance.")
      if (failure instanceof IntakeRequestError && [401, 403].includes(failure.status)) setOffer(null)
    } finally { busy.current = false; setPending(false) }
  }
  if (!offer) return error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null
  return <section aria-label="Response invitation" className="flex min-w-0 flex-col gap-3 rounded-xl border p-3">
    <h2 className="break-words text-sm font-medium">{offer.title}</h2>
    <p className="text-muted-foreground text-sm">{offer.responsePermission === "manage" ? "You’re invited to edit this form, correct answers and invite View/Edit collaborators. Their access ends when yours ends." : offer.responsePermission === "edit" ? "You’re invited to edit this form and correct answers. Saving changes the draft, not its published versions." : offer.responsePermission === "correct" ? "You’re invited to view and correct answers." : "You’re invited to view responses."} {offer.responsePermission === "manage" ? "No workspace access, publication, removal or further Manage delegation." : offer.responsePermission === "edit" ? "No workspace access, publication or sharing rights." : "No form editing, workspace access or sharing rights."}</p>
    <Button size="lg" color="primary" type="button" className="min-h-11 rounded-xl" disabled={pending} onClick={() => void accept()}>{uncertain ? "Retry acceptance" : offer.accepted ? "Open responses" : offer.responsePermission === "manage" ? "Accept form management" : offer.responsePermission === "edit" ? "Accept form editing" : offer.responsePermission === "correct" ? "Accept correction access" : "Accept viewing access"}</Button>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
  </section>
}
