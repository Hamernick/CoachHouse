"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { OrganizationFormRecovery } from "./organization-form-recovery"
import { OrganizationFormReviewAccess } from "./organization-form-review-access"

export function OrganizationFormSourceSharing({ organizationId, formId, canManage, disabled, locked, onLockChange, onRecovered }: {
  organizationId: string; formId: string; canManage: boolean; disabled: boolean; locked: boolean; onLockChange: (locked: boolean) => void; onRecovered: () => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className="flex min-w-0 flex-col gap-3 px-4 py-3 empty:hidden">
    <OrganizationFormRecovery target={{ organizationId, formId }} disabled={disabled || open} onLockChange={onLockChange} onRecovered={onRecovered} />
    {(canManage || open) && <Button type="button" variant="outline" className="min-h-11 self-start rounded-xl" aria-expanded={open} aria-controls={open ? id : undefined}
      disabled={disabled || locked} onClick={() => setOpen(!open)}>Form access</Button>}
    {open && <div id={id}><OrganizationFormReviewAccess target={{ organizationId, formId }} disabled={disabled} onLockChange={onLockChange} /></div>}
  </div>
}
