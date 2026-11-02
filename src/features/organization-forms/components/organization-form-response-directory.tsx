"use client"

import { useEffect, useId, useState } from "react"
import type { z } from "zod"
import { ParticleButtonLink as ButtonLink, ParticleButton as Button } from "@/components/ui/particle-ui"
import { formResponseDirectorySchema } from "../lib"
import { formResponsePath } from "../lib/form-response-link"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"

/** Only authorized titles/locators; each destination independently reauthorizes. */
export function OrganizationFormResponseDirectory({ versionId, formId, disabled, onDenied }: {
  versionId: string; formId: string; disabled: boolean; onDenied: (message: string) => void
}) {
  const regionId = useId()
  const [open, setOpen] = useState(false)
  const [after, setAfter] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState<z.infer<typeof formResponseDirectorySchema> | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!open || disabled) return
    let active = true, inFlight = false
    setData(null); setError("")
    async function load() {
      if (inFlight || document.visibilityState === "hidden") return
      inFlight = true
      try {
        const result = formResponseDirectorySchema.parse(await sendFormCommand({ action: "response_forms", versionId, ...(after ? { after } : {}) }))
        if (active) { setData(result); setError("") }
      } catch (failure) {
        if (!active) return
        setData(null)
        if (failure instanceof IntakeRequestError && [401, 403].includes(failure.status)) onDenied(failure.message)
        else setError("Unable to load forms.")
      } finally { inFlight = false }
    }
    void load()
    const timer = setInterval(() => void load(), 5000)
    const visible = () => void load()
    document.addEventListener("visibilitychange", visible)
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
  }, [open, disabled, versionId, after, retry, onDenied])
  return <div className="min-w-0">
    <Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled}
      aria-expanded={open} aria-controls={regionId} onClick={() => { setOpen(!open); setAfter(undefined) }}>Your forms</Button>
    {open && <section id={regionId} aria-label="Accessible forms" className="mt-2 flex min-w-0 flex-col gap-3 rounded-xl border p-3">
      <p className="text-muted-foreground text-xs">Forms you can access in this organization.</p>
      {error ? <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm">{error}</p>
        <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={disabled} onClick={() => setRetry((value) => value + 1)}>Retry forms</Button></div>
        : !data ? <p role="status" className="text-muted-foreground text-sm">Loading forms…</p>
        : !data.forms.length ? <p className="text-muted-foreground text-sm">No more accessible forms.</p>
        : <ul className="flex min-w-0 flex-col gap-1">{data.forms.map((form) => <li key={form.formId} className="min-w-0">
          {disabled || form.formId === formId ? <span aria-current={form.formId === formId ? "page" : undefined}
            className="block min-h-11 break-words rounded-xl px-3 py-2 text-sm [overflow-wrap:anywhere]">{form.title}{form.formId === formId ? " (current)" : ""}</span>
            : <ButtonLink size="lg" color="primary"  variant="ghost" className="h-auto min-h-11 w-full justify-start whitespace-normal break-words rounded-xl px-3 py-2 text-left [overflow-wrap:anywhere]" href={formResponsePath(form.versionId)}>{form.title}</ButtonLink>}
        </li>)}</ul>}
      <div className="flex flex-wrap gap-2">
        {data?.next && <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={disabled} onClick={() => setAfter(data.next ?? undefined)}>More forms</Button>}
        {after && <Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled} onClick={() => setAfter(undefined)}>First forms</Button>}
      </div>
    </section>}
  </div>
}
