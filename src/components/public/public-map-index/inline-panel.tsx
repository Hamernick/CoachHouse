"use client"

import { createContext, useContext, type ReactNode } from "react"

import {
  PublicMapSearchCard,
  type PublicMapSearchCardProps,
} from "./search-card"
import { usePublicMapSearchKeyboardNavigation } from "./search-keyboard-navigation"

const InlineSearchContext = createContext<ReactNode>(null)

export function usePublicMapInlineSearch() {
  return useContext(InlineSearchContext)
}

export function PublicMapInlinePanel({
  children,
  ...searchProps
}: PublicMapSearchCardProps & { children?: ReactNode }) {
  const { containerRef, focusBoundaryResult, handleResultKeyDown } =
    usePublicMapSearchKeyboardNavigation()

  return (
    <section
      ref={containerRef}
      data-public-map-inline-panel=""
      aria-label="Map results and details"
      className="flex h-full min-h-0 min-w-0 flex-col"
      onKeyDown={handleResultKeyDown}
    >
      <InlineSearchContext.Provider value={
        <div className="shrink-0">
          <PublicMapSearchCard
            {...searchProps}
            dock
            onNavigateResults={focusBoundaryResult}
          />
        </div>
      }>
        {children}
      </InlineSearchContext.Provider>
    </section>
  )
}
