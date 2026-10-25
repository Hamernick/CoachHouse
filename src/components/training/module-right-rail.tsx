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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ModuleNotesFields,
  ModuleNotesParticleSource,
  ParticleFrame,
  ParticleHeader,
  ParticleBody,
} from "@/features/workspace-particles/client"
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
  moduleTitle?: string
  resources: ModuleResource[]
  breakHref?: string
  breakLabel?: string
  breakAction?: ModuleRightRailBreakAction
  hasDeck: boolean
}

export function ModuleRightRail({
  moduleId,
  moduleTitle,
  resources,
  breakHref,
  breakLabel = "Return home",
  breakAction,
  hasDeck,
}: ModuleRightRailProps) {
  const [activeTool, setActiveTool] = useState<ToolKey>("notes")
  const normalizedResources = useMemo(
    () => (Array.isArray(resources) ? resources : []),
    [resources]
  )

  return (
    <div className="grid min-h-full grid-rows-[minmax(0,1fr)_auto] gap-3 md:gap-4">
      <div className="min-h-0 overflow-y-auto p-1">
        <div className="space-y-3">
          {activeTool === "notes" ? (
            <ModuleNotesPanel
              key={moduleId}
              moduleId={moduleId}
              moduleTitle={moduleTitle}
            />
          ) : null}
          {activeTool === "resources" ? (
            <ModuleResourcesPanel
              resources={normalizedResources}
              moduleId={moduleId}
              hasDeck={hasDeck}
            />
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

function ModuleNotesPanel({
  moduleId,
  moduleTitle,
}: {
  moduleId: string
  moduleTitle?: string
}) {
  const notes = useModuleNotes(moduleId)
  const title = moduleTitle?.trim() ? `${moduleTitle.trim()} notes` : "Notes"
  return (
    <ModuleNotesParticleSource moduleId={moduleId} title={title}>
      {(action, preview) => (
        <ParticleFrame selected={false}>
          <ParticleHeader
            title={preview ? title : "Notes"}
            icon={<NotebookPenIcon className="size-4" />}
            action={action}
          />
          <ParticleBody>
            <ModuleNotesFields
              value={notes.value}
              onChange={notes.setValue}
              onSave={notes.saveNow}
              isSaving={notes.isSaving}
              loaded={notes.loaded}
              error={notes.error}
              onReload={notes.reload}
              dirty={notes.dirty}
              readOnly={preview}
            />
          </ParticleBody>
        </ParticleFrame>
      )}
    </ModuleNotesParticleSource>
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
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="text-base">Resources</CardTitle>
        <CardDescription className="text-muted-foreground text-xs">
          References and links tied to this module.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 px-0 pt-0 pb-0">
        <ResourcesCard resources={resources} variant="stacked">
          <DeckResourceCard
            moduleId={moduleId}
            hasDeck={hasDeck}
            variant="stacked"
          />
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
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="text-base">Coach Review</CardTitle>
        <CardDescription className="text-muted-foreground text-xs">
          Book time to review this module with a coach.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-0 pt-0 pb-0">
        <div className="border-border/60 bg-background/70 rounded-xl border px-3 py-2">
          <CoachingAvatarGroup size="sm" />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSchedule}
          disabled={pending}
          className="h-11 w-full shadow-none"
        >
          {pending ? "Opening…" : "Schedule a meeting"}
        </Button>
        {tier === "free" && typeof remaining === "number" && remaining > 0 ? (
          <p className="text-muted-foreground text-xs">
            {remaining} included meeting{remaining === 1 ? "" : "s"} remaining.
          </p>
        ) : null}
        {tier === "free" && remaining === 0 ? (
          <p className="text-muted-foreground text-xs">
            Included meetings complete. Future meetings continue through
            checkout.
          </p>
        ) : null}
        {tier === "discounted" ? (
          <p className="text-muted-foreground text-xs">
            Operations Support discount applied to this coaching meeting.
          </p>
        ) : null}
        {tier === "full" ? (
          <p className="text-muted-foreground text-xs">
            Coaching booking opened in a new tab.
          </p>
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
    <div className="border-border/60 bg-background/90 space-y-2 rounded-2xl border p-2 backdrop-blur">
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
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
          >
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={breakAction.onClick}
          >
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
        "group border-border/60 h-11 w-full rounded-xl border text-sm font-medium transition-colors",
        "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        "touch-manipulation",
        isActive && "bg-foreground/5 text-foreground"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-xs tracking-tight">{label}</span>
    </Button>
  )
}
