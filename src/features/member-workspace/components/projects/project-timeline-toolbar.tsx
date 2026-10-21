"use client"
import {
  CaretLeft,
  CaretRight,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  SidebarSimple,
  ArrowsOut,
  ArrowClockwise,
} from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TIMELINE_MODES,
  formatTimelineDay,
  type TimelineMode,
} from "../../lib/project-timeline"

export function ProjectTimelineToolbar({
  start,
  end,
  mode,
  zoom,
  sidebar,
  onChange,
  onNavigate,
  onToday,
  onFit,
  onRefresh,
}: {
  start: string
  end: string
  mode: TimelineMode
  zoom: number
  sidebar: boolean
  onChange: (values: Record<string, string>) => void
  onNavigate: (direction: number) => void
  onToday: () => void
  onFit: () => void
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b p-2 sm:px-4">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label={sidebar ? "Hide timeline names" : "Show timeline names"}
          aria-pressed={sidebar}
          onClick={() => onChange({ timelineNames: sidebar ? "hide" : "show" })}
        >
          <SidebarSimple />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Previous timeline period"
          onClick={() => onNavigate(-1)}
        >
          <CaretLeft />
        </Button>
        <Button size="sm" variant="ghost" onClick={onToday}>
          Today
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Next timeline period"
          onClick={() => onNavigate(1)}
        >
          <CaretRight />
        </Button>
        <span
          className="text-muted-foreground px-2 text-xs tabular-nums"
          aria-live="polite"
        >
          {formatTimelineDay(start, { month: "short", day: "numeric" })} –{" "}
          {formatTimelineDay(end)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Input
          type="date"
          aria-label="Jump to date"
          className="h-9 w-36"
          value={start}
          onChange={(event) => {
            if (event.currentTarget.value)
              onChange({ timelineDate: event.currentTarget.value })
          }}
        />
        <Select
          value={mode}
          onValueChange={(value) =>
            onChange({ timelineMode: value, timelineZoom: "1" })
          }
        >
          <SelectTrigger aria-label="Timeline scale" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TIMELINE_MODES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Zoom out timeline"
          disabled={zoom <= 0.5}
          onClick={() =>
            onChange({ timelineZoom: String(Math.max(0.5, zoom - 0.25)) })
          }
        >
          <MagnifyingGlassMinus />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Zoom in timeline"
          disabled={zoom >= 2}
          onClick={() =>
            onChange({ timelineZoom: String(Math.min(2, zoom + 0.25)) })
          }
        >
          <MagnifyingGlassPlus />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Fit projects in timeline"
          onClick={onFit}
        >
          <ArrowsOut />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Refresh timeline"
          onClick={onRefresh}
        >
          <ArrowClockwise />
        </Button>
      </div>
    </div>
  )
}
