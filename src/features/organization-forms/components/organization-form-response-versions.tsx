"use client"

import { useEffect, useId, useState } from "react"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { formVersionListSchema } from "../lib"
import { formResponsePath } from "../lib/form-response-link"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"

/** Version links never carry authority. Each destination rechecks form access. */
export function OrganizationFormResponseVersions({ versionId, disabled, onDenied }: {
  versionId: string; disabled: boolean; onDenied: (message: string) => void
}) {
  const regionId = useId()
  const [open, setOpen] = useState(false)
  const [before, setBefore] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState<z.infer<typeof formVersionListSchema> | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!open || disabled) return
    let active = true
    setData(null); setError("")
    void sendFormCommand({ action: "response_versions", versionId, ...(before ? { before } : {}) })
      .then((value) => { const result = formVersionListSchema.parse(value); if (active) setData(result) })
      .catch((failure) => {
        if (!active) return
        if (failure instanceof IntakeRequestError && [401, 403].includes(failure.status)) onDenied(failure.message)
        else setError("Unable to load versions.")
      })
    return () => { active = false }
  }, [open, disabled, versionId, before, retry, onDenied])
  return <div className="min-w-0">
    <Button type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled}
      aria-expanded={open} aria-controls={regionId} onClick={() => { setOpen(!open); setBefore(undefined) }}>Other versions</Button>
    {open && <section id={regionId} aria-label="Form versions" className="mt-2 flex min-w-0 flex-col gap-3 rounded-xl border p-3">
      <p className="text-muted-foreground text-xs">Published versions of this form. Each keeps its own responses.</p>
      {error ? <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm">{error}</p>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={disabled} onClick={() => setRetry((value) => value + 1)}>Retry versions</Button></div>
        : !data ? <p role="status" className="text-muted-foreground text-sm">Loading versions…</p> : <ul className="flex min-w-0 flex-col gap-1">
          {data.versions.map((version) => <li key={version.id} className="min-w-0">
            {disabled || version.id === versionId ? <span aria-current={version.id === versionId ? "page" : undefined}
              className="block min-h-11 break-words rounded-xl px-3 py-2 text-sm [overflow-wrap:anywhere]">{version.title} · Version {version.revision}{version.id === versionId ? " (current)" : ""}</span>
              : <Button asChild variant="ghost" className="h-auto min-h-11 w-full justify-start whitespace-normal break-words rounded-xl px-3 py-2 text-left [overflow-wrap:anywhere]">
                <a href={formResponsePath(version.id)}>{version.title} · Version {version.revision}</a></Button>}
          </li>)}
        </ul>}
      <div className="flex flex-wrap gap-2">
        {data?.next && <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={disabled} onClick={() => setBefore(data.next ?? undefined)}>Earlier versions</Button>}
        {before && <Button type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled} onClick={() => setBefore(undefined)}>Latest versions</Button>}
      </div>
    </section>}
  </div>
}
