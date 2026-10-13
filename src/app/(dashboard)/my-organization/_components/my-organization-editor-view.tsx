"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { OrgProfileCard } from "@/components/organization/org-profile-card"
import type {
  OrgProgram,
  OrgProfile,
  ProfileTab,
} from "@/components/organization/org-profile-card/types"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import { cn } from "@/lib/utils"

type MyOrganizationEditorViewProps = {
  initialProfile: OrgProfile
  people: OrgPersonWithImage[]
  programs: OrgProgram[]
  initialTab?: ProfileTab
  initialProgramId?: string | null
  initialProgramStep?: number | null
  initialFocus?: string | null
  initialEditMode?: boolean
  navigationRequestId?: number
  onProgramEditorOpenChange?: (open: boolean) => void
  canEdit: boolean
  embedded?: boolean
  scrollMode?: "self" | "parent"
}

export function MyOrganizationEditorView({
  initialProfile,
  people,
  programs,
  initialTab,
  initialProgramId,
  initialProgramStep,
  initialFocus,
  initialEditMode = false,
  navigationRequestId,
  onProgramEditorOpenChange,
  canEdit,
  embedded = false,
  scrollMode = "self",
}: MyOrganizationEditorViewProps) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const [hasScrollableOverflow, setHasScrollableOverflow] = useState(false)
  const updateScrollableOverflow = useCallback(() => {
    const viewport = scrollViewportRef.current
    const next = Boolean(
      viewport && viewport.scrollHeight > viewport.clientHeight + 1
    )

    setHasScrollableOverflow((current) => (current === next ? current : next))
  }, [])

  useEffect(() => {
    if (scrollMode === "parent") return
    const viewport = scrollViewportRef.current
    if (!viewport) return

    updateScrollableOverflow()
    const frameId = window.requestAnimationFrame(updateScrollableOverflow)
    window.addEventListener("resize", updateScrollableOverflow)

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollableOverflow)
    resizeObserver?.observe(viewport)
    Array.from(viewport.children).forEach((child) =>
      resizeObserver?.observe(child)
    )

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(updateScrollableOverflow)
    mutationObserver?.observe(viewport, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", updateScrollableOverflow)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [scrollMode, updateScrollableOverflow])

  const profileCard = (
    <OrgProfileCard
      initial={initialProfile}
      people={people}
      programs={programs}
      initialTab={initialTab}
      initialProgramId={initialProgramId}
      initialProgramStep={initialProgramStep}
      initialFocus={initialFocus}
      initialEditMode={initialEditMode}
      navigationRequestId={navigationRequestId}
      onProgramEditorOpenChange={onProgramEditorOpenChange}
      canEdit={canEdit}
    />
  )

  // The drawer tab owns scrolling across its full width, including the gutters.
  if (scrollMode === "parent") return profileCard

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        embedded ? "gap-4" : "gap-5 md:gap-6"
      )}
    >
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <ScrollFadeEffect
          ref={scrollViewportRef}
          enabled={hasScrollableOverflow}
          data-organization-scroll-viewport="true"
          data-scrollable={hasScrollableOverflow ? "true" : undefined}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [--mask-height:1.5rem] [--scroll-buffer:1rem] [-webkit-overflow-scrolling:touch]"
          style={{ scrollbarGutter: "stable" }}
        >
          {profileCard}
        </ScrollFadeEffect>
      </section>
    </div>
  )
}
