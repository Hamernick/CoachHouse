"use client"

import { useId } from "react"
import BadgeCheckIcon from "lucide-react/dist/esm/icons/badge-check"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import CircleIcon from "lucide-react/dist/esm/icons/circle"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import type { AcceleratorReadinessChecklistItem, AcceleratorReadinessSummary } from "@/lib/accelerator/readiness"

function ReadinessChecklistButton({ label, items, qualified = false }: {
  label: "Verified" | "Fundable"
  qualified?: boolean
  items?: AcceleratorReadinessChecklistItem[]
}) {
  const titleId = useId()
  const available = Boolean(items?.length)
  const count = items?.filter((item) => item.complete).length ?? 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button

          variant="ghost"
          size="sm"
          type="button"
          disabled={!available}
          className="h-8 gap-1 rounded-full px-2 text-xs tabular-nums"
        >
          {qualified ? <BadgeCheckIcon aria-hidden className={label === "Verified" ? "size-4 text-blue-600 dark:text-blue-400" : "size-4 text-emerald-600 dark:text-emerald-400"} /> : null}
          {label}<span aria-hidden> · </span>
          <span className="text-muted-foreground">{available ? `${count}/${items?.length ?? 0} ready` : "Unavailable"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent

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
      <ReadinessChecklistButton label="Fundable" items={summary?.fundableChecklist} qualified={summary?.fundable} />
      <ReadinessChecklistButton label="Verified" items={summary?.verifiedChecklist} qualified={summary?.verified} />
    </div>
  )
}
