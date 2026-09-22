"use client"

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type SetStateAction,
} from "react"
import DatabaseIcon from "lucide-react/dist/esm/icons/database"
import Maximize2Icon from "lucide-react/dist/esm/icons/maximize-2"
import Minimize2Icon from "lucide-react/dist/esm/icons/minimize-2"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import type { DocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Button } from "@/components/ui/button"
import type { WorkspaceAcceleratorCardInput } from "@/features/workspace-accelerator-card"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Toggle } from "@/components/ui/toggle"
import type { RoadmapSection } from "@/lib/roadmap"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

import { useWorkspaceDrawerSnapPoints } from "./use-workspace-drawer-snap-points"
import { useWorkspaceCanvasOverlayDrawerContainer } from "./workspace-canvas-overlay-drawer-container"
import {
  isWorkspaceDataDrawerCollapsedSnapPoint as isDrawerCollapsed,
  isWorkspaceDataDrawerFullscreenSnapPoint as isDrawerFullscreen,
  resolveWorkspaceDataDrawerSnapPoint,
  resolveWorkspaceDataDrawerDisplaySnapPoint,
  resolveWorkspaceDataDrawerStoredSnapPoint,
  resolveWorkspaceDataDrawerViewportHeight,
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"
import {
  type WorkspaceCanvasDrawerTab,
  type WorkspaceDataDrawerRequest,
  useWorkspaceDataDrawerTabIndicator,
} from "./workspace-canvas-overlay-drawer-tabs"
import { WorkspaceDrawerTabs } from "./workspace-canvas-overlay-drawer-tabs-view"
import {
  patchWorkspaceBoardUiPreferences,
  readWorkspaceBoardUiPreferences,
  type WorkspaceBoardUiPreferenceScope,
} from "../../workspace-board-ui-preferences"
import type { WorkspaceOrganizationEditorData } from "../../workspace-board-types"
import type { WorkspacePeopleCanvasActions } from "./workspace-canvas-people-dnd"
const WORKSPACE_CARD_SHORTCUT_BUTTON_SOURCE =
  "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/shortcuts/workspace-card-shortcut-button.tsx"
export const WorkspaceCanvasOverlayDrawer = memo(
  function WorkspaceCanvasOverlayDrawer({
    people,
    placedPersonIds,
    viewerId,
    organizationEditorData,
    financeInput,
    documentsTab,
    acceleratorInput,
    acceleratorRoadmapSections,
    acceleratorHasAccess,
    acceleratorPaywallHref,
    request,
    canEdit,
    uiPreferencesScope,
    peopleCanvasActions,
  }: {
    people: OrgPersonWithImage[]
    placedPersonIds: ReadonlySet<string>
    viewerId: string
    organizationEditorData: WorkspaceOrganizationEditorData
    financeInput: WorkspaceFinanceInput
    documentsTab: DocumentsTabData
    acceleratorInput: WorkspaceAcceleratorCardInput
    acceleratorRoadmapSections: RoadmapSection[]
    acceleratorHasAccess: boolean
    acceleratorPaywallHref: string
    request?: WorkspaceDataDrawerRequest | null
    canEdit: boolean
    uiPreferencesScope: WorkspaceBoardUiPreferenceScope
    peopleCanvasActions: WorkspacePeopleCanvasActions
  }) {
    const canvasContainer = useWorkspaceCanvasOverlayDrawerContainer()
    const [open, setOpen] = useState(true)
    const [hasOpened, setHasOpened] = useState(true)
    const [activeSnapPoint, setActiveSnapPoint] = useState<
      number | string | null
    >(
      request
        ? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
        : WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
    )
    const [tab, setTab] = useState<WorkspaceCanvasDrawerTab>(
      request?.tab ?? "accelerator"
    )
    const isMobile = useIsMobile()
    const mobileParticles = isMobile && tab === "particles"
    const snapPoints = useWorkspaceDrawerSnapPoints(
      canvasContainer,
      mobileParticles
    )
    const handledRequestIdRef = useRef(0)
    const handledAcceleratorRequestIdRef = useRef(0)
    const [, startTabTransition] = useTransition()
    const drawerContentMounted = hasOpened && Boolean(canvasContainer)
    const drawerCollapsed = open && isDrawerCollapsed(activeSnapPoint)
    const drawerExpanded = open && !isDrawerCollapsed(activeSnapPoint)
    const drawerFullscreen = open && isDrawerFullscreen(activeSnapPoint)
    const drawerViewportHeight = resolveWorkspaceDataDrawerViewportHeight(
      activeSnapPoint,
      mobileParticles
    )
    const dataShortcutLabel = drawerExpanded
      ? "Collapse workspace data"
      : "Open workspace data"
    const dataDrawerFullscreenLabel = drawerFullscreen
      ? "Restore data drawer height"
      : "Expand data drawer to full canvas height"
    const DataDrawerFullscreenIcon = drawerFullscreen
      ? Minimize2Icon
      : Maximize2Icon

    const handleActiveSnapPointChange = useCallback(
      (nextSnapPoint: SetStateAction<number | string | null>) => {
        setActiveSnapPoint((current) => {
          const resolvedSnapPoint =
            typeof nextSnapPoint === "function"
              ? nextSnapPoint(current)
              : nextSnapPoint
          const storedSnapPoint = resolveWorkspaceDataDrawerStoredSnapPoint(
            resolvedSnapPoint,
            mobileParticles
          )
          if (storedSnapPoint === null) {
            return current ?? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
          }
          patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
            dataDrawerSnapPoint: storedSnapPoint,
          })
          return storedSnapPoint
        })
      },
      [uiPreferencesScope, mobileParticles]
    )

    useEffect(() => {
      const storedPreferences =
        readWorkspaceBoardUiPreferences(uiPreferencesScope)
      if (request) return
      setTab(storedPreferences.dataDrawerTab)
      const storedSnapPoint = resolveWorkspaceDataDrawerSnapPoint(
        storedPreferences.dataDrawerSnapPoint
      )
      if (storedSnapPoint === null) return
      setOpen(true)
      setHasOpened(true)
      setActiveSnapPoint(storedSnapPoint)
    }, [request, uiPreferencesScope])

    useLayoutEffect(() => {
      if (!request || handledRequestIdRef.current === request.id) return

      handledRequestIdRef.current = request.id
      setOpen(true)
      setHasOpened(true)
      setTab(request.tab)
      patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
        dataDrawerTab: request.tab,
      })
      handleActiveSnapPointChange(
        request.tab === "roadmap"
          ? WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT
          : WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
      )
    }, [handleActiveSnapPointChange, request, uiPreferencesScope])

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (nextOpen) {
          setOpen(true)
          setHasOpened(true)
          handleActiveSnapPointChange(
            (current) => current ?? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
          )
          return
        }

        setOpen(true)
        setHasOpened(true)
        handleActiveSnapPointChange(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)
      },
      [handleActiveSnapPointChange]
    )

    const handleDataShortcutClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        setOpen(true)
        setHasOpened(true)
        handleActiveSnapPointChange((current) =>
          !isDrawerCollapsed(current)
            ? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
            : WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
        )
      },
      [handleActiveSnapPointChange]
    )

    const handleDataDrawerHeaderDoubleClick = useCallback(
      (event: MouseEvent<HTMLDivElement>) => {
        const target = event.target
        if (
          target instanceof Element &&
          target.closest("[data-workspace-data-drawer-fullscreen-trigger]")
        ) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        setOpen(true)
        setHasOpened(true)
        handleActiveSnapPointChange(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)
      },
      [handleActiveSnapPointChange]
    )

    const handleDataDrawerFullscreenChange = useCallback(
      (pressed: boolean) => {
        setOpen(true)
        setHasOpened(true)
        handleActiveSnapPointChange(
          pressed
            ? WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT
            : WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
        )
      },
      [handleActiveSnapPointChange]
    )
    const handleTabChange = useCallback(
      (value: string) => {
        const nextTab = value as WorkspaceCanvasDrawerTab
        patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
          dataDrawerTab: nextTab,
        })
        startTabTransition(() => {
          setTab(nextTab)
        })
      },
      [startTabTransition, uiPreferencesScope]
    )
    const handleTabOpen = useCallback(() => {
      if (!drawerCollapsed) return
      handleActiveSnapPointChange(WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT)
    }, [drawerCollapsed, handleActiveSnapPointChange])
    const handleAcceleratorRequestHandled = useCallback((requestId: number) => {
      handledAcceleratorRequestIdRef.current = Math.max(
        handledAcceleratorRequestIdRef.current,
        requestId
      )
    }, [])
    const pendingAcceleratorRequest =
      request?.tab === "accelerator" &&
      request.id > handledAcceleratorRequestIdRef.current
        ? request
        : null

    const { tabIndicator, tabsHeaderRef, tabsListRef } =
      useWorkspaceDataDrawerTabIndicator({ tab })

    return (
      <Drawer
        open={canvasContainer ? open : false}
        onOpenChange={handleOpenChange}
        activeSnapPoint={resolveWorkspaceDataDrawerDisplaySnapPoint(
          activeSnapPoint,
          mobileParticles
        )}
        direction="bottom"
        container={canvasContainer ?? undefined}
        disablePreventScroll
        dismissible={false}
        fadeFromIndex={2}
        handleOnly
        modal={false}
        noBodyStyles
        repositionInputs={false}
        setActiveSnapPoint={handleActiveSnapPointChange}
        snapPoints={snapPoints}
        snapToSequentialPoint
        shouldScaleBackground={false}
      >
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            {...getReactGrabOwnerProps({
              ownerId: "workspace-card-shortcut:data",
              component: "WorkspaceCardShortcutButton",
              source: WORKSPACE_CARD_SHORTCUT_BUTTON_SOURCE,
              slot: "trigger",
              variant: "data",
              tokenSource:
                "src/components/workspace/workspace-tutorial-theme.ts",
              primitiveImport: "@/components/ui/button",
            })}
            onClick={handleDataShortcutClick}
            className={cn(
              "nodrag nopan text-foreground size-9 h-9 w-9 rounded-xl",
              drawerExpanded &&
                "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground shadow-sm"
            )}
            aria-label={dataShortcutLabel}
            title={dataShortcutLabel}
          >
            <DatabaseIcon className="h-4 w-4" aria-hidden />
          </Button>
        </DrawerTrigger>

        {drawerContentMounted ? (
          <DrawerContent
            data-workspace-canvas-overlay-drawer="true"
            data-workspace-data-drawer-request-step={
              request?.acceleratorStepId ?? undefined
            }
            data-workspace-data-drawer-request-module={
              request?.acceleratorModuleId ?? undefined
            }
            data-workspace-data-drawer-request-roadmap-section={
              request?.roadmapSectionSlug ?? undefined
            }
            showHandle={false}
            data-workspace-canvas-drawer-fullscreen={
              drawerFullscreen ? "true" : undefined
            }
            overlayClassName="pointer-events-none absolute inset-0 !z-10 bg-background/10 backdrop-blur-[1px]"
            className={cn(
              "border-border/70 bg-background/98 absolute right-0 bottom-0 left-0 !z-20 h-full max-h-none w-full max-w-full min-w-0 overflow-hidden p-0 shadow-[0_-24px_70px_-42px_hsl(var(--foreground)/0.55)] backdrop-blur-xl",
              "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-full data-[vaul-drawer-direction=bottom]:max-h-none data-[vaul-drawer-direction=bottom]:rounded-t-[20px]",
              drawerFullscreen && "!z-40"
            )}
          >
            <div
              className="relative grid h-8 shrink-0 grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] items-center px-3"
              onDoubleClick={handleDataDrawerHeaderDoubleClick}
            >
              <DrawerTitle className="sr-only">Workspace drawer</DrawerTitle>
              <DrawerHandle
                preventCycle
                className="bg-foreground/18 col-start-2 mt-0 block !h-[3px] !w-32 justify-self-center rounded-full"
              />
              <Toggle
                type="button"
                size="sm"
                pressed={drawerFullscreen}
                onPressedChange={handleDataDrawerFullscreenChange}
                aria-label={dataDrawerFullscreenLabel}
                title={dataDrawerFullscreenLabel}
                data-workspace-data-drawer-fullscreen-trigger="true"
                className="nodrag nopan text-muted-foreground/70 hover:text-foreground data-[state=on]:text-foreground relative z-10 col-start-3 size-8 min-w-8 translate-y-1 justify-self-end rounded-md bg-transparent px-1.5 transition-colors hover:bg-transparent data-[state=on]:bg-transparent"
              >
                <DataDrawerFullscreenIcon className="h-3.5 w-3.5" aria-hidden />
              </Toggle>
            </div>
            <DrawerDescription className="sr-only">
              Switch between your organization profile, people, documents,
              Particles, Finance, Tools, and Accelerator.
            </DrawerDescription>
            <div
              data-workspace-data-drawer-content-viewport="true"
              className={cn(
                "flex min-h-0 flex-none flex-col",
                drawerCollapsed ? "overflow-visible" : "overflow-hidden"
              )}
              style={{ height: drawerViewportHeight }}
            >
              <WorkspaceDrawerTabs
                acceleratorHasAccess={acceleratorHasAccess}
                acceleratorInput={acceleratorInput}
                acceleratorPaywallHref={acceleratorPaywallHref}
                acceleratorRoadmapSections={acceleratorRoadmapSections}
                canEdit={canEdit}
                documentsTab={documentsTab}
                drawerCollapsed={drawerCollapsed}
                handleAcceleratorRequestHandled={
                  handleAcceleratorRequestHandled
                }
                handleTabOpen={handleTabOpen}
                handleTabChange={handleTabChange}
                peopleCanvasActions={peopleCanvasActions}
                organizationEditorData={organizationEditorData}
                financeInput={financeInput}
                pendingAcceleratorRequest={pendingAcceleratorRequest}
                people={people}
                placedPersonIds={placedPersonIds}
                request={request}
                tab={tab}
                tabIndicator={tabIndicator}
                tabsHeaderRef={tabsHeaderRef}
                tabsListRef={tabsListRef}
                uiPreferencesScope={uiPreferencesScope}
                viewerId={viewerId}
              />
            </div>
          </DrawerContent>
        ) : null}
      </Drawer>
    )
  }
)
