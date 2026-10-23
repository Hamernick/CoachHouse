"use client"

import { useMemo, type ComponentProps, type ComponentType, type RefObject, type CSSProperties, type ReactNode } from "react"

import { RichTextEditor } from "@/components/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { RoadmapSectionStatus } from "@/lib/roadmap"

type RichTextEditorProps = ComponentProps<typeof RichTextEditor>

type RoadmapSectionPanelProps = {
  title: string
  subtitle?: string | null
  icon: ComponentType<{ className?: string }>
  headerControlsTop?: ReactNode
  status: RoadmapSectionStatus
  controlsPublicProfile?: boolean
  canEdit?: boolean
  onStatusChange?: (status: RoadmapSectionStatus) => void
  statusSelectDisabled?: boolean
  isHydrated?: boolean
  showHeader?: boolean
  compactHeader?: boolean
  headerVariant?: "default" | "calendar"
  headerIconSize?: number | null
  headerTextRef?: RefObject<HTMLDivElement | null>
  contentMaxWidth?: string
  panelClassName?: string
  toolbarSlotId?: string
  body?: ReactNode
  editorProps?: RichTextEditorProps
}

export function RoadmapSectionPanel({
  title,
  subtitle,
  icon: Icon,
  headerControlsTop,
  status,
  controlsPublicProfile = false,
  canEdit = true,
  onStatusChange,
  statusSelectDisabled = false,
  isHydrated = true,
  showHeader = true,
  compactHeader = false,
  headerVariant = "default",
  headerIconSize = null,
  headerTextRef,
  contentMaxWidth = "max-w-3xl",
  panelClassName,
  toolbarSlotId,
  body,
  editorProps,
}: RoadmapSectionPanelProps) {
  const statusLabel = useMemo(
    () =>
      controlsPublicProfile
        ? status === "complete"
          ? "Public"
          : status === "in_progress"
            ? "Draft"
            : "Not started"
        : status === "complete"
          ? "Complete"
          : status === "in_progress"
            ? "In progress"
            : "Not started",
    [controlsPublicProfile, status],
  )
  const statusDotClass = useMemo(
    () => (status === "complete" ? "bg-emerald-500" : status === "in_progress" ? "bg-amber-500" : "bg-border"),
    [status],
  )
  const headerPaddingClass = headerVariant === "calendar" ? "pt-0" : "pt-2 sm:pt-4"
  const headerTextSpacing = headerVariant === "calendar" ? "space-y-0.5" : "space-y-1"

  const statusControl = (
    !isHydrated ? (
                <Skeleton className="h-7 w-24 rounded-full" />
              ) : canEdit && onStatusChange ? (
                <Select
                  value={status}
                  onValueChange={(value) => onStatusChange(value as RoadmapSectionStatus)}
                  disabled={statusSelectDisabled}
                >
                  <SelectTrigger
                    className={cn("h-7 rounded-full border border-border/60 bg-muted/40 px-2.5 text-xs font-medium text-muted-foreground shadow-none", compactHeader && "min-h-11 gap-1 sm:min-h-8") }
                    aria-label={controlsPublicProfile ? "Core document publication status" : "Roadmap section status"}
                  >
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", statusDotClass)} />
                      <SelectValue placeholder={statusLabel} />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not started</SelectItem>
                    <SelectItem value="in_progress">{controlsPublicProfile ? "Draft" : "In progress"}</SelectItem>
                    <SelectItem value="complete">{controlsPublicProfile ? "Public" : "Complete"}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", statusDotClass)} />
                  {statusLabel}
                </span>
              )
  )

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 overflow-hidden",
        compactHeader && "gap-2",
        panelClassName,
      )}
    >
      {compactHeader ? (
        <div className={cn("mx-auto flex w-full min-w-0 shrink-0 flex-wrap items-center gap-1", contentMaxWidth)}>
          {toolbarSlotId ? <div id={toolbarSlotId} className="min-w-0 flex-1" /> : null}
          {showHeader ? <div className="shrink-0">{statusControl}</div> : null}
        </div>
      ) : showHeader ? (
        <div className={cn("w-full", headerPaddingClass)}>
          <div
            className={cn(
              "mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
              contentMaxWidth,
            )}
          >
            <div
              className="flex flex-col items-start gap-3 sm:flex-row sm:items-start"
              style={headerIconSize ? ({ "--roadmap-header-icon-size": `${headerIconSize}px` } as CSSProperties) : undefined}
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground shadow-sm sm:h-[var(--roadmap-header-icon-size,3rem)] sm:w-[var(--roadmap-header-icon-size,3rem)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div ref={headerTextRef} className={cn("text-left", headerTextSpacing)}>
                {isHydrated ? (
                  <>
                    {title ? (
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                    ) : null}
                    {subtitle ? (
                      <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Skeleton className="h-7 w-48 rounded-full" />
                    <Skeleton className="h-4 w-72 rounded-full" />
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {headerControlsTop ? <div className="w-full sm:w-auto">{headerControlsTop}</div> : null}
              {statusControl}
            </div>
          </div>
        </div>
      ) : null}

      <section className="flex w-full min-h-0 min-w-0 flex-1">
        <div className={cn("mx-auto flex w-full min-h-0 flex-1 flex-col gap-5", compactHeader && "gap-2", contentMaxWidth)}>
          {toolbarSlotId && !compactHeader ? <div id={toolbarSlotId} className="w-full" /> : null}
          {body ?? (editorProps ? <RichTextEditor {...editorProps} /> : null)}
        </div>
      </section>
    </div>
  )
}
