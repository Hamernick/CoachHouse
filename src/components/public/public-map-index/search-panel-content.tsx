"use client"

import type { ReactNode } from "react"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
      {...getReactGrabOwnerProps({
        ownerId: "public-map-search-context-card",
        component: "PublicMapSearchContextCard",
        source: "src/components/public/public-map-index/search-panel-content.tsx",
        tokenSource: "src/components/public/public-map-index/sidebar-theme.ts",
        slot: "card",
      })}
      data-public-map-sidebar-section="search-context-card"
      className={cn(
        "mx-auto w-full max-w-3xl px-3 py-3",
        PUBLIC_MAP_SIDEBAR_CARD_CLASSNAME
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-foreground text-sm font-semibold">
            {context.title}
          </p>
          {context.description ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {context.description}
            </p>
          ) : null}
        </div>
        {context.guideId ? (
          <div className="shrink-0 self-center">
            <PublicMapResourceGuideActions
              guideId={context.guideId}
              guideTitle={context.title}
              onToggleSavedGuide={onToggleSavedGuide}
              saved={savedGuideIds.includes(context.guideId)}
            />
          </div>
        ) : null}
      </div>
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
  const message = hasStaleResourceItems
    ? error === PUBLIC_MAP_RESOURCE_ITEMS_OFFLINE_ERROR
      ? "You’re offline. Showing last loaded results."
      : "Latest results are unavailable. Showing last loaded results."
    : error

  return (
    <Alert className="border-destructive/30 bg-background/45 py-2.5">
      <AlertDescription className="col-start-1 flex w-full flex-row items-center justify-between gap-3">
        <span className="text-pretty">{message}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 rounded-full"
          onClick={onRetry}
        >
          Try again
        </Button>
      </AlertDescription>
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
        scrollable={scrollable}
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
