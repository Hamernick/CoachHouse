"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { updateProgramAction } from "@/actions/programs"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { toast } from "@/lib/toast"

export function ProgramVisibilitySwitch({
  programId,
  title,
  isPublic,
}: {
  programId: string
  title: string
  isPublic: boolean
}) {
  const id = useId()
  const router = useRouter()
  const [checked, setChecked] = useState(isPublic)
  const [pending, startTransition] = useTransition()
  const saving = useRef(false)

  useEffect(() => setChecked(isPublic), [isPublic])

  function handleChange(next: boolean) {
    if (saving.current || (next && !publicSharingEnabled)) return
    saving.current = true
    const previous = checked
    setChecked(next)
    startTransition(async () => {
      try {
        const result = await updateProgramAction(programId, { isPublic: next })
        if ("error" in result) throw new Error(result.error)
        router.refresh()
      } catch {
        setChecked(previous)
        toast.error("Couldn’t update activity visibility. Try again.")
      } finally {
        saving.current = false
      }
    })
  }

  return (
    <div className="flex min-h-11 items-center justify-end gap-3" aria-busy={pending}>
      <Label htmlFor={id} className="text-muted-foreground min-h-11 cursor-pointer text-xs font-medium">
        Show on public profile
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={pending || (!publicSharingEnabled && !checked)}
        onCheckedChange={handleChange}
        aria-label={`Show ${title} on public profile`}
        title={!publicSharingEnabled && !checked ? "Public sharing is not enabled" : undefined}
        className="relative after:absolute after:-inset-y-3 after:-inset-x-1.5"
        {...getReactGrabOwnerProps({
          ownerId: `program-visibility:${programId}`,
          component: "ProgramVisibilitySwitch",
          source: "src/components/organization/org-profile-card/tabs/program-visibility-switch.tsx",
          slot: "trigger",
          primitiveImport: "@/components/ui/switch",
        })}
      />
    </div>
  )
}
