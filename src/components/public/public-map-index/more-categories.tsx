"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  PUBLIC_MAP_RESOURCE_CATEGORY_LABELS,
  resolvePublicMapResourceTopLevelCategory,
} from "@/lib/public-map/resource-categories"
import { cn } from "@/lib/utils"
import type { PublicMapGroupFilterKey } from "./category-filter"
import { PUBLIC_MAP_FILTER_PILL_CLASSNAME } from "./sidebar-theme"

export const PUBLIC_MAP_MORE_CATEGORY_KEYS: readonly PublicMapGroupFilterKey[] =
  ["arts", "faith", "recreation", "philanthropy"]

export function PublicMapMoreCategories({
  activeGroup,
  onActiveGroupChange,
}: {
  activeGroup: PublicMapGroupFilterKey
  onActiveGroupChange: (key: PublicMapGroupFilterKey) => void
}) {
  const parent =
    activeGroup === "all"
      ? "all"
      : resolvePublicMapResourceTopLevelCategory(activeGroup)
  const selected = PUBLIC_MAP_MORE_CATEGORY_KEYS.includes(parent)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            PUBLIC_MAP_FILTER_PILL_CLASSNAME,
            "h-11 shrink-0 sm:h-7",
            selected && "!bg-input/50 text-foreground"
          )}

        >
          {selected && parent !== "all"
            ? PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[parent]
            : "More categories"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"

      >
        <DropdownMenuRadioGroup
          value={selected ? parent : ""}
          onValueChange={(key) => {
            if (
              PUBLIC_MAP_MORE_CATEGORY_KEYS.includes(
                key as PublicMapGroupFilterKey
              )
            )
              onActiveGroupChange(key as PublicMapGroupFilterKey)
          }}
        >
          {PUBLIC_MAP_MORE_CATEGORY_KEYS.map((key) =>
            key === "all" ? null : (
              <DropdownMenuRadioItem key={key} value={key} className="min-h-11">
                {PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[key]}
              </DropdownMenuRadioItem>
            )
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
