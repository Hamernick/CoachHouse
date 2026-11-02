"use client"
import { useCallback, useEffect, useId, useState } from "react"
import { z } from "zod"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleSelect as Select } from "@/components/ui/particle-ui"
import { formVersionListSchema } from "../lib"
import { sendFormCommand } from "../hooks/intake-client"
import { OrganizationFormRecovery } from "./organization-form-recovery"
import { OrganizationFormResponses } from "./organization-form-responses"

export function OrganizationFormResponseBrowser({ pageId, onLockChange }: { pageId: string; onLockChange: (locked: boolean) => void }) {
  const label = useId()
  const [data, setData] = useState<z.infer<typeof formVersionListSchema> | null>(null)
  const [selected, setSelected] = useState("")
  const [before, setBefore] = useState<string | undefined>()
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState("")
  const [locked, setLocked] = useState(false)
  const [recoveryLocked, setRecoveryLocked] = useState(false)
  const recovered = useCallback(() => { setBefore(undefined); setRetry((value) => value + 1) }, [])
  useEffect(() => { onLockChange(locked || recoveryLocked); return () => onLockChange(false) }, [locked, recoveryLocked, onLockChange])
  useEffect(() => {
    let active = true
    setData(null); setSelected(""); setError("")
    void sendFormCommand({ action: "versions", pageId, ...(before ? { before } : {}) }).then((value) => {
      const result = formVersionListSchema.parse(value)
      if (active) { setData(result); setSelected(result.versions[0]?.id ?? "") }
    }).catch(() => { if (active) setError("Unable to load form versions.") })
    return () => { active = false }
  }, [pageId, before, retry])
  return <div className="flex min-w-0 flex-col gap-3">
    <OrganizationFormRecovery target={{ pageId }} disabled={locked} onLockChange={setRecoveryLocked} onRecovered={recovered} />
    {error ? <div role="alert" className="text-sm">{error}<Button size="lg" color="primary" variant="outline" className="ml-2 min-h-11 rounded-xl" disabled={locked || recoveryLocked} onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>
      : !data ? <p role="status" className="text-sm">Loading forms…</p> : !data.versions.length ? <p className="text-muted-foreground text-sm">No response access for this page.</p> : <>
        <label htmlFor={label} className="text-muted-foreground text-xs">Published form version</label>
        <Select id={label} className="min-h-11 w-full" value={selected} onChange={event => (setSelected)(event.target.value)} disabled={locked || recoveryLocked}>
          {data.versions.map((version) => <option key={version.id} value={version.id}>{version.title} · Version {version.revision}</option>)}
        </Select>
        {selected && <fieldset className="min-w-0 border-0 p-0" disabled={recoveryLocked}><OrganizationFormResponses key={selected} versionId={selected} onLockChange={setLocked} /></fieldset>}
      </>}
    {data?.next && <Button size="lg" color="primary" type="button" variant="outline" disabled={locked || recoveryLocked} onClick={() => setBefore(data.next ?? undefined)}>Earlier versions</Button>}
    {before && <Button size="lg" color="primary" type="button" variant="ghost" disabled={locked || recoveryLocked} onClick={() => setBefore(undefined)}>Latest versions</Button>}
  </div>
}
