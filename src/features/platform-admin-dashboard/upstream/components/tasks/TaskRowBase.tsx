"use client"

import type { ReactNode } from "react"

import { Checkbox } from "@/features/platform-admin-dashboard/upstream/components/ui/checkbox"
import { cn } from "@/features/platform-admin-dashboard/upstream/lib/utils"

export type TaskRowBaseProps = {
  checked: boolean
  disabled?: boolean
  title: string
  onCheckedChange?: () => void
  titleAriaLabel?: string
  titleSuffix?: ReactNode
  meta?: ReactNode
  className?: string
  subtitle?: ReactNode
}

export function TaskRowBase({
  checked,
  disabled = false,
  title,
  onCheckedChange,
  titleAriaLabel,
  titleSuffix,
  meta,
  className,
  subtitle,
}: TaskRowBaseProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/60 lg:grid lg:grid-cols-[1rem_minmax(0,1fr)_auto] lg:gap-y-0.5",
        className,
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={titleAriaLabel ?? title}
        className="lg:col-start-1 lg:row-start-1 lg:self-center rounded-full border-border bg-background data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600 enabled:hover:cursor-pointer"
      />
      <div className="flex-1 min-w-0 lg:contents">
        <div className="flex items-center gap-2 lg:col-start-2 lg:row-start-1 lg:min-h-7 lg:min-w-0">
          <span
            className={cn(
              "flex-1 truncate text-left max-w-[60vw] sm:max-w-none",
              checked && "line-through text-muted-foreground",
            )}
          >
            {title}
          </span>
          {titleSuffix}
        </div>
        {subtitle && (
          <div
            className={cn(
              "mt-0.5 text-xs text-muted-foreground truncate lg:col-start-2 lg:row-start-2 lg:mt-0 lg:leading-4",
              checked && "line-through opacity-70",
            )}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs shrink-0 ml-2 lg:col-start-3 lg:row-start-1 lg:min-h-7 lg:ml-0">
        {meta}
      </div>
    </div>
  )
}
