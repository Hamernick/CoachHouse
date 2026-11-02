"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import NotebookPenIcon from "lucide-react/dist/esm/icons/notebook-pen"
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open"
import CalendarCheckIcon from "lucide-react/dist/esm/icons/calendar-check"
import HomeIcon from "lucide-react/dist/esm/icons/home"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"

import { CoachingAvatarGroup } from "@/components/coaching/coaching-avatar-group"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ResourcesCard } from "@/components/training/resources-card"
import { DeckResourceCard } from "@/components/training/deck-resource-card"
import type { ModuleResource } from "@/components/training/types"
import { useCoachingBooking } from "@/hooks/use-coaching-booking"
import { useModuleNotes } from "@/hooks/use-module-notes"
import type { CoachingTier } from "@/lib/meetings"
import { cn } from "@/lib/utils"

type ToolKey = "notes" | "resources" | "coach"

type ModuleRightRailBreakAction =
  | {
      kind: "link"
      href: string
      label?: string
    }
  | {
      kind: "button"
      label: string
      onClick: () => void
    }

type ModuleRightRailProps = {
  moduleId: string
  resources: ModuleResource[]
  breakHref?: string
  breakLabel?: string
  breakAction?: ModuleRightRailBreakAction
  hasDeck: boolean
}

export function ModuleRightRail({
  moduleId,
  resources,
  breakHref,
  breakLabel = "Return home",
  breakAction,
  hasDeck,
}: ModuleRightRailProps) {
  const [activeTool, setActiveTool] = useState<ToolKey>("notes")
  const normalizedResources = useMemo(() => (Array.isArray(resources) ? resources : []), [resources])

  return (
    <div className="grid min-h-full grid-rows-[minmax(0,1fr)_auto] gap-3 md:gap-4">
      <div className="min-h-0 overflow-y-auto p-1">
        <div className="space-y-3">
        {activeTool === "notes" ? <ModuleNotesPanel moduleId={moduleId} /> : null}
        {activeTool === "resources" ? (
          <ModuleResourcesPanel resources={normalizedResources} moduleId={moduleId} hasDeck={hasDeck} />
        ) : null}
        {activeTool === "coach" ? <ModuleCoachPanel /> : null}
        </div>
      </div>
      <ModuleToolTray
        activeTool={activeTool}
        onToolChange={setActiveTool}
        breakAction={
          breakAction ??
          (breakHref
            ? {
                kind: "link",
                href: breakHref,
                label: breakLabel,
              }
            : null)
        }
      />
    </div>
  )
}

function ModuleNotesPanel({ moduleId }: { moduleId: string }) {
  const { value, setValue, saveNow, isSaving, loadState, error, retryLoad, savedValue, resolveConflict } = useModuleNotes(moduleId)

  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pb-2 pt-0">
        <CardTitle className="text-base">Notes</CardTitle>
        {isSaving ? (
          <CardDescription className="text-xs text-muted-foreground">Saving…</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-0">
        <Textarea
          name={`module-notes-${moduleId}`}
          aria-label="Lesson notes"
          disabled={loadState === "loading" || loadState === "error"}
          readOnly={loadState === "conflict"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            void saveNow()
          }}
          placeholder="Capture key ideas, quotes, or next steps…"
          className="min-h-[180px] resize-none text-sm shadow-none"
          spellCheck
          autoComplete="off"
        />
        <div aria-live="polite" className="mt-2 space-y-2 text-xs text-muted-foreground">
          {loadState === "loading" ? <p>Loading notes…</p> : null}
          {error ? <p>{error}</p> : null}
          {loadState === "error" ? <Button size="sm" variant="outline" onClick={() => void retryLoad()}>Retry loading</Button> : null}
          {error && loadState === "ready" ? <Button size="sm" variant="outline" disabled={isSaving} onClick={() => void saveNow()}>Retry saving</Button> : null}
          {loadState === "conflict" ? <>
            <p>Notes changed elsewhere. Your draft is shown above. Choose which version to keep.</p>
            <Textarea aria-label="Saved notes" value={savedValue} readOnly />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => resolveConflict(true)}>Use my draft</Button>
              <Button size="sm" variant="outline" onClick={() => resolveConflict(false)}>Use saved notes</Button>
            </div>
          </> : null}
        </div>
      </CardContent>
    </Card>
  )
}

