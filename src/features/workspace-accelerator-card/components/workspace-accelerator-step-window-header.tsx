"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import {
  WorkspaceWindowHeaderPortal,
  WORKSPACE_HEADER_BUTTON,
} from "@/components/workspace/workspace-window-header-slots"
import type { WorkspaceAcceleratorCardStep } from "../types"

export function WorkspaceAcceleratorStepWindowHeader({
  step,
  stepTitle,
  actions,
  onOverview,
  onModuleOverview,
}: {
  step: WorkspaceAcceleratorCardStep
  stepTitle: string
  actions: ReactNode
  onOverview: () => void
  onModuleOverview: () => void
}) {
  const moduleTitle = step.moduleTitle.trim() || "Module"
  const currentTitle =
    stepTitle.localeCompare(moduleTitle, undefined, {
      sensitivity: "accent",
    }) === 0
      ? step.stepKind.charAt(0).toUpperCase() + step.stepKind.slice(1)
      : stepTitle
  const owner = (slot: string) =>
    getReactGrabOwnerProps({
      ownerId: `workspace-accelerator-step:${step.id}:breadcrumb:${slot}`,
      component: "WorkspaceAcceleratorStepWindowHeader",
      source:
        "src/features/workspace-accelerator-card/components/workspace-accelerator-step-window-header.tsx",
      slot,
    })
  return (
    <>
      <WorkspaceWindowHeaderPortal slot="title">
        <Breadcrumb className="min-w-0" aria-label="Accelerator navigation">
          <BreadcrumbList className="min-w-0 flex-wrap gap-x-1 gap-y-0 text-xs sm:gap-x-1">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Button
                  {...owner("overview")}
                  variant="ghost"
                  className={WORKSPACE_HEADER_BUTTON}
                  onClick={onOverview}
                >
                  Accelerator
                </Button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="max-w-[min(100%,16rem)] min-w-0">
              <BreadcrumbLink asChild>
                <Button
                  {...owner("module")}
                  variant="ghost"
                  className={cn(WORKSPACE_HEADER_BUTTON, "max-w-full min-w-0")}
                  onClick={onModuleOverview}
                  title={moduleTitle}
                >
                  <span className="truncate">{moduleTitle}</span>
                </Button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="max-w-full min-w-0">
              <BreadcrumbPage
                className="truncate text-xs font-medium"
                title={currentTitle}
              >
                {currentTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </WorkspaceWindowHeaderPortal>
      <WorkspaceWindowHeaderPortal>
        <div className="nodrag nopan flex shrink-0 flex-wrap items-center gap-1">
          {actions}
        </div>
      </WorkspaceWindowHeaderPortal>
    </>
  )
}
