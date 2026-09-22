"use client"

import type { ReactNode, RefObject } from "react"

import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import { cn } from "@/lib/utils"

type ShellMainContentProps = {
  children: ReactNode
  isAcceleratorContext: boolean
  isMobile: boolean
  showMobileNavigation?: boolean
  hasNestedScrollContent?: boolean
  onboardingRedirectTarget: string | null
  routeTransitionRef: RefObject<HTMLDivElement | null>
  useFlushContentBody: boolean
  useFullBleedContent: boolean
  useMobileSingleGutterContent: boolean
}

export function ShellMainContent({
  children,
  isAcceleratorContext,
  isMobile,
  showMobileNavigation = true,
  hasNestedScrollContent = false,
  onboardingRedirectTarget,
  routeTransitionRef,
  useFlushContentBody,
  useFullBleedContent,
  useMobileSingleGutterContent,
}: ShellMainContentProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col",
        showMobileNavigation
          ? "[--shell-mobile-nav-clearance:calc(5.5rem+env(safe-area-inset-bottom))] md:[--shell-mobile-nav-clearance:0px]"
          : "[--shell-mobile-nav-clearance:env(safe-area-inset-bottom)] md:[--shell-mobile-nav-clearance:0px]"
      )}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--shell-bg)] shadow-none",
          "border-[color:var(--shell-border)] md:rounded-[28px] md:border",
          "rounded-none border-0"
        )}
      >
        <ScrollFadeEffect
          data-shell-scroll
          data-tour-scroll
          data-accelerator-scroll={isAcceleratorContext ? "" : undefined}
          enabled={isMobile && useMobileSingleGutterContent}
          orientation="vertical"
          role="main"
          className={cn(
            "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overscroll-y-contain [scrollbar-gutter:auto] md:[scrollbar-gutter:stable]",
            useFullBleedContent ? "overflow-hidden" : "overflow-y-auto",
            useMobileSingleGutterContent &&
              "[--mask-height:2rem] [--scroll-buffer:1.5rem]"
          )}
        >
          <div
            className={cn(
              "@container/shell flex w-full min-w-0 flex-col",
              useFullBleedContent ? "h-full min-h-0" : "min-h-full",
              !useFullBleedContent &&
                !hasNestedScrollContent &&
                "pb-[var(--shell-mobile-nav-clearance)]"
            )}
          >
            <div
              id="shell-content-header"
              className="border-b border-[color:var(--shell-border)] bg-[var(--shell-card)] px-[var(--shell-content-pad)] py-1 empty:hidden"
            />
            <div
              data-shell-content-body
              data-shell-mode={useFullBleedContent ? "full-bleed" : "default"}
              ref={routeTransitionRef}
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                useFlushContentBody
                  ? "gap-0 px-0 py-0"
                  : "gap-6 px-[var(--shell-content-pad)] py-[var(--shell-content-pad)]",
                useMobileSingleGutterContent &&
                  "max-md:gap-0 max-md:px-0 max-md:py-0"
              )}
            >
              {onboardingRedirectTarget ? (
                <div className="flex min-h-[40svh] flex-1 items-center justify-center px-6 py-16">
                  <p className="text-muted-foreground text-sm">
                    Redirecting to onboarding…
                  </p>
                </div>
              ) : (
                children
              )}
            </div>
            <div
              id="shell-content-footer"
              className="border-t border-[color:var(--shell-border)] bg-[var(--shell-card)] px-[var(--shell-content-pad)] py-3 empty:hidden"
            />
          </div>
        </ScrollFadeEffect>
      </div>
    </div>
  )
}
