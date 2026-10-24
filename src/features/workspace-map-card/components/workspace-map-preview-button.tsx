"use client"

import { Button } from "@/components/ui/button"
import { WorkspaceTutorialCallout } from "@/components/workspace/workspace-tutorial-callout"
import { cn } from "@/lib/utils"

import { useWorkspaceMapCardController } from "../hooks/use-workspace-map-card-controller"
import type { WorkspaceMapCardInput } from "../types"

type WorkspaceMapPreviewButtonProps = {
  input: WorkspaceMapCardInput
  highlighted?: boolean
  onOpen: () => void
}

export function WorkspaceMapPreviewButton({
  input,
  highlighted = false,
  onOpen,
}: WorkspaceMapPreviewButtonProps) {
  const { previewUrl, locationLabel } = useWorkspaceMapCardController({
    input,
    previewWidth: 96,
    previewHeight: 96,
  })

  return (
    <div className="relative shrink-0">
      {highlighted ? (
        <WorkspaceTutorialCallout
          calloutId="workspace-map-preview-button:callout"
          mode="indicator"
          tapHereLabel="Open the Map"
          indicatorOffsetY={-2}
        />
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Open map"
        title="Open map"
        onClick={onOpen}
        className={cn(
          "relative size-7 overflow-hidden rounded-lg border border-border/70 bg-muted/55 p-0 shadow-none",
          "transition-[transform,box-shadow,border-color] duration-200 ease-out",
          highlighted &&
            "border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.22)]",
        )}
      >
        {previewUrl ? (
          <span
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${previewUrl})` }}
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--border)_42%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--border)_42%,transparent)_1px,transparent_1px)] bg-[size:10px_10px]"
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,transparent_0%,transparent_26%,rgba(15,23,42,0.22)_100%)]"
        />
        <span className="sr-only">
          {locationLabel ? `Open the map for ${locationLabel}` : "Open the map"}
        </span>
      </Button>
    </div>
  )
}
