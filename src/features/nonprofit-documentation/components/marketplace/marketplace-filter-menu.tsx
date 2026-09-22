"use client"

import { useState } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  MARKETPLACE_COST_MODELS,
  MARKETPLACE_FUNCTIONS,
  MARKETPLACE_RESOURCE_TYPES,
  MARKETPLACE_STAGES,
} from "../../lib/marketplace-directory"
import type { MarketplaceFilters } from "../../marketplace-types"
import categoryStyles from "./marketplace-category.module.css"

export const MARKETPLACE_FILTER_GROUPS = [
  { key: "type", label: "Category", options: MARKETPLACE_RESOURCE_TYPES },
  { key: "function", label: "Purpose", options: MARKETPLACE_FUNCTIONS },
  { key: "stage", label: "Stage", options: MARKETPLACE_STAGES },
  { key: "cost", label: "Access", options: MARKETPLACE_COST_MODELS },
] as const

export function MarketplaceFilterMenu({
  filters,
  onChange,
}: {
  filters: MarketplaceFilters
  onChange: (filters: MarketplaceFilters) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="min-w-11 rounded-xl px-3"
          aria-label="Browse resource filters"
        >
          <SlidersHorizontalIcon aria-hidden />
          <span className="hidden sm:inline">Filters</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-0"
        aria-label="Resource filters"
      >
        <Command>
          <CommandInput
            placeholder="Find a category, purpose, or stage…"
            aria-label="Find a resource filter"
            className="text-base md:text-sm"
          />
          <CommandList className="max-h-80">
            <CommandEmpty>No matching filters.</CommandEmpty>
            {MARKETPLACE_FILTER_GROUPS.map((group) => (
              <CommandGroup key={group.key} heading={group.label}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${group.label} ${option.label}`}
                    className={cn(
                      "min-h-11 rounded-lg md:min-h-9",
                      categoryStyles.category
                    )}
                    data-category={
                      group.key === "type" ? option.value : undefined
                    }
                    onSelect={() => {
                      onChange({
                        ...filters,
                        [group.key]:
                          filters[group.key] === option.value
                            ? "all"
                            : option.value,
                      })
                      setOpen(false)
                    }}
                  >
                    {group.key === "type" && (
                      <span
                        aria-hidden
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          categoryStyles.dot
                        )}
                      />
                    )}
                    {option.label}
                    {filters[group.key] === option.value && (
                      <CheckIcon className="ml-auto" aria-label="Applied" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
