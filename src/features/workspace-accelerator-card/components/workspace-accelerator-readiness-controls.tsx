"use client"

import { useId } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import CircleIcon from "lucide-react/dist/esm/icons/circle"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getReactGrabLinkedSurfaceProps, getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import type { AcceleratorReadinessChecklistItem, AcceleratorReadinessSummary } from "@/lib/accelerator/readiness"

function ReadinessChecklistButton({ label, items }: {
  label: string
  items?: AcceleratorReadinessChecklistItem[]
}) {
  const titleId = useId()
  const available = Boolean(items?.length)
  const count = items?.filter((item) => item.complete).length ?? 0
  const owner = {
    ownerId: `accelerator-readiness:${titleId}`,
    component: "WorkspaceAcceleratorReadinessControls",
    source: "src/features/workspace-accelerator-card/components/workspace-accelerator-readiness-controls.tsx",
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          {...getReactGrabOwnerProps({ ...owner, slot: "trigger" })}
          variant="ghost"
          size="sm"
          type="button"
          disabled={!available}
          className="h-8 gap-1 rounded-full px-2 text-xs tabular-nums"
        >
          {label}<span aria-hidden> · </span>
          <span className="text-muted-foreground">{available ? `${count}/${items?.length ?? 0} ready` : "Unavailable"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        {...getReactGrabLinkedSurfaceProps({ ...owner, slot: "content", surfaceKind: "content" })}
        align="start"
        aria-labelledby={titleId}
        className="max-h-[min(24rem,var(--radix-popover-content-available-height))] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-3"
      >
        <h3 id={titleId} className="text-sm font-medium">{label} requirements</h3>
        <p className="mt-1 text-xs text-muted-foreground">Organization readiness is separate from lesson completion.</p>
        <ul className="mt-3 space-y-2">
          {items?.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              {item.complete ? <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <CircleIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <span><span className="sr-only">{item.complete ? "Complete: " : "Not complete: "}</span>{item.label}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function WorkspaceAcceleratorReadinessControls({ summary }: {
  summary?: AcceleratorReadinessSummary | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="Organization readiness">
      <ReadinessChecklistButton label="Fundable" items={summary?.fundableChecklist} />
      <ReadinessChecklistButton label="Verified" items={summary?.verifiedChecklist} />
    </div>
  )
}
