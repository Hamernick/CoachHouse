"use client"

import type { ReactNode } from "react"

import CloudOffIcon from "lucide-react/dist/esm/icons/cloud-off"
import WifiOffIcon from "lucide-react/dist/esm/icons/wifi-off"
import RotateCwIcon from "lucide-react/dist/esm/icons/rotate-cw"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import type { PublicMapResourceGuideId } from "@/lib/public-map/resource-guide-ids"
import { cn } from "@/lib/utils"

import type { PublicMapGroupFilterKey } from "./category-filter"
import type { PublicMapListItem } from "./map-items-state"
import { PublicMapOrganizationList } from "./organization-list"
import { PUBLIC_MAP_SIDEBAR_CARD_CLASSNAME } from "./sidebar-theme"
import { PublicMapResourceGuideActions } from "./resource-guides"
import {
  PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR,
  type PublicMapResourceItemsLoadStatus,
} from "./use-resource-map-items"

export const noopPublicMapSearchAction = () => undefined

export type PublicMapSidebarSearchContext = {
  title: string
  description?: string | null
  guideId?: PublicMapResourceGuideId
  items: PublicMapListItem[]
  onClear: () => void
}

export function PublicMapSearchContextCard({
  context,
  onToggleSavedGuide,
  savedGuideIds = [],
}: {
  context: PublicMapSidebarSearchContext
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  savedGuideIds?: PublicMapResourceGuideId[]
}) {
  return (
    <div
      data-public-map-sidebar-section="search-context-card"
      className={cn(
        "w-full max-w-full px-3 py-3",
        PUBLIC_MAP_SIDEBAR_CARD_CLASSNAME
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-foreground text-sm font-semibold">
            {context.title}
          </p>
          {context.description ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {context.description}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={context.onClear}
        >
          Show all
        </Button>
      </div>
      {context.guideId ? (
        <div className="mt-3 flex justify-end">
          <PublicMapResourceGuideActions
            guideId={context.guideId}
            guideTitle={context.title}
            onToggleSavedGuide={onToggleSavedGuide}
            saved={savedGuideIds.includes(context.guideId)}
          />
        </div>
      ) : null}
    </div>
  )
}

export function PublicMapResourceItemsErrorNotice({
  error,
  hasStaleResourceItems,
  onRetry,
}: {
  error: string | null
  hasStaleResourceItems: boolean
  onRetry: () => void
}) {
  if (!error) return null
  const offline = error === PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR
  const StatusIcon = offline ? WifiOffIcon : CloudOffIcon
  const message = hasStaleResourceItems
    ? `Showing last loaded results. ${offline ? "Reconnect, then try again." : "Try again to refresh."}`
    : offline
      ? "Reconnect to load the remaining results."
      : "You can still browse the available results below."

  return (
    <Alert className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 rounded-2xl border-border/70 bg-muted/25 p-4 shadow-none sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center">
      <span aria-hidden="true" className="text-muted-foreground bg-background/70 flex size-9 items-center justify-center rounded-xl border border-border/60">
        <StatusIcon className="size-4" />
      </span>
      <div className="min-w-0 space-y-1">
        <AlertTitle className="line-clamp-none text-sm leading-5">{offline ? "You’re offline" : "Some results couldn’t load"}</AlertTitle>
        <AlertDescription className="block text-pretty text-xs leading-5">{message}</AlertDescription>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="col-start-2 h-11 justify-self-start rounded-full px-3 shadow-none sm:col-start-3"
        onClick={onRetry}
      >
        <RotateCwIcon className="size-3.5" aria-hidden />
        Try again
      </Button>
    </Alert>
  )
}

export function PublicMapOrganizationsStack({
  activeGroup,
  className,
  constrainedLayout = false,
  items,
  leadingContent,
  onClearCategory,
  onClearQuery,
  onOpenDetails,
  onRetryResourceItems,
  onSelectItem,
  organizations,
  query,
  resourceItemsLoadError = null,
  resourceItemsLoadStatus,
  scrollable = false,
  bounded = false,
  paged = false,
  selectedItemId,
  selectedOrgId = null,
}: {
  activeGroup: PublicMapGroupFilterKey
  className?: string
  constrainedLayout?: boolean
  items: PublicMapListItem[]
  leadingContent?: ReactNode
  onClearCategory: () => void
  onClearQuery: () => void
  onOpenDetails: (orgId: string) => void
  onRetryResourceItems: () => void
  onSelectItem: (itemId: string) => void
  organizations: PublicMapOrganization[]
  query: string
  resourceItemsLoadError?: string | null
  resourceItemsLoadStatus: PublicMapResourceItemsLoadStatus
  scrollable?: boolean
  bounded?: boolean
  paged?: boolean
  selectedItemId: string | null
  selectedOrgId?: string | null
}) {
  return (
    <div
      data-public-map-sidebar-section="organization-stack"
      className={cn(
        "flex w-full max-w-full min-w-0 flex-col gap-3",
        scrollable && "min-h-0 flex-1 overflow-hidden",
        className
      )}
    >
      <PublicMapOrganizationList
        items={items}
        organizations={organizations}
        selectedItemId={selectedItemId}
        selectedOrgId={selectedOrgId}
        query={query}
        activeGroup={activeGroup}
        loadStatus={resourceItemsLoadStatus}
        loadError={resourceItemsLoadError}
        constrainedLayout={constrainedLayout}
        incrementalLoading
        remotePagination
        scrollable={scrollable}
        bounded={bounded}
        paged={paged}
        leadingContent={leadingContent}
        onClearCategory={onClearCategory}
        onClearQuery={onClearQuery}
        onRetryLoad={onRetryResourceItems}
        onSelectItem={onSelectItem}
        onSelectOrg={() => undefined}
        onOpenDetails={onOpenDetails}
      />
    </div>
  )
}
