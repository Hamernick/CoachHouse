"use client"

import { useCallback, useEffect, useState } from "react"
import { formSourceAccessSchema } from "../lib"
import { sendFormCommand } from "./intake-client"

// Presentation only: canonical writers recheck the grant under database locks.
// Fail closed without discarding a draft when access changes or a read fails.
export function useFormSourceAccess(organizationId: string, formId: string | null) {
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  const key = `${organizationId}:${formId}`
  const [access, setAccess] = useState<{ key: string; canEdit: boolean; canManageAccess: boolean; unavailable: boolean } | null>(null)
  useEffect(() => {
    if (!formId) return
    let active = true; let inFlight = false
    const refresh = async () => {
      if (inFlight || document.visibilityState === "hidden") return
      inFlight = true
      try {
        const result = formSourceAccessSchema.parse(await sendFormCommand({ action: "source_access", organizationId, formId }))
        if (result.formId !== formId) throw new Error("Invalid form access")
        if (active) setAccess({ key, canEdit: result.canEdit, canManageAccess: result.canManageAccess, unavailable: false })
      } catch { if (active) setAccess({ key, canEdit: false, canManageAccess: false, unavailable: true }) }
      finally { inFlight = false }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 5_000)
    document.addEventListener("visibilitychange", refresh)
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh) }
  }, [organizationId, formId, key, revision])
  return { refresh, canManageAccess: Boolean(formId && access?.key === key && access.canManageAccess), canEdit: !formId || (access?.key === key && access.canEdit), loading: Boolean(formId && access?.key !== key), unavailable: Boolean(formId && access?.key === key && access.unavailable) }
}
