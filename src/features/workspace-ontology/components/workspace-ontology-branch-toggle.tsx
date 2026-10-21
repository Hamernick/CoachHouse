"use client"

import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import ListTreeIcon from "lucide-react/dist/esm/icons/list-tree"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { WorkspaceOntologyRootControl } from "../types"

export function resolveWorkspaceOntologyBranchTogglePresentation(
  control: Pick<
    WorkspaceOntologyRootControl,
    | "attentionCount"
    | "completedCount"
    | "descendantCount"
    | "expanded"
    | "mode"
  >
) {
  const completedCount = Math.min(
    Math.max(control.completedCount, 0),
    control.descendantCount
  )
  const remainingCount = Math.max(control.descendantCount - completedCount, 0)
  const prioritySuffix =
    control.attentionCount > 0
      ? `, including ${control.attentionCount} ${control.attentionCount === 1 ? "priority" : "priorities"}`
      : ""
  const activeCount =
    control.attentionCount > 0 ? control.attentionCount : remainingCount

  if (control.mode === "map") {
    return {
      actionLabel: "Focus",
      count: activeCount,
      accessibleLabel: `Focus this branch with ${remainingCount} remaining items${prioritySuffix}`,
    }
  }
  if (control.expanded) {
    return {
      actionLabel: "Hide setup",
      count: control.descendantCount,
      accessibleLabel: `Hide ${control.descendantCount} setup items`,
    }
  }
  if (completedCount === 0) {
    return {
      actionLabel: "Start setup",
      count: activeCount,
      accessibleLabel: `Start setup with ${remainingCount} items${prioritySuffix}`,
    }
  }
  if (remainingCount > 0) {
    return {
      actionLabel: "Finish setup",
      count: activeCount,
      accessibleLabel: `Finish ${remainingCount} remaining setup items${prioritySuffix}`,
    }
  }
  return {
    actionLabel: "Review setup",
    count: control.descendantCount,
    accessibleLabel: `Review ${control.descendantCount} completed setup items`,
  }
}

export function WorkspaceOntologyBranchToggle({
  label,
  control,
}: {
  label: string
  control: WorkspaceOntologyRootControl
}) {
  const presentation = resolveWorkspaceOntologyBranchTogglePresentation(control)
  const setupComplete =
    control.descendantCount > 0 &&
    control.completedCount >= control.descendantCount
  return (
    <Button

      type="button"
      variant="outline"
      size="sm"
      className="group/branch workspace-ontology-branch-toggle nodrag nopan bg-background text-foreground hover:bg-background hover:text-foreground dark:bg-background dark:hover:bg-background h-12 touch-manipulation gap-1.5 rounded-full pr-3 pl-0.5 text-sm shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none sm:h-10 sm:pr-2.5 sm:pl-0.5"
      data-workspace-ontology-branch-toggle="true"
      data-state={control.expanded ? "expanded" : "collapsed"}
      aria-label={`${label}: ${presentation.accessibleLabel}`}
      aria-expanded={control.expanded}
      onClick={control.onToggle}
      onKeyDown={(event) => {
        if (event.key !== " ") return
        event.preventDefault()
        event.stopPropagation()
        control.onToggle()
      }}
    >
      <span
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          setupComplete
            ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
            : "bg-orange-500/15 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
          control.expanded &&
            (setupComplete
              ? "scale-105 bg-emerald-500/25 dark:bg-emerald-400/25"
              : "scale-105 bg-orange-500/25 dark:bg-orange-400/25")
        )}
        aria-hidden="true"
      >
        <ListTreeIcon className="size-4" />
      </span>
      <span
        key={presentation.actionLabel}
        className="motion-safe:animate-[workspace-ontology-toggle-label-in_180ms_cubic-bezier(0.22,1,0.36,1)_both]"
      >
        {presentation.actionLabel}
      </span>
      <span
        key={presentation.count}
        data-workspace-ontology-branch-count="true"
        className={cn(
          "min-w-5 text-right text-xs font-semibold tabular-nums motion-safe:animate-[workspace-ontology-toggle-label-in_180ms_cubic-bezier(0.22,1,0.36,1)_both]",
          setupComplete
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-orange-700 dark:text-orange-300"
        )}
        aria-hidden="true"
      >
        {presentation.count}
      </span>
      <ChevronDownIcon
        className={cn(
          "size-4 transition-transform duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          control.expanded && "rotate-180"
        )}
        aria-hidden="true"
      />
    </Button>
  )
}
