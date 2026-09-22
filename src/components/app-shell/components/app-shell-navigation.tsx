"use client"

import { lazy, Suspense } from "react"

import { GlobalSearch } from "@/components/app-shell/dynamic-components"
import type { GlobalSearchProps } from "@/components/global-search"
import type { NavUserProps } from "@/components/nav-user"

const AppShellMobileNav = lazy(() =>
  import("./app-shell-mobile-nav").then((module) => ({ default: module.AppShellMobileNav }))
)
const AppShellMapMobileNav = lazy(() =>
  import("./app-shell-map-mobile-nav").then((module) => ({ default: module.AppShellMapMobileNav }))
)

export function AppShellNavigation({
  isMobile,
  showMobileNavigation = true,
  mapNavigation,
  account,
  search,
  showGlobalSearch,
  ...navigation
}: {
  isMobile: boolean
  showMobileNavigation?: boolean
  mapNavigation: boolean
  account: NavUserProps
  search: GlobalSearchProps
  showGlobalSearch: boolean
  showWorkspace: boolean
  onboardingLocked: boolean
  rightOpen: boolean
  onRightOpenChange: (open: boolean) => void
}) {
  return (
    <>
      {isMobile && showMobileNavigation ? (
        <Suspense fallback={null}>
          {mapNavigation ? (
            <AppShellMapMobileNav account={account} search={search} />
          ) : (
            <AppShellMobileNav {...navigation} />
          )}
        </Suspense>
      ) : null}
      {showGlobalSearch && !(mapNavigation && isMobile) ? <GlobalSearch {...search} /> : null}
    </>
  )
}
