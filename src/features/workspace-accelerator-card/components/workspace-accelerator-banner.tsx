"use client"

import type { Ref } from "react"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"
import GraduationCapIcon from "lucide-react/dist/esm/icons/graduation-cap"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"

const WORKSPACE_ACCELERATOR_BANNER_SOURCE =
  "src/features/workspace-accelerator-card/components/workspace-accelerator-banner.tsx"

const WORKSPACE_ACCELERATOR_BANNER_OWNER_PROPS = getReactGrabOwnerProps({
  ownerId: "workspace-accelerator:banner",
  component: "WorkspaceAcceleratorBanner",
  source: WORKSPACE_ACCELERATOR_BANNER_SOURCE,
  slot: "root",
  canonicalOwnerSource: WORKSPACE_ACCELERATOR_BANNER_SOURCE,
  canonicalOwnerReason:
    "WorkspaceAcceleratorBanner owns the Accelerator drawer introduction.",
})

export function WorkspaceAcceleratorBanner({ onDismiss, dismissButtonRef }: {
  onDismiss: () => void
  dismissButtonRef?: Ref<HTMLButtonElement>
}) {
  return (
    <section
      {...WORKSPACE_ACCELERATOR_BANNER_OWNER_PROPS}
      className="border-border/70 bg-muted/30 col-span-full flex w-full min-w-0 items-start gap-3 rounded-xl border p-4"
    >
      <span className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70">
        <GraduationCapIcon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="workspace-accelerator-title" className="text-foreground text-sm font-semibold text-balance">
          Get started with the Accelerator
        </h2>
        <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed text-pretty">
          Guided lessons to build your nonprofit’s mission, programs, and funding plan. Choose a lesson below to begin.
        </p>
      </div>
      <Button
        ref={dismissButtonRef}
        type="button"
        variant="ghost"
        size="icon"
        className="-mr-2 -mt-2 size-11 shrink-0 rounded-lg sm:mr-0 sm:mt-0 sm:size-8"
        aria-label="Dismiss Accelerator introduction"
        onClick={onDismiss}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </section>
  )
}
