"use client"

import { useId, useState } from "react"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"

import { Button } from "@/components/ui/button"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_COLORS,
  PUBLIC_MAP_RESOURCE_CATEGORY_LABELS,
  PUBLIC_MAP_RESOURCE_CATEGORY_ORDER,
  type PublicMapResourceCategoryKey,
} from "@/lib/public-map/resource-categories"
import { cn } from "@/lib/utils"

import type {
  PublicMapGroupFilterCounts,
  PublicMapGroupFilterKey,
} from "./category-filter"
import { PublicMapResourceCategoryIcon } from "./resource-category-icon"

type NearbyCategoryDefinition = {
  key: PublicMapResourceCategoryKey
  label: string
}

const PUBLIC_MAP_NEARBY_CATEGORY_GROUPS = [
  {
    label: "Basic needs",
    categories: [
      { key: "food", label: "Food" },
      { key: "food_water", label: "Water" },
      { key: "housing_emergency_shelter", label: "Shelter" },
    ],
  },
  {
    label: "Health",
    categories: [
      { key: "health_primary_care", label: "Primary care" },
      { key: "health_dental", label: "Dental" },
      { key: "health_mental_health", label: "Mental health" },
      { key: "health_senior_health", label: "Senior health" },
    ],
  },
] as const satisfies readonly {
  label: string
  categories: readonly NearbyCategoryDefinition[]
}[]

function PublicMapNearbyCategoryButton({
  category,
  count,
  onSelect,
}: {
  category: NearbyCategoryDefinition
  count: number
  onSelect: (category: PublicMapGroupFilterKey) => void
}) {
  const accent = PUBLIC_MAP_RESOURCE_CATEGORY_COLORS[category.key]

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "border-input bg-white text-foreground hover:bg-input/50 dark:bg-input/30 h-14 min-w-0 justify-start gap-2 rounded-xl border px-2 text-left shadow-none sm:gap-2.5 sm:px-2.5",
        "focus-visible:ring-ring/45 focus-visible:ring-2 motion-reduce:transition-none"
      )}
      aria-label={`${category.label}, ${count.toLocaleString()} ${count === 1 ? "result" : "results"}`}
      onClick={() => onSelect(category.key)}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8"
        style={{ backgroundColor: `${accent}1f`, color: accent }}
        aria-hidden
      >
        <PublicMapResourceCategoryIcon
          category={category.key}
          className="size-4"
        />
      </span>
      <span className="min-w-0 text-sm leading-tight font-medium whitespace-normal sm:truncate">
        {category.label}
      </span>
    </Button>
  )
}

function PublicMapNearbyCategorySkeletons() {
  return (
    <div className="grid grid-cols-2 gap-2" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="border-input bg-input/20 flex h-14 items-center gap-2.5 rounded-xl border px-2.5"
        >
          <span className="bg-muted-foreground/10 size-8 rounded-full" />
          <span className="bg-muted-foreground/10 h-3 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function PublicMapNearbyCategoryGrid({
  counts,
  loading,
  onSelect,
}: {
  counts: PublicMapGroupFilterCounts
  loading: boolean
  onSelect: (category: PublicMapGroupFilterKey) => void
}) {
  const allCategoriesId = useId()
  const [showAllCategories, setShowAllCategories] = useState(true)
  const availableTopLevelCategories = PUBLIC_MAP_RESOURCE_CATEGORY_ORDER.filter(
    (key) => key !== "emergency" && counts[key] > 0
  )

  return (
    <div className="flex flex-col gap-4">
      {PUBLIC_MAP_NEARBY_CATEGORY_GROUPS.map((group) => {
        const availableCategories = group.categories.filter(
          (category) => counts[category.key] > 0
        )

        if (availableCategories.length === 0 && !loading) return null

        return (
          <section key={group.label} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground px-0.5 text-xs font-semibold tracking-wide uppercase">
              {group.label}
            </h3>
            {availableCategories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {availableCategories.map((category) => (
                  <PublicMapNearbyCategoryButton
                    key={category.key}
                    category={category}
                    count={counts[category.key]}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ) : (
              <PublicMapNearbyCategorySkeletons />
            )}
          </section>
        )
      })}

      {availableTopLevelCategories.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-11 w-full justify-between rounded-xl px-2.5 text-sm"
            aria-controls={allCategoriesId}
            aria-expanded={showAllCategories}
            onClick={() => setShowAllCategories((current) => !current)}
          >
            <span>All categories</span>
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform duration-200 motion-reduce:transition-none",
                showAllCategories && "rotate-180"
              )}
              aria-hidden
            />
          </Button>
          {showAllCategories ? (
            <div id={allCategoriesId} className="grid grid-cols-2 gap-2">
              {availableTopLevelCategories.map((key) => (
                <PublicMapNearbyCategoryButton
                  key={key}
                  category={{
                    key,
                    label: PUBLIC_MAP_RESOURCE_CATEGORY_LABELS[key],
                  }}
                  count={counts[key]}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
