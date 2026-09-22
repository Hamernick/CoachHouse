"use client"

import type { ReactNode } from "react"

import LocateFixedIcon from "lucide-react/dist/esm/icons/locate-fixed"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getReactGrabLinkedSurfaceProps,
  getReactGrabOwnerProps,
} from "@/components/dev/react-grab-surface"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { PublicMapDirectoryStatusPill } from "./directory-status-pill"
import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "./sidebar-theme"
import type {
  PublicMapUserCoordinates,
  UserLocationFeedback,
  UserLocationStatus,
} from "./user-location"

const PUBLIC_MAP_LOCATION_CARD_SOURCE =
  "src/components/public/public-map-index/location-control.tsx"
const PUBLIC_MAP_LOCATION_CARD_OWNER_ID =
  "public-map-location-card:current-location"

export type PublicMapLocationControlState = {
  active: boolean
  coordinates: PublicMapUserCoordinates | null
  controlOpen: boolean
  feedback: UserLocationFeedback
  onConfirm: () => void
  onControlClick: () => void
  onOpenChange: (open: boolean) => void
  status: UserLocationStatus
}

function resolveLocationControlLabel({
  active,
  status,
}: Pick<PublicMapLocationControlState, "active" | "status">) {
  if (active) return "Recenter on my location"
  if (status === "requesting" || status === "checking") {
    return "Finding my location"
  }
  return "Use my location"
}

function resolveLocationFeedbackTitle(
  status: UserLocationStatus,
  isPending: boolean
) {
  if (isPending) return "Finding your location"
  if (status === "denied") return "Location blocked"
  if (status === "timed_out") return "Location timed out"
  return "Location unavailable"
}

export function PublicMapLocationControl({
  active,
  controlOpen,
  directoryCount,
  additionalControls,
  feedback,
  onConfirm,
  onControlClick,
  onOpenChange,
  status,
}: PublicMapLocationControlState & {
  directoryCount: number | null
  additionalControls?: ReactNode
}) {
  const isPending = status === "checking" || status === "requesting"
  const isConsentPrompt = status === "idle" || status === "prompt"
  const label = resolveLocationControlLabel({ active, status })

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        data-public-map-location-controls="true"
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.375rem,env(safe-area-inset-right))] left-[max(0.375rem,env(safe-area-inset-left))] z-20 flex min-w-0 items-center gap-1 md:top-[max(1rem,env(safe-area-inset-top))] md:right-[max(1rem,env(safe-area-inset-right))] md:left-[max(1rem,env(safe-area-inset-left))] md:gap-2"
      >
        <div data-public-map-location-group className="flex shrink-0 items-center gap-1 md:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={label}
                aria-pressed={active}
                aria-busy={isPending}
                aria-expanded={controlOpen}
                aria-controls="public-map-location-card"
                data-public-map-location-trigger
                className={cn(
                  PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
                  "hover:bg-input/50 pointer-events-auto relative size-8 shrink-0 touch-manipulation rounded-full shadow-sm max-md:after:absolute max-md:after:-inset-1",
                  active && "border-blue-500/60 text-blue-600 dark:text-blue-400"
                )}
                onClick={onControlClick}
              >
                <LocateFixedIcon className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {label}
            </TooltipContent>
          </Tooltip>
          <PublicMapDirectoryStatusPill
            count={directoryCount}
            compactOnMobile
            className="whitespace-nowrap"
          />
        </div>
        {additionalControls}
      </div>
      {controlOpen ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4">
          <Card
            {...getReactGrabOwnerProps({
              ownerId: PUBLIC_MAP_LOCATION_CARD_OWNER_ID,
              component: "PublicMapLocationCard",
              source: PUBLIC_MAP_LOCATION_CARD_SOURCE,
              slot: "card",
              primitiveImport: "@/components/ui/card",
              notes:
                "Location consent and status card layered above the public map drawer.",
            })}
            id="public-map-location-card"
            role="dialog"
            aria-modal="false"
            className={cn(
              PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
              "pointer-events-auto w-full max-w-72 rounded-2xl py-0 shadow-lg"
            )}
          >
            <CardContent
              {...getReactGrabLinkedSurfaceProps({
                ownerId: PUBLIC_MAP_LOCATION_CARD_OWNER_ID,
                component: "PublicMapLocationCard",
                source: PUBLIC_MAP_LOCATION_CARD_SOURCE,
                slot: "content",
                surfaceKind: "content",
              })}
              className="p-4"
            >
              {isConsentPrompt ? (
                <>
                  <p className="text-sm font-semibold">Use your location?</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Coach House uses your location to center the map and show
                    local weather. Your location is not saved.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full"
                      onClick={onConfirm}
                    >
                      Use location
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => onOpenChange(false)}
                    >
                      Not now
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    {resolveLocationFeedbackTitle(status, isPending)}
                  </p>
                  {feedback ? (
                    <p
                      className={cn(
                        "mt-1 text-xs leading-relaxed",
                        feedback.tone === "error"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {feedback.message}
                    </p>
                  ) : null}
                  {!isPending ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 rounded-full"
                      onClick={onConfirm}
                    >
                      Try again
                    </Button>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
