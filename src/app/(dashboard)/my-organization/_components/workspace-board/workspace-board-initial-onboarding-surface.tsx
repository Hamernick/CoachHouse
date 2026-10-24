"use client"

import { useEffect, useRef } from "react"
import { Background, BackgroundVariant, ReactFlow } from "@xyflow/react"

import { OnboardingWorkspaceCard } from "@/components/onboarding/onboarding-workspace-card"

import { WorkspaceCanvasErrorBoundary } from "./workspace-canvas-v2/runtime/workspace-canvas-error-boundary"
import {
  shouldPreventWorkspaceCanvasTouchZoom,
  shouldPreventWorkspaceCanvasWheelZoom,
} from "./workspace-canvas-v2/components/workspace-canvas-surface-v2-gesture-guards"
import type { WorkspaceSeedData } from "./workspace-board-types"

const INITIAL_ONBOARDING_PRO_OPTIONS = Object.freeze({ hideAttribution: true })

export function WorkspaceBoardInitialOnboardingSurface({
  seed,
  onSubmit,
}: {
  seed: WorkspaceSeedData
  onSubmit: (form: FormData) => Promise<void>
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    const handleWheel = (event: WheelEvent) => {
      if (shouldPreventWorkspaceCanvasWheelZoom(event.ctrlKey)) {
        event.preventDefault()
      }
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (shouldPreventWorkspaceCanvasTouchZoom(event.touches.length)) {
        event.preventDefault()
      }
    }
    const handleGestureEvent = (event: Event) => {
      event.preventDefault()
    }
    const listenerOptions = { passive: false, capture: true } as const

    surface.addEventListener("wheel", handleWheel, listenerOptions)
    surface.addEventListener("touchmove", handleTouchMove, listenerOptions)
    surface.addEventListener("gesturestart", handleGestureEvent, listenerOptions)
    surface.addEventListener("gesturechange", handleGestureEvent, listenerOptions)
    surface.addEventListener("gestureend", handleGestureEvent, listenerOptions)

    return () => {
      surface.removeEventListener("wheel", handleWheel, listenerOptions)
      surface.removeEventListener("touchmove", handleTouchMove, listenerOptions)
      surface.removeEventListener("gesturestart", handleGestureEvent, listenerOptions)
      surface.removeEventListener("gesturechange", handleGestureEvent, listenerOptions)
      surface.removeEventListener("gestureend", handleGestureEvent, listenerOptions)
    }
  }, [])

  return (
    <WorkspaceCanvasErrorBoundary>
      <div
        ref={surfaceRef}
        className="workspace-layout-surface relative min-h-[min(820px,calc(100svh-9.5rem))] flex-1 overflow-hidden bg-[#f5f5f5] dark:bg-zinc-800"
      >
        <ReactFlow
          nodes={[]}
          edges={[]}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnPinch
          zoomOnScroll
          zoomOnDoubleClick={false}
          panOnDrag
          preventScrolling
          minZoom={0.35}
          maxZoom={1.25}
          proOptions={INITIAL_ONBOARDING_PRO_OPTIONS}
          className="org-flow workspace-flow"
        >
          <Background
            id="workspace-initial-onboarding-dot-grid"
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.6}
            color={
              seed.presentationMode
                ? "rgba(148, 163, 184, 0.42)"
                : "rgba(148, 163, 184, 0.64)"
            }
          />
        </ReactFlow>
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-8 lg:px-10 lg:py-10">
          <div className="pointer-events-auto flex h-full min-h-full w-full max-w-[480px] items-start justify-center">
            <OnboardingWorkspaceCard
              {...seed.initialOnboarding.defaults}
              mode="workspace_setup"
              onSubmit={onSubmit}
            />
          </div>
        </div>
      </div>
    </WorkspaceCanvasErrorBoundary>
  )
}
