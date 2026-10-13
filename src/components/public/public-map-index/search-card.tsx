"use client"

import { useId, useRef } from "react"
import SearchIcon from "lucide-react/dist/esm/icons/search"
import XIcon from "lucide-react/dist/esm/icons/x"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { PUBLIC_MAP_RESOURCE_CATEGORY_LABELS } from "@/lib/public-map/resource-categories"
import {
  type PublicMapGroupFilterCounts,
  type PublicMapGroupFilterKey,
} from "./category-filter"
import { PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME } from "./sidebar-theme"

export type PublicMapSearchCardProps = {
  query: string
  dock?: boolean
  onQueryChange: (value: string) => void
  onSearchEngage?: () => void
  onSearchCancel?: () => void
  onNavigateResults?: (edge: "first" | "last") => void
  onHidePanel?: () => void
  activeGroup?: PublicMapGroupFilterKey
  groupCounts?: PublicMapGroupFilterCounts
  categoryCountsComplete?: boolean
  onActiveGroupChange?: (group: PublicMapGroupFilterKey) => void
  compact?: boolean
  searchPending?: boolean
  showCancel?: boolean
}

export function PublicMapSearchCard({
  dock = false,
  query,
  onQueryChange,
  onSearchEngage,
  onSearchCancel,
  onNavigateResults,
  activeGroup = "all",
  onActiveGroupChange,
  compact = false,
  searchPending = false,
  showCancel = false,
}: PublicMapSearchCardProps) {
  const canCancel = showCancel && Boolean(onSearchCancel)
  const displayQuery =
    query ||
    (activeGroup === "all" ? "" : PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[activeGroup])
  const clearSearch = () => {
    if (activeGroup !== "all") onActiveGroupChange?.("all")
    onQueryChange("")
  }
  const searchInputId = useId()
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div
      className={cn(
        "text-card-foreground flex flex-col gap-3 bg-transparent pt-0 pb-3",
        !compact && "border-border/60 border-b",
        dock && "pb-0"
      )}
    >
      <div className={cn("mx-auto flex w-full max-w-xl items-center gap-2", dock && "max-w-none")}>
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchInputId} className="sr-only">
            Find organizations and resources
          </label>
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            ref={searchInputRef}
            id={searchInputId}
            data-public-map-search-input="true"
            type="search"
            value={displayQuery}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            onFocus={onSearchEngage}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                onNavigateResults?.(
                  event.key === "ArrowDown" ? "first" : "last"
                )
                return
              }
              if (event.key !== "Escape") return
              event.preventDefault()
              if (displayQuery) {
                clearSearch()
                return
              }
              onSearchCancel?.()
            }}
            className={cn(
              cn(
                "placeholder:text-muted-foreground touch-manipulation rounded-full pl-8 text-base pr-12 [--focus-ring-offset:-3px] [&::-webkit-search-cancel-button]:appearance-none",
                PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
              ),
              compact ? "h-11 sm:h-10" : "h-11",
              dock && "h-12 rounded-full bg-muted/70 sm:h-12"
            )}
            placeholder="Search resources and organizations…"
            aria-label="Find organizations and resources"
            aria-busy={searchPending}
            autoCapitalize="none"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
          />
          {displayQuery || canCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="bg-muted text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-full before:absolute before:-inset-1.5 before:content-['']"
              aria-label={canCancel ? "Cancel search" : "Clear search"}
              onClick={() => {
                if (canCancel) {
                  onSearchCancel?.()
                  return
                }
                clearSearch()
                searchInputRef.current?.focus()
              }}
            >
              <XIcon aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

    </div>
  )
}
