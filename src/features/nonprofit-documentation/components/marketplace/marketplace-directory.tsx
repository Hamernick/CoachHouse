"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import SearchXIcon from "lucide-react/dist/esm/icons/search-x"

import { Empty } from "@/components/ui/empty"

import { useMarketplaceShortlist } from "../../hooks/use-marketplace-shortlist"
import {
  MARKETPLACE_RESOURCES,
  filterMarketplaceResources,
  sanitizeMarketplaceFilters,
} from "../../lib/marketplace-directory"
import type { MarketplaceFilters } from "../../marketplace-types"
import { MarketplaceFiltersPanel } from "./marketplace-filters"
import { MarketplaceResourceCard } from "./marketplace-resource-card"
import { MarketplaceFeatured } from "./marketplace-featured"
import { MarketplaceShortlist } from "./marketplace-shortlist"

function syncFilterUrl(filters: MarketplaceFilters) {
  const url = new URL(window.location.href)
  const values: Array<[string, string]> = [
    ["q", filters.query],
    ["type", filters.type],
    ["function", filters.function],
    ["stage", filters.stage],
    ["cost", filters.cost],
  ]
  for (const [key, value] of values) {
    if (!value || (key !== "q" && value === "all")) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`
  )
}

export function MarketplaceDirectory() {
  const params = useSearchParams()
  const filters = useMemo(
    () =>
      sanitizeMarketplaceFilters({
        query: params.get("q") ?? undefined,
        type: params.get("type") ?? undefined,
        function: params.get("function") ?? undefined,
        stage: params.get("stage") ?? undefined,
        cost: params.get("cost") ?? undefined,
      }),
    [params]
  )
  const shortlist = useMarketplaceShortlist()
  const resources = useMemo(
    () => filterMarketplaceResources(MARKETPLACE_RESOURCES, filters),
    [filters]
  )

  return (
    <section
      id="directory"
      className="scroll-mt-24"
      aria-labelledby="directory-title"
    >
      <h2 id="directory-title" className="sr-only">
        Tools and resources
      </h2>
      <MarketplaceFiltersPanel
        // Preserve spaces during typing; the resource predicate normalizes search.
        filters={{ ...filters, query: (params.get("q") ?? "").slice(0, 100) }}
        onChange={syncFilterUrl}
      />
      <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div>
          <p
            className="text-sm font-medium"
            aria-live="polite"
            data-marketplace-results-count
          >
            {resources.length}{" "}
            {resources.length === 1 ? "resource" : "resources"}
          </p>
          {shortlist.ids.length >= 20 ? (
            <p role="status" className="text-muted-foreground mt-1 text-xs">
              Your saved list holds 20 resources. Remove one to save another.
            </p>
          ) : null}
        </div>
        {!shortlist.persistent ? (
          <p role="status" className="text-muted-foreground text-xs">
            Browser saving is unavailable. Export your list before leaving this
            tab.
          </p>
        ) : null}
        <MarketplaceShortlist
          resources={shortlist.resources}
          ready={shortlist.ready}
          persistent={shortlist.persistent}
          onClear={shortlist.clear}
          onDownload={shortlist.download}
        />
      </div>

      {resources.length > 0 ? (
        <div className="grid auto-rows-fr items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <MarketplaceResourceCard
              key={resource.id}
              resource={resource}
              selected={shortlist.ids.includes(resource.id)}
              disabled={
                !shortlist.ready ||
                (shortlist.ids.length >= 20 &&
                  !shortlist.ids.includes(resource.id))
              }
              onToggle={shortlist.toggle}
            />
          ))}
        </div>
      ) : (
        <Empty
          className="mt-4 min-h-72"
          icon={<SearchXIcon className="size-5" aria-hidden />}
          title="No resources match these filters"
          description="Clear a filter or search for a broader need. Try a provider name or a broader term."
        />
      )}
      <div className="mt-8">
        <MarketplaceFeatured />
      </div>
    </section>
  )
}
