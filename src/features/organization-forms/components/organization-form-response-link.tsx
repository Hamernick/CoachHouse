"use client"

import { useId, useRef, useState } from "react"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { formSourcePath } from "../lib/form-source-link"
import type { FormAccessTarget } from "../lib/form-review-access"
import { formResponsePath } from "../lib/form-response-link"

export function OrganizationFormResponseLink({ versionId, target, disabled, forInvitation = false }: { versionId?: string; target?: FormAccessTarget; disabled: boolean; forInvitation?: boolean }) {
  const id = useId()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState("")
  async function copy() {
    if (busy.current || disabled) return
    busy.current = true; setPending(true); setCopied(false); setFallback("")
    const url = new URL(target?.organizationId ? formSourcePath(target.organizationId, target.formId) : formResponsePath(target?.versionId ?? versionId!), window.location.origin).href
    try { await navigator.clipboard.writeText(url); setCopied(true) }
    catch { setFallback(url) }
    finally { busy.current = false; setPending(false) }
  }
  return <div className="flex min-w-0 flex-col gap-2">
    <Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled || pending} onClick={() => void copy()}>
      {pending ? "Copying link…" : target ? "Copy form link" : "Copy response link"}
    </Button>
    {copied && <p role="status" className="text-muted-foreground text-xs">{forInvitation ? "Link copied. Sign in with the invited email to accept." : "Link copied. Existing form access required."}</p>}
    {fallback && <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-xs">{target ? "Copy this form link" : "Copy this response link"}</label>
      <Input size="2xl" id={id} value={fallback} readOnly className="min-h-11 text-base" onFocus={(event) => event.currentTarget.select()} />
      <p role="status" className="text-muted-foreground text-xs">{forInvitation ? "Select and copy the link. Sign in with the invited email to accept." : "Select and copy the link. Existing form access required."}</p>
    </div>}
  </div>
}
