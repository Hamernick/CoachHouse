"use client"
import type { WorkspaceOverlayDrawerProps } from "./workspace-overlay-drawer-props"

import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react"

import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

import { useWorkspaceDrawerCanvasSize } from "./use-workspace-drawer-canvas-height"
import { useWorkspaceCanvasOverlayDrawerContainer } from "./workspace-canvas-overlay-drawer-container"
import {
  isWorkspaceDataDrawerCollapsedSnapPoint as isDrawerCollapsed,
  isWorkspaceDataDrawerFullscreenSnapPoint as isDrawerFullscreen,
  resolveWorkspaceDataDrawerSnapPoint,
  resolveWorkspaceFloatingDrawerHeight,
  resolveWorkspaceDataDrawerViewportHeight,
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_SNAP_POINTS,
} from "./workspace-canvas-overlay-drawer-state"
import {
  type WorkspaceCanvasDrawerTab,
  useWorkspaceDataDrawerTabIndicator,
} from "./workspace-canvas-overlay-drawer-tabs"
import { WorkspaceDrawerTabs } from "./workspace-canvas-overlay-drawer-tabs-view"
import {
  patchWorkspaceBoardUiPreferences,
  readWorkspaceBoardUiPreferences,
} from "../../workspace-board-ui-preferences"
import { useWorkspaceParticleDrawerRequest } from "./use-workspace-particle-drawer-request"
import { WorkspaceDrawerHeader } from "./workspace-canvas-overlay-drawer-header"
import { useWorkspaceComposerHeight } from "./use-workspace-composer-height"
import { WorkspaceDrawerComposer } from "./workspace-drawer-composer"
import { WorkspaceDrawerTrigger } from "./workspace-canvas-overlay-drawer-trigger"
import {
  DOCK_SHELL_OWNER_PROPS,
  DOCK_FOCUS_HANDLERS,
  FLOATING_PANEL_CLASS,
  floatingShellStyle,
  drawerClassName,
} from "./workspace-drawer-shell"
import { useWorkspaceDrawerControls } from "./use-workspace-drawer-controls"
import { useWorkspaceContentWindow } from "./use-workspace-content-window"
import { useWorkspaceDrawerNavigation } from "./use-workspace-drawer-navigation"

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
    particleInspector,
    particleLibrary,
    particleComposer,
    particleSelectionId,
    particleSelectionKey,
    onCloseParticleInspector,
  }: WorkspaceOverlayDrawerProps) {
    const { composerRef, composerHeight, composerPeek, composerSnaps, chrome } =
      useWorkspaceComposerHeight()
    const canvasContainer = useWorkspaceCanvasOverlayDrawerContainer()
    const { height: canvasHeight, width: canvasWidth } =
      useWorkspaceDrawerCanvasSize(canvasContainer)
    const [preferencesReady, setPreferencesReady] = useState(false)
    const [open, setOpen] = useState(true)
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
    const handledRequestIdRef = useRef(0)
    const handledAcceleratorRequestIdRef = useRef(0)
    const [acceptedRequest, setAcceptedRequest] = useState(request ?? null)
    const drawerContentMounted = Boolean(canvasContainer)
    const drawerCollapsed = open && isDrawerCollapsed(activeSnapPoint)
    const drawerExpanded = open && !isDrawerCollapsed(activeSnapPoint)
    const drawerFullscreen = open && isDrawerFullscreen(activeSnapPoint)
    const floatingHeight = resolveWorkspaceFloatingDrawerHeight(
      canvasHeight,
      activeSnapPoint,
      composerHeight,
      chrome.total
    )
    const dataShortcutLabel = drawerExpanded
      ? "Collapse workspace data"
      : "Open workspace data"
    const handleActiveSnapPointChange = useCallback(
      (nextSnapPoint: SetStateAction<number | string | null>) => {
        setActiveSnapPoint((current) => {
          const resolvedSnapPoint =
            typeof nextSnapPoint === "function"
              ? nextSnapPoint(current)
              : nextSnapPoint
          const storedSnapPoint = resolveWorkspaceDataDrawerSnapPoint(
            resolvedSnapPoint === composerPeek
              ? WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
              : resolvedSnapPoint
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
      [uiPreferencesScope, composerPeek]
    )

    const retainOnParticleClear = useWorkspaceParticleDrawerRequest(
      particleSelectionId,
      particleSelectionKey,
      handleActiveSnapPointChange
    )

    const { handleTabChange, handleTabOpen, leaveParticle } =
      useWorkspaceDrawerNavigation({
        tab,
        activeSnapPoint,
        setTab,
        onSnap: handleActiveSnapPointChange,
        uiPreferencesScope,
        onCloseParticleInspector,
        particleSelectionId,
        retainOnParticleClear,
      })

    const { tabIndicator, tabsHeaderRef, tabsListRef } =
      useWorkspaceDataDrawerTabIndicator({ tab })
    const dockHeight = chrome.total + composerHeight
    const windowState = useWorkspaceContentWindow({
      enabled: Boolean(particleComposer),
      canvasWidth,
      canvasHeight,
      dockHeight,
      activeSnapPoint,
      onSnap: handleActiveSnapPointChange,
      leaveParticle,
      tabsListRef,
    })
    const desktop = Boolean(windowState.geometry)
    useLayoutEffect(() => {
      setPreferencesReady(true)
      const storedPreferences =
        readWorkspaceBoardUiPreferences(uiPreferencesScope)
      if (request) return
      setTab(storedPreferences.dataDrawerTab)
      const storedSnapPoint = resolveWorkspaceDataDrawerSnapPoint(
        storedPreferences.dataDrawerSnapPoint
      )
      if (storedSnapPoint === null) return
      setOpen(true)
      setActiveSnapPoint(storedSnapPoint)
    }, [request, uiPreferencesScope])

    useLayoutEffect(() => {
      if (!request || handledRequestIdRef.current === request.id) return

      handledRequestIdRef.current = request.id
      if (!leaveParticle()) return
      setAcceptedRequest(request)
      setOpen(true)
      setTab(request.tab)
      patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
        dataDrawerTab: request.tab,
      })
      handleActiveSnapPointChange(
        request.tab === "roadmap"
          ? WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT
          : WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
      )
    }, [
      handleActiveSnapPointChange,
      request,
      uiPreferencesScope,
      leaveParticle,
    ])

    const { handleOpenChange, handleDataShortcutClick } =
      useWorkspaceDrawerControls({
        setOpen,
        handleActiveSnapPointChange,
        particleComposer: Boolean(particleComposer),
        drawerCollapsed,
        drawerFullscreen,
      })
    const handleAcceleratorRequestHandled = useCallback((requestId: number) => {
      handledAcceleratorRequestIdRef.current = Math.max(
        handledAcceleratorRequestIdRef.current,
        requestId
      )
    }, [])
    const pendingAcceleratorRequest =
      acceptedRequest?.tab === "accelerator" &&
      acceptedRequest.id > handledAcceleratorRequestIdRef.current
        ? acceptedRequest
        : null

    // Mount Vaul with the restored snap and a measurable canvas, never the
    // temporary collapsed/zero-height startup geometry.
    if (!preferencesReady || canvasHeight <= 0) return null

    return (
      <Drawer
        open={canvasContainer ? open : false}
        onOpenChange={handleOpenChange}
        activeSnapPoint={
          desktop
            ? 1
            : particleComposer && drawerCollapsed
              ? composerPeek
              : activeSnapPoint
        }
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
        snapPoints={
          particleComposer
            ? composerSnaps
            : [...WORKSPACE_DATA_DRAWER_SNAP_POINTS]
        }
        snapToSequentialPoint
        shouldScaleBackground={false}
      >
        <WorkspaceDrawerTrigger
          drawerExpanded={drawerExpanded}
          dataShortcutLabel={dataShortcutLabel}
          handleDataShortcutClick={handleDataShortcutClick}
        />

        {drawerContentMounted ? (
          <DrawerContent
            {...DOCK_SHELL_OWNER_PROPS}
            data-workspace-presentation={desktop ? "window" : "drawer"}
            onEscapeKeyDown={
              desktop
                ? (event) => {
                    if (!event.defaultPrevented) {
                      event.preventDefault()
                      windowState.onMinimize()
                    }
                  }
                : undefined
            }
            {...(particleComposer ? DOCK_FOCUS_HANDLERS : {})}
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
            style={
              particleComposer
                ? {
                    ...floatingShellStyle(canvasHeight),
                    ...(desktop ? { height: dockHeight } : {}),
                  }
                : undefined
            }
            data-workspace-canvas-drawer-fullscreen={
              !desktop && drawerFullscreen ? "true" : undefined
            }
            overlayClassName="pointer-events-none absolute inset-0 !z-10 bg-background/10 backdrop-blur-[1px]"
            className={drawerClassName(
              Boolean(particleComposer),
              !desktop && drawerFullscreen
            )}
          >
            <div
              className={particleComposer ? FLOATING_PANEL_CLASS : "contents"}
            >
              <WorkspaceDrawerHeader
                desktop={desktop}
                compact={!particleComposer}
                onCollapse={handleActiveSnapPointChange}
              />
              <div
                data-workspace-data-drawer-content-viewport="true"
                className={cn(
                  "flex min-h-0 flex-none flex-col",
                  desktop || drawerCollapsed
                    ? "overflow-visible"
                    : "overflow-hidden"
                )}
                style={{
                  height: particleComposer
                    ? `${(desktop ? dockHeight : floatingHeight) - chrome.header - 2}px`
                    : resolveWorkspaceDataDrawerViewportHeight(activeSnapPoint),
                }}
              >
                <WorkspaceDrawerTabs
                  key={`${uiPreferencesScope.orgId}:${uiPreferencesScope.viewerId}`}
                  windowState={windowState}
                  composerMode={Boolean(particleComposer)}
                  bodyOverride={particleInspector}
                  particleLibrary={particleLibrary}
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
                  request={acceptedRequest}
                  tab={tab}
                  tabIndicator={tabIndicator}
                  tabsHeaderRef={tabsHeaderRef}
                  tabsListRef={tabsListRef}
                  uiPreferencesScope={uiPreferencesScope}
                  viewerId={viewerId}
                />
                {particleComposer ? (
                  <WorkspaceDrawerComposer
                    desktop={desktop}
                    composerRef={composerRef}
                    activeSnapPoint={activeSnapPoint}
                    onSnapChange={handleActiveSnapPointChange}
                  >
                    {particleComposer}
                  </WorkspaceDrawerComposer>
                ) : null}
              </div>
            </div>
          </DrawerContent>
        ) : null}
      </Drawer>
    )
  }
)
