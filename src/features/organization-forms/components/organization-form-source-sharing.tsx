"use client"

import { useId, useMemo, useState } from "react"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { OrganizationFormRecovery } from "./organization-form-recovery"
import { OrganizationFormReviewAccess } from "./organization-form-review-access"

export function OrganizationFormSourceSharing({ organizationId, formId, canManage, disabled, locked, onLockChange, onRecovered }: {
  organizationId: string; formId: string; canManage: boolean; disabled: boolean; locked: boolean; onLockChange: (locked: boolean) => void; onRecovered: () => void
}) {
  const target = useMemo(() => ({ organizationId, formId }), [organizationId, formId])
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className="flex min-w-0 flex-col gap-3 px-4 py-3 empty:hidden">
    <OrganizationFormRecovery target={target} disabled={disabled || open} onLockChange={onLockChange} onRecovered={onRecovered} />
    {(canManage || open) && <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 self-start rounded-xl" aria-expanded={open} aria-controls={open ? id : undefined}
      disabled={disabled || locked} onClick={() => setOpen(!open)}>Form access</Button>}
    {open && <div id={id}><OrganizationFormReviewAccess target={target} disabled={disabled} onLockChange={onLockChange} /></div>}
  </div>
}
