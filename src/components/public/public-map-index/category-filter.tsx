"use client"

import {
  PublicMapMoreCategories,
  PUBLIC_MAP_MORE_CATEGORY_KEYS,
} from "./more-categories"
import type { CSSProperties } from "react"

import { Button } from "@/components/ui/button"

import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_COLORS,
  PUBLIC_MAP_RESOURCE_CATEGORY_LABELS,
  PUBLIC_MAP_RESOURCE_CATEGORY_ORDER,
  isPublicMapResourceCategoryKey,
  resolvePublicMapResourceTopLevelCategory,
  type PublicMapResourceCategoryKey,
} from "@/lib/public-map/resource-categories"
import { cn } from "@/lib/utils"
import {
  PublicMapAllCategoryIcon,
  PublicMapResourceCategoryIcon,
} from "./resource-category-icon"
import { PUBLIC_MAP_FILTER_PILL_CLASSNAME } from "./sidebar-theme"

export type PublicMapGroupFilterKey = PublicMapResourceCategoryKey | "all"

export type PublicMapGroupFilterCounts = Record<PublicMapGroupFilterKey, number>

export const PUBLIC_MAP_GROUP_FILTER_ORDER = [
  "all",
  ...PUBLIC_MAP_RESOURCE_CATEGORY_ORDER,
] satisfies PublicMapGroupFilterKey[]

function resolvePublicMapGroupFilterLabel(key: PublicMapGroupFilterKey) {
  return key === "all" ? "All" : PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[key]
}

function resolvePublicMapGroupFilterAccent(key: PublicMapGroupFilterKey) {
  return key === "all"
    ? "hsl(var(--foreground))"
    : PUBLIC_MAP_RESOURCE_CATEGORY_COLORS[key]
}

export function isPublicMapGroupFilterKey(
  value: string | null | undefined
): value is PublicMapGroupFilterKey {
  return value === "all" || isPublicMapResourceCategoryKey(value)
}

export function resolvePublicMapGroupFilterParam(
  value: string | null | undefined
): PublicMapGroupFilterKey {
  return isPublicMapGroupFilterKey(value) ? value : "all"
}

export { buildPublicMapGroupFilterCounts } from "@/lib/public-map/resource-map-counts"

export function PublicMapCategoryFilter({
  activeGroup,
  counts,
  countsAreComplete = false,
  compact = false,
  onActiveGroupChange,
}: {
  activeGroup: PublicMapGroupFilterKey
  counts: PublicMapGroupFilterCounts
  countsAreComplete?: boolean
  compact?: boolean
  onActiveGroupChange: (group: PublicMapGroupFilterKey) => void
}) {
  return (
    <ScrollFadeEffect
      orientation="horizontal"
      className={cn(
        "scroll-fade-effect-x mx-auto flex w-full max-w-3xl min-w-0 gap-1 overflow-x-auto px-1 pb-0.5",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        compact ? "pt-0.5" : "pt-1"
      )}
      style={
        {
          "--mask-width": "1.25rem",
          "--scroll-buffer": "1rem",
        } as CSSProperties
      }
      aria-label="Filter resources by category"
    >
      {PUBLIC_MAP_GROUP_FILTER_ORDER.filter(
        (key) => !PUBLIC_MAP_MORE_CATEGORY_KEYS.includes(key)
      ).map((key) => {
        const selected =
          activeGroup === key ||
          (activeGroup !== "all" &&
            key !== "all" &&
            resolvePublicMapResourceTopLevelCategory(activeGroup) === key)
        const label = resolvePublicMapGroupFilterLabel(key)
        const accent = resolvePublicMapGroupFilterAccent(key)

        return (
          <Button

            key={key}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={selected}
            disabled={countsAreComplete && key !== "all" && counts[key] === 0}
            className={cn(
              PUBLIC_MAP_FILTER_PILL_CLASSNAME,
              "group h-11 shrink-0 gap-1.5 sm:h-7",
              "text-muted-foreground transition-[background-color,border-color,color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "focus-visible:!bg-input/50 focus-visible:ring-ring/45 focus-visible:ring-2 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none",
              selected
                ? "!bg-input/50 text-foreground hover:!bg-input/50 hover:text-foreground focus-visible:text-foreground"
                : "hover:!bg-input/50 hover:text-foreground focus-visible:text-foreground"
            )}
            onClick={() => onActiveGroupChange(key)}
          >
            <span
              key="icon"
              data-public-map-category-filter-icon=""
              className="inline-flex size-4 items-center justify-center"
              aria-hidden
            >
              {key === "all" ? (
                <PublicMapAllCategoryIcon
                  className={cn(
                    "size-3",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )}
                  style={selected ? undefined : { color: accent }}
                />
              ) : (
                <PublicMapResourceCategoryIcon
                  category={key}
                  className={cn(
                    "size-3",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )}
                  style={selected ? undefined : { color: accent }}
                />
              )}
            </span>
            <span key="label">{label}</span>
            {countsAreComplete ? (
              <span className="tabular-nums">
                {counts[key].toLocaleString()}
              </span>
            ) : null}
          </Button>
        )
      })}
      <PublicMapMoreCategories
        activeGroup={activeGroup}
        onActiveGroupChange={onActiveGroupChange}
      />
    </ScrollFadeEffect>
  )
}