function ModuleResourcesPanel({
  resources,
  moduleId,
  hasDeck,
}: {
  resources: ModuleResource[]
  moduleId: string
  hasDeck: boolean
}) {
  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pb-2 pt-0">
        <CardTitle className="text-base">Resources</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          References and links tied to this module.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 px-0 pb-0 pt-0">
        <ResourcesCard resources={resources} variant="stacked">
          <DeckResourceCard moduleId={moduleId} hasDeck={hasDeck} variant="stacked" />
        </ResourcesCard>
      </CardContent>
    </Card>
  )
}

function ModuleCoachPanel() {
  const { schedule, pending } = useCoachingBooking()
  const [tier, setTier] = useState<CoachingTier | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const handleSchedule = async () => {
    const payload = await schedule()
    if (payload?.tier) {
      setTier(payload.tier)
    }
    if (payload?.remaining === null || typeof payload?.remaining === "number") {
      setRemaining(payload?.remaining ?? null)
    }
  }

  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pb-2 pt-0">
        <CardTitle className="text-base">Coach Review</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Book time to review this module with a coach.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-0 space-y-3">
        <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
          <CoachingAvatarGroup size="sm" />
        </div>
        <Button type="button" size="sm" onClick={handleSchedule} disabled={pending} className="h-11 w-full shadow-none">
          {pending ? "Opening…" : "Schedule a meeting"}
        </Button>
        {tier === "free" && typeof remaining === "number" && remaining > 0 ? (
          <p className="text-xs text-muted-foreground">
            {remaining} included meeting{remaining === 1 ? "" : "s"} remaining.
          </p>
        ) : null}
        {tier === "free" && remaining === 0 ? (
          <p className="text-xs text-muted-foreground">
            Included meetings complete. Future meetings continue through checkout.
          </p>
        ) : null}
        {tier === "discounted" ? (
          <p className="text-xs text-muted-foreground">
            Operations Support discount applied to this coaching meeting.
          </p>
        ) : null}
        {tier === "full" ? (
          <p className="text-xs text-muted-foreground">Coaching booking opened in a new tab.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ModuleToolTray({
  activeTool,
  onToolChange,
  breakAction,
}: {
  activeTool: ToolKey
  onToolChange: (tool: ToolKey) => void
  breakAction: ModuleRightRailBreakAction | null
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-background/90 p-2 backdrop-blur">
      <div className="grid grid-cols-2 gap-2 [&>button:last-child]:col-span-2">
        <ToolTrayButton
          icon={NotebookPenIcon}
          label="Notes"
          isActive={activeTool === "notes"}
          onClick={() => onToolChange("notes")}
        />
        <ToolTrayButton
          icon={FolderOpenIcon}
          label="Resources"
          isActive={activeTool === "resources"}
          onClick={() => onToolChange("resources")}
        />
        <ToolTrayButton
          icon={CalendarCheckIcon}
          label="Coach"
          isActive={activeTool === "coach"}
          onClick={() => onToolChange("coach")}
        />
      </div>
      {breakAction ? (
        breakAction.kind === "link" ? (
          <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
            <Link href={breakAction.href}>
              {breakAction.label === "Return" ? (
                <ArrowLeftIcon className="h-4 w-4" aria-hidden />
              ) : (
                <HomeIcon className="h-4 w-4" aria-hidden />
              )}
              {breakAction.label ?? "Return home"}
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={breakAction.onClick}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden />
            {breakAction.label}
          </Button>
        )
      ) : null}
    </div>
  )
}

function ToolTrayButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: typeof NotebookPenIcon
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "group h-11 w-full rounded-xl border border-border/60 text-sm font-medium transition-colors",
        "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        "touch-manipulation",
        isActive && "bg-foreground/5 text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-xs tracking-tight">{label}</span>
    </Button>
  )
}
