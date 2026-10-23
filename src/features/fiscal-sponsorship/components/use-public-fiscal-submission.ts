"use client"

import { useRef, useState } from "react"
import { z } from "zod"
import type { GuestDraftController } from "../lib/guest-draft-controller"
import { guestFieldName, guestSubmissionInput } from "../lib/guest-submission-input"
import type { guestSubmissionSchema } from "../lib/guest-submission-schema"

export function usePublicFiscalSubmission(controller: GuestDraftController) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const busy = useRef(false)
  const pending = useRef<z.infer<typeof guestSubmissionSchema> | null>(null)
  const submit = async () => {
    if (busy.current) return
    setMessage(null)
    if (!pending.current) {
      try {
        const parsed = guestSubmissionInput(controller.getSnapshot().draft)
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [guestFieldName(issue.path), issue.code === "custom" ? issue.message : "Check this answer."])))
          return
        }
        pending.current = parsed.data
      } catch { setMessage("An answer is too long. Shorten it before submitting."); return }
    }
    busy.current = true; setWorking(true); setErrors({})
    try {
      if (!uncertain && !(await controller.flush())) {
        pending.current = null; setMessage("Your draft needs attention before submitting. Resolve the save message above and try again."); return
      }
      const response = await fetch("/api/public/fiscal-sponsorship/applications", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.current),
      })
      const result: unknown = await response.json()
      if (response.ok) {
        const receipt = z.object({ ok: z.literal(true), reference: z.string().uuid() }).strict().parse(result)
        controller.acceptSubmission(receipt.reference); pending.current = null; setUncertain(false); return
      }
      if (response.status >= 500) throw new Error("uncertain_submission")
      // Definite rejection: retain answers and release editing.
      pending.current = null; setUncertain(false)
      if (response.status === 401) controller.expireSession()
      const failure = z.object({ error: z.string(), fields: z.array(z.object({ path: z.string(), message: z.string() })).optional() }).passthrough().safeParse(result)
      if (failure.success && failure.data.fields) setErrors(Object.fromEntries(failure.data.fields.map((field) => [guestFieldName(field.path.split(".")), field.message])))
      setMessage(response.status === 429 ? "Please wait before trying again. Your answers are saved."
        : response.status === 401 ? "Your session expired. Resume saving above, then try again."
          : failure.success ? failure.data.error : "Check your answers and try again.")
    } catch {
      setUncertain(true)
      setMessage("We couldn’t confirm the result. Your answers are preserved. Retry to check the same application; it won’t create a duplicate.")
    } finally { busy.current = false; setWorking(false) }
  }
  return { errors, message, setMessage, working, uncertain, submit }
}
