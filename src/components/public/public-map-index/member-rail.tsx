"use client"

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { buildTabPanelProps, PUBLIC_MAP_MEMBER_TABS_LIST_CLASSNAME, PUBLIC_MAP_MEMBER_TAB_TRIGGER_CLASSNAME, PUBLIC_MAP_INLINE_TAB_TRIGGER_CLASSNAME } from "./member-rail-layout"

import { PublicMapCollectedMenu } from "./collected-menu"
import { PublicMapFloatingSearchDock } from "./floating-search-dock"
import { PublicMapMemberTabTriggers } from "./member-tab-triggers"
import { EmbeddedProfileActiveContext } from "./embedded-profile"

import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  buildPlatformOrganizationMapItem,
  type ExternalResourceMapItem,
} from "@/lib/public-map/resource-map-items"
import type { PublicMapResourceGuideId } from "@/lib/public-map/resource-guide-ids"
import { cn } from "@/lib/utils"

import {
  buildPublicMapGroupFilterCounts,
  type PublicMapGroupFilterKey,
} from "./category-filter"
import {
  filterPublicMapSavedGuides,
  filterPublicMapSavedOrganizations,
  filterPublicMapSavedResources,
} from "./member-rail-filters"
import type { PublicMapDirectoryRailMode } from "./directory-rail"
import { PublicMapOrganizationsRailSection } from "./member-rail-organization-section"
import {
  PublicMapGuidesRail,
  PublicMapResourceGuides,
  type PublicMapResourceGuide,
} from "./resource-guides"
import { PublicMapSearchCard } from "./search-card"
import { usePublicMapInlineSearch } from "./inline-panel"
import type { PublicMapResourceItemsLoadStatus } from "./use-resource-map-items"

export {
  filterPublicMapSavedGuides,
  filterPublicMapSavedOrganizations,
  filterPublicMapSavedResources,
} from "./member-rail-filters"

type PublicMapMemberRailProps = {
  collectedCount?: number
  showGuidesTab?: boolean
  showSavedSearch?: boolean
  activeTab?: PublicMapMemberTab
  directoryHeaderEnd?: ReactNode
  directoryHeaderStart?: ReactNode
  directoryRail?: ReactNode
  directoryMode?: PublicMapDirectoryRailMode | null
  guides?: PublicMapResourceGuide[]
  savedGuideIds?: PublicMapResourceGuideId[]
  savedGuides?: PublicMapResourceGuide[]
  savedOrganizations: PublicMapOrganization[]
  savedResources?: ExternalResourceMapItem[]
  unresolvedCollectedResourceCount?: number
  resourceItemsLoadStatus?: PublicMapResourceItemsLoadStatus
  resourceItemsLoadError?: string | null
  onRetryResourceItems?: () => void
  onActiveTabChange?: (tab: PublicMapMemberTab) => void
  onGuideSelect?: (guideId: string) => void
  onToggleSavedGuide?: (guideId: PublicMapResourceGuideId) => void
  onSelectOrganization: (organizationId: string) => void
  onSelectResource?: (resourceId: string) => void
  onToggleFavorite: (organizationId: string) => void
  onToggleCollectedResource?: (resourceId: string) => void
}

export type PublicMapMemberTab = "directory" | "guides" | "saved"
type PublicMapSavedKind = "all" | "organizations" | "resources" | "guides"

