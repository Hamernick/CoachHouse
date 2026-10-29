"use client"

import { useWorkspaceDataScope } from "@/features/organization-workspace-support/client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { RailLabel } from "@/components/ui/rail-label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTrackParam } from "@/hooks/use-track-param"
import type { SidebarClass } from "@/lib/academy"
import { isElectiveAddOnModule } from "@/lib/accelerator/elective-modules"
import { getTrackIcon } from "@/lib/accelerator/track-icons"
import { cn } from "@/lib/utils"
import { ModuleStepper, type StepItem, type StepStatus } from "./module-stepper"
import {
  buildVisibleTracks,
  deriveModuleStatus,
  getActiveTrackKey,
  type SidebarTrack,
} from "./classes-section-helpers"

export type ClassesSectionProps = {
  classes?: SidebarClass[]
  isAdmin: boolean
  basePath?: string
  alignHeader?: boolean
  hasAcceleratorAccess?: boolean
  hasElectiveAccess?: boolean
  ownedElectiveModuleSlugs?: string[]
  formationStatus?: string | null
}

export function ClassesSection({
  classes = [],
  isAdmin,
  basePath,
  alignHeader = false,
  hasAcceleratorAccess = false,
  hasElectiveAccess = false,
  ownedElectiveModuleSlugs = [],
  formationStatus = null,
}: ClassesSectionProps) {
  const { storageKey: learningScope } = useWorkspaceDataScope()
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const normalizedBase = basePath?.replace(/\/$/, "") ?? ""
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const visibleTracks = useMemo(() => buildVisibleTracks(classes), [classes])
  const ownedElectiveModuleSlugSet = useMemo(
    () => new Set(ownedElectiveModuleSlugs.map((slug) => slug.trim().toLowerCase())),
    [ownedElectiveModuleSlugs],
  )
  const canAccessPaidLearning = hasAcceleratorAccess || hasElectiveAccess

  const activeKey = useMemo(
    () => getActiveTrackKey({ tracks: visibleTracks, pathname, basePath: normalizedBase }),
    [normalizedBase, pathname, visibleTracks],
  )
  const trackKeys = useMemo(() => visibleTracks.map((track) => track.trackKey), [visibleTracks])
  const formationKey = useMemo(
    () => visibleTracks.find((track) => track.trackKey === "formation")?.trackKey ?? null,
    [visibleTracks],
  )
  const fallbackKey = activeKey ?? (formationStatus === "pre_501c3" ? formationKey : activeKey)
  const { selectedKey, setSelectedKey } = useTrackParam({
    keys: trackKeys,
    fallbackKey,
    paramName: "classTrack",
  })
  const normalizedSelectedKey = trackKeys.includes(selectedKey)
    ? selectedKey
    : undefined

  const selectedTrack = visibleTracks.find((track) => track.trackKey === selectedKey) ?? visibleTracks[0] ?? null
  const SelectedTrackIcon = getTrackIcon(selectedTrack?.trackKey || selectedTrack?.displayTitle)

  const modules = useMemo(
    () => (selectedTrack?.modules.filter((module) => module.published) ?? []),
    [selectedTrack],
  )
  const activeModulePosition =
    selectedTrack
      ? modules.findIndex(
          (module) => `${normalizedBase}/class/${selectedTrack.routeSlug}/module/${module.index}` === pathname,
        )
      : -1
  const activeIdx = activeModulePosition >= 0 ? modules[activeModulePosition]?.index ?? null : null
  const completedMap = new Map<string, boolean>()
  if (typeof window !== "undefined") {
    modules.forEach((module) => {
      try {
        const val = window.sessionStorage.getItem(`module-complete-${learningScope}-${module.id}`)
        completedMap.set(module.id, val === "true")
      } catch {
        completedMap.set(module.id, false)
      }
    })
  }
  const steps: StepItem[] = (() => {
    if (!selectedTrack) return []
    const classLockedByPlan = !isAdmin && selectedTrack.lockState === "requires_paid" && !canAccessPaidLearning
    return modules.map((module) => {
      const moduleHref = `${normalizedBase}/class/${selectedTrack.routeSlug}/module/${module.index}`
      const isCompleted = completedMap.get(module.id) === true
      const moduleLockedByElective =
        !isAdmin &&
        !hasAcceleratorAccess &&
        selectedTrack.trackKey === "electives" &&
        isElectiveAddOnModule(module) &&
        !ownedElectiveModuleSlugSet.has((module.slug ?? "").trim().toLowerCase())
      const status = deriveModuleStatus({
        activeIndex: activeIdx,
        moduleIndex: module.index,
        isAdmin,
        isCompleted,
      })
      const finalStatus = classLockedByPlan || moduleLockedByElective ? ("not_started" as StepStatus) : status
      return {
        id: module.id,
        href: moduleHref,
        title: module.title,
        status: finalStatus,
        active: pathname === moduleHref,
      }
    })
  })()

  if (classes.length === 0) {
    return null
  }

  if (visibleTracks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
        {isAdmin ? "No published sessions yet." : "No accelerator sessions yet."}
      </div>
    )
  }

  if (!selectedTrack) {
    return null
  }

  return (
    <div className="space-y-[var(--shell-rail-gap,1rem)]">
      <div className={cn("space-y-2", alignHeader && "pt-2")}>
        <RailLabel htmlFor="track-picker" className="sr-only">
          Track
        </RailLabel>
        {isMounted ? (
          <Select value={normalizedSelectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger id="track-picker" className="w-full py-2">
              <SelectedTrackIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
              <SelectValue placeholder="Select a track" className="min-w-0 flex-1 text-left text-sm font-medium text-foreground" />
            </SelectTrigger>
            <SelectContent>
              {visibleTracks.map((track) => {
                const TrackIcon = getTrackIcon(track.trackKey || track.displayTitle)
                return (
                  <SelectItem
                    key={track.trackKey}
                    value={track.trackKey}
                    hideIndicator
                    icon={<TrackIcon className="h-4 w-4" aria-hidden />}
                    className="gap-3 py-2"
                  >
                    {track.displayTitle}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-xs">
            {selectedTrack.displayTitle}
          </div>
        )}
        {!canAccessPaidLearning && selectedTrack.trackKey === "electives" ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>Electives are included with paid plans.</span>
            <Link
              href="/organization?paywall=organization&plan=organization&source=sidebar-electives"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Unlock
            </Link>
          </div>
        ) : null}
        {canAccessPaidLearning &&
        !hasAcceleratorAccess &&
        selectedTrack.trackKey === "electives" &&
        ownedElectiveModuleSlugSet.size < modules.length ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>Only previously unlocked electives are available on this account.</span>
            <Link
              href="/organization?paywall=organization&plan=organization&source=sidebar-electives"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Upgrade
            </Link>
          </div>
        ) : null}
        {!canAccessPaidLearning && selectedTrack.lockState === "requires_paid" && selectedTrack.trackKey !== "electives" ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>Unlock this track with a paid plan.</span>
            <Link
              href="/organization?paywall=organization&plan=organization&source=sidebar-learning"
              className="text-foreground underline-offset-4 hover:underline"
            >
              View pricing
            </Link>
          </div>
        ) : null}
      </div>

      {modules.length > 0 ? (
        <div className="space-y-3">
          <ul className="space-y-2 pl-3">
            <ModuleStepper steps={steps} onHover={(href) => router.prefetch(href)} />
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
          No modules available yet.
        </div>
      )}
    </div>
  )
}
