"use client"

import { useId, useRef } from "react"
import SearchIcon from "lucide-react/dist/esm/icons/search"
import XIcon from "lucide-react/dist/esm/icons/x"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  PublicMapCategoryFilter,
  type PublicMapGroupFilterCounts,
  type PublicMapGroupFilterKey,
} from "./category-filter"
import { PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME } from "./sidebar-theme"

export type PublicMapSearchCardProps = {
  query: string
  onQueryChange: (value: string) => void
  onSearchEngage?: () => void
  onSearchCancel?: () => void
  onNavigateResults?: (edge: "first" | "last") => void
  onHidePanel?: () => void
  activeGroup?: PublicMapGroupFilterKey
  groupCounts?: PublicMapGroupFilterCounts
  onActiveGroupChange?: (group: PublicMapGroupFilterKey) => void
  compact?: boolean
  searchPending?: boolean
  showCancel?: boolean
}

export function PublicMapSearchCard({
  query,
  onQueryChange,
  onSearchEngage,
  onSearchCancel,
  onNavigateResults,
  activeGroup = "all",
  groupCounts,
  onActiveGroupChange,
  compact = false,
  searchPending = false,
  showCancel = false,
}: PublicMapSearchCardProps) {
  const showCategoryFilter = Boolean(groupCounts && onActiveGroupChange)
  const searchInputId = useId()
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div
      className={cn(
        "text-card-foreground flex flex-col gap-3 bg-transparent pt-0 pb-3",
        !compact && "border-border/60 border-b"
      )}
    >
      <div className="mx-auto flex w-full max-w-xl items-center gap-2">
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
            value={query}
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
              if (query) {
                onQueryChange("")
                return
              }
              onSearchCancel?.()
            }}
            className={cn(
              cn(
                "placeholder:text-muted-foreground touch-manipulation rounded-full pl-8 text-base max-md:placeholder:text-sm [&::-webkit-search-cancel-button]:appearance-none",
                PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
              ),
              compact ? "h-11 md:h-10" : "h-11",
              query && "pr-10"
            )}
            placeholder="Search resources and organizations…"
            aria-label="Find organizations and resources"
            aria-busy={searchPending}
            autoCapitalize="none"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-full"
              aria-label="Clear search"
              onClick={() => {
                onQueryChange("")
                searchInputRef.current?.focus()
              }}
            >
              <XIcon aria-hidden />
            </Button>
          ) : null}
        </div>
        {showCancel && onSearchCancel ? (
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "text-primary hover:text-primary h-10 shrink-0 rounded-full px-2.5 text-sm font-medium",
              "hover:bg-primary/10 focus-visible:bg-primary/10"
            )}
            onClick={onSearchCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {showCategoryFilter && groupCounts && onActiveGroupChange ? (
        <PublicMapCategoryFilter
          activeGroup={activeGroup}
          counts={groupCounts}
          compact={compact}
          onActiveGroupChange={onActiveGroupChange}
        />
      ) : null}
    </div>
  )
}