export function PublicMapMemberRail({
  collectedCount,
  showGuidesTab = false,
  showSavedSearch = true,
  activeTab: controlledActiveTab,
  directoryHeaderEnd = null,
  directoryHeaderStart = null,
  directoryRail = null,
  directoryMode = null,
  guides = [],
  savedGuideIds = [],
  savedGuides = [],
  savedOrganizations,
  savedResources = [],
  unresolvedCollectedResourceCount = 0,
  resourceItemsLoadStatus = "ready",
  resourceItemsLoadError = null,
  onRetryResourceItems,
  onActiveTabChange,
  onGuideSelect,
  onToggleSavedGuide,
  onSelectOrganization,
  onSelectResource,
  onToggleFavorite,
  onToggleCollectedResource,
}: PublicMapMemberRailProps) {
  const inlineSearch = usePublicMapInlineSearch()
  const profileActive = useContext(EmbeddedProfileActiveContext)
  const tabClassName = inlineSearch ? PUBLIC_MAP_INLINE_TAB_TRIGGER_CLASSNAME : PUBLIC_MAP_MEMBER_TAB_TRIGGER_CLASSNAME
  const hasDirectoryRail = Boolean(directoryRail)
  const hasGuides = showGuidesTab && Boolean(onGuideSelect)
  const defaultTab: PublicMapMemberTab = hasDirectoryRail
    ? "directory"
    : hasGuides
      ? "guides"
      : "saved"
  const [uncontrolledActiveTab, setUncontrolledActiveTab] =
    useState<PublicMapMemberTab>(defaultTab)
  const requestedTab = controlledActiveTab ?? uncontrolledActiveTab
  const activeTab = requestedTab === "guides" && !hasGuides ? defaultTab : requestedTab
  const setActiveTab = useCallback(
    (nextTab: PublicMapMemberTab) => {
      setUncontrolledActiveTab(nextTab)
      onActiveTabChange?.(nextTab)
    },
    [onActiveTabChange]
  )
  const [savedQuery, setSavedQuery] = useState("")
  const [savedActiveGroup, setSavedActiveGroup] =
    useState<PublicMapGroupFilterKey>("all")
  const [savedKind, setSavedKind] = useState<PublicMapSavedKind>("all")
  const previousHasDirectoryRailRef = useRef(hasDirectoryRail)
  const savedItems = useMemo(
    () => [
      ...savedOrganizations.map(buildPlatformOrganizationMapItem),
      ...savedResources,
    ],
    [savedOrganizations, savedResources]
  )
  const savedGroupCounts = useMemo(
    () => buildPublicMapGroupFilterCounts(savedItems),
    [savedItems]
  )
  const filteredSavedOrganizations = useMemo(
    () =>
      filterPublicMapSavedOrganizations({
        activeGroup: savedActiveGroup,
        query: savedQuery,
        savedOrganizations,
      }),
    [savedActiveGroup, savedOrganizations, savedQuery]
  )
  const filteredSavedResources = useMemo(
    () =>
      filterPublicMapSavedResources({
        activeGroup: savedActiveGroup,
        query: savedQuery,
        savedResources,
      }),
    [savedActiveGroup, savedQuery, savedResources]
  )
  const filteredSavedGuides = useMemo(
    () =>
      filterPublicMapSavedGuides({
        activeGroup: savedActiveGroup,
        guides: savedGuides,
        query: savedQuery,
      }),
    [savedActiveGroup, savedGuides, savedQuery]
  )
  const totalCollected = collectedCount ?? (
    new Set(savedOrganizations.map((organization) => organization.id)).size +
    new Set(savedResources.map((resource) => resource.id)).size +
    Math.max(0, unresolvedCollectedResourceCount) +
    new Set(savedGuideIds).size
  )
  const hasSavedFilters =
    savedQuery.trim().length > 0 ||
    savedActiveGroup !== "all" ||
    savedKind !== "all"
  const showDirectoryHeaderControls =
    activeTab === "directory" &&
    Boolean(directoryHeaderStart || directoryHeaderEnd)

  useEffect(() => {
    const didAddDirectoryRail =
      hasDirectoryRail && !previousHasDirectoryRailRef.current
    previousHasDirectoryRailRef.current = hasDirectoryRail

    if (!hasDirectoryRail) {
      setActiveTab(hasGuides ? "guides" : "saved")
      return
    }
    if (didAddDirectoryRail || directoryMode === "details") {
      setActiveTab("directory")
    }
  }, [directoryMode, hasDirectoryRail, hasGuides, setActiveTab])

  useEffect(() => {
    if (
      savedActiveGroup === "all" ||
      (savedGroupCounts[savedActiveGroup] ?? 0) > 0
    ) {
      return
    }

    setSavedActiveGroup("all")
  }, [savedActiveGroup, savedGroupCounts])

  const handleSelectOrganization = (organizationId: string) => {
    onSelectOrganization(organizationId)
    if (hasDirectoryRail) setActiveTab("directory")
  }
  const handleGuideSelect = (guideId: string) => {
    onGuideSelect?.(guideId)
    if (hasDirectoryRail) setActiveTab("directory")
  }
  const handleSelectResource = (resourceId: string) => {
    onSelectResource?.(resourceId)
    if (hasDirectoryRail) setActiveTab("directory")
  }

  if (inlineSearch) {
    return <>
      <div hidden={profileActive} inert={profileActive || undefined} className={profileActive ? "hidden" : "flex min-h-0 flex-1 flex-col"}>{directoryRail}</div>
      <PublicMapFloatingSearchDock search={inlineSearch} collection={
        <PublicMapCollectedMenu count={totalCollected} items={savedItems} guides={savedGuides}
          unresolvedCount={Math.max(unresolvedCollectedResourceCount, totalCollected - savedItems.length - savedGuides.length)} loading={resourceItemsLoadStatus === "loading"}
          error={resourceItemsLoadError} onRetry={onRetryResourceItems}
          onSelectOrganization={handleSelectOrganization} onSelectResource={handleSelectResource} onSelectGuide={handleGuideSelect} />
      } />
    </>
  }

  return (
    <div
      data-public-map-tabbed-rail=""
      className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden"
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PublicMapMemberTab)}
        className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden", inlineSearch ? "gap-1" : "gap-3")}
      >
        <div
          data-public-map-tab-header=""
          className={cn(
            "grid shrink-0 grid-cols-[minmax(2.75rem,1fr)_auto_minmax(2.75rem,1fr)] items-center gap-1 px-2",
            inlineSearch && "mb-3",
            !showDirectoryHeaderControls && "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
            showDirectoryHeaderControls ? "min-h-11" : inlineSearch ? "h-[54px] sm:h-[42px]" : "h-7"
          )}
        >
          <div className="flex min-w-0 items-center justify-start">
            {showDirectoryHeaderControls ? directoryHeaderStart : null}
          </div>
          <TabsList
            data-public-map-tab-list=""
            variant={inlineSearch ? "default" : "line"}
            className={inlineSearch
              ? "mx-auto w-fit max-w-full min-w-0 shrink-0 justify-center gap-1 self-center rounded-full border bg-background p-1 shadow-none dark:border-input dark:bg-input/30 group-data-[orientation=horizontal]/tabs:h-[54px] sm:group-data-[orientation=horizontal]/tabs:h-[42px]"
              : cn("shrink-0", PUBLIC_MAP_MEMBER_TABS_LIST_CLASSNAME)}
          >
            <PublicMapMemberTabTriggers
              hasDirectory={hasDirectoryRail}
              hasGuides={hasGuides}
              className={tabClassName}
              collectedCount={totalCollected}
            />
          </TabsList>
          <div className="flex min-w-0 items-center justify-end">
            {showDirectoryHeaderControls ? directoryHeaderEnd : null}
          </div>
        </div>

        {inlineSearch}
        <div className={inlineSearch ? "grid min-h-0 min-w-0 flex-1" : "contents"}>
          {hasDirectoryRail ? (
            <TabsContent
              {...buildTabPanelProps("directory", activeTab, Boolean(inlineSearch))}
            >
              {directoryRail}
            </TabsContent>
          ) : null}

          {hasGuides ? (
            <TabsContent
              {...buildTabPanelProps("guides", activeTab, Boolean(inlineSearch))}
            >
              <PublicMapGuidesRail
                guides={guides}
                onGuideSelect={handleGuideSelect}
                onToggleSavedGuide={onToggleSavedGuide}
                savedGuideIds={savedGuideIds}
              />
            </TabsContent>
          ) : null}

          <TabsContent
            {...buildTabPanelProps("saved", activeTab, Boolean(inlineSearch))}
          >
            <div
              data-public-map-member-rail-section="saved-panel"
              className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-3 overflow-hidden"
            >
              {showSavedSearch ? <div
                data-public-map-member-rail-section="saved-search-controls"
                className="shrink-0 px-2.5"
              >
                <PublicMapSearchCard
                  query={savedQuery}
                  onQueryChange={setSavedQuery}
                  activeGroup={savedActiveGroup}
                  groupCounts={savedGroupCounts}
                  onActiveGroupChange={setSavedActiveGroup}
                  compact
                />
              </div> : null}

              <div
                className="mx-2 flex shrink-0 items-center gap-1 overflow-x-auto"
                role="group"
                aria-label="Filter My Map items"
              >
                {(
                  [
                    ["all", "All"],
                    ["organizations", "Organizations"],
                    ["resources", "Resources"],
                    ["guides", "Guides"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-11 shrink-0 touch-manipulation rounded-full px-3 text-xs sm:h-9",
                      savedKind === value && "bg-accent text-accent-foreground"
                    )}
                    aria-pressed={savedKind === value}
                    onClick={() => setSavedKind(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <PublicMapOrganizationsRailSection
                title="My Map"
                icon={
                  <BookmarkIcon
                    className="text-muted-foreground h-4 w-4"
                    aria-hidden
                  />
                }
                organizations={
                  savedKind === "all" || savedKind === "organizations"
                    ? filteredSavedOrganizations
                    : []
                }
                resources={
                  savedKind === "all" || savedKind === "resources"
                    ? filteredSavedResources
                    : []
                }
                leadingContent={
                  (savedKind === "all" || savedKind === "guides") &&
                  filteredSavedGuides.length > 0 ? (
                    <PublicMapResourceGuides
                      guides={filteredSavedGuides}
                      onGuideSelect={handleGuideSelect}
                      onToggleSavedGuide={onToggleSavedGuide}
                      savedGuideIds={savedGuideIds}
                      showHeader={false}
                    />
                  ) : null
                }
                emptyTitle={
                  unresolvedCollectedResourceCount > 0 && !hasSavedFilters
                    ? resourceItemsLoadStatus === "loading"
                      ? "Loading My Map"
                      : "Collected resources unavailable"
                    : hasSavedFilters
                      ? "No saved results"
                      : "Nothing collected yet"
                }
                emptyDescription={
                  unresolvedCollectedResourceCount > 0 && !hasSavedFilters
                    ? resourceItemsLoadStatus === "loading"
                      ? "Your collected resources will appear here."
                      : (resourceItemsLoadError ??
                        "Try again to restore your collected resources.")
                    : hasSavedFilters
                      ? "Try a different search, category, or item filter."
                      : "Collect nonprofits, resources, and guides to keep them here."
                }
                className="mx-2 min-h-0 flex-1 bg-transparent"
                onSelectOrganization={handleSelectOrganization}
                onSelectResource={handleSelectResource}
                onToggleFavorite={onToggleFavorite}
                onToggleCollectedResource={onToggleCollectedResource}
                removable
              />
              {unresolvedCollectedResourceCount > 0 ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="border-border/70 bg-background/80 text-muted-foreground mx-2 flex shrink-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs"
                >
                  <span className="min-w-0 break-words">
                    {resourceItemsLoadStatus === "loading"
                      ? "Loading collected resources…"
                      : (resourceItemsLoadError ??
                        "Some collected resources are temporarily unavailable.")}
                  </span>
                  {resourceItemsLoadStatus === "error" && onRetryResourceItems ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 shrink-0"
                      onClick={onRetryResourceItems}
                    >
                      Try again
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
