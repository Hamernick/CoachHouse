"use client"
import {
  useWorkspaceDrawerGuide,
  useWorkspaceDrawerGuideState,
} from "./use-workspace-drawer-guide"
import type { WorkspaceOverlayDrawerProps } from "./workspace-overlay-drawer-props"

import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react"

import { WorkspaceDockHost } from "./workspace-dock-host"
import { cn } from "@/lib/utils"

import { useWorkspaceDrawerCanvasSize } from "./use-workspace-drawer-canvas-height"
import { useWorkspaceCanvasOverlayDrawerContainer } from "./workspace-canvas-overlay-drawer-container"
import {
  isWorkspaceDataDrawerCollapsedSnapPoint as isDrawerCollapsed,
  isWorkspaceDataDrawerFullscreenSnapPoint as isDrawerFullscreen,
  resolveWorkspaceDataDrawerSnapPoint,
  resolveWorkspaceDataDrawerRequestSnapPoint,
  resolveWorkspaceDataDrawerViewportHeight,
  WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT,
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
  FLOATING_PANEL_CLASS,
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
    particleInspectorTitle,
    particleInspectorMaxWidth,
    particleLibrary,
    particleComposer,
    particleSelectionId,
    particleSelectionKey,
    onCloseParticleInspector,
  }: WorkspaceOverlayDrawerProps) {
    const { composerRef, composerHeight, composerPeek, chrome } =
      useWorkspaceComposerHeight()
    const canvasContainer = useWorkspaceCanvasOverlayDrawerContainer()
    const { height: canvasHeight, width: canvasWidth } =
      useWorkspaceDrawerCanvasSize(canvasContainer)
    const guideState = useWorkspaceDrawerGuideState()
    const restoredPreferencesScopeRef = useRef<string | null>(null)
    const [preferencesReady, setPreferencesReady] = useState(false)
    const [open, setOpen] = useState(true)
    const [activeSnapPoint, setActiveSnapPoint] = useState<
      number | string | null
    >(
      () =>
        guideState?.snapPoint ??
        resolveWorkspaceDataDrawerRequestSnapPoint(request)
    )
    const [tab, setTab] = useState<WorkspaceCanvasDrawerTab>(
      guideState?.tab ?? request?.tab ?? "organization"
    )
    const handledRequestIdRef = useRef(0)
    const handledAcceleratorRequestIdRef = useRef(0)
    const [acceptedRequest, setAcceptedRequest] = useState(request ?? null)
    const drawerCollapsed = open && isDrawerCollapsed(activeSnapPoint)
    const drawerExpanded = open && !isDrawerCollapsed(activeSnapPoint)
    const drawerFullscreen = open && isDrawerFullscreen(activeSnapPoint)
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
      useWorkspaceDataDrawerTabIndicator({ tab, expanded: drawerExpanded })
    // Reserve the tabs (up to 54px on touch screens) and their 6px gap too.
    const dockHeight = particleComposer ? composerHeight + 60 : chrome.total + composerHeight
    const windowState = useWorkspaceContentWindow({
      enabled: Boolean(particleComposer),
      tab: particleInspector ? undefined : tab,
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
      const scopeKey = JSON.stringify([
        uiPreferencesScope.orgId,
        uiPreferencesScope.viewerId,
      ])
      if (restoredPreferencesScopeRef.current === scopeKey) return
      restoredPreferencesScopeRef.current = scopeKey
      if (request || guideState) return
      const storedPreferences =
        readWorkspaceBoardUiPreferences(uiPreferencesScope)
      setTab(storedPreferences.dataDrawerTab)
      const storedSnapPoint = resolveWorkspaceDataDrawerSnapPoint(
        storedPreferences.dataDrawerSnapPoint
      )
      if (storedSnapPoint === null) return
      setOpen(true)
      setActiveSnapPoint(storedSnapPoint)
    }, [request, uiPreferencesScope, guideState])

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
        resolveWorkspaceDataDrawerRequestSnapPoint(request)
      )
    }, [
      handleActiveSnapPointChange,
      request,
      uiPreferencesScope,
      leaveParticle,
    ])

    useWorkspaceDrawerGuide({
      state: guideState,
      setOpen,
      setTab,
      setSnap: setActiveSnapPoint,
    })

    const handleAddPeopleToCanvas = useCallback(
      (personIds: string[]) => {
        const added = peopleCanvasActions.add(personIds)
        if (added > 0 && drawerFullscreen) {
          handleActiveSnapPointChange(
            WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT
          )
        }
        return added
      },
      [drawerFullscreen, handleActiveSnapPointChange, peopleCanvasActions]
    )

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

    // Restore preferences before mounting the retained content tree.
    if (!preferencesReady || canvasHeight <= 0 || canvasWidth <= 0) return null

    return (
      <WorkspaceDockHost
        floating={Boolean(particleComposer)}
        composerHeight={composerHeight}
        container={canvasContainer}
        onMinimize={windowState.onMinimize}
        request={request}
        legacyRootProps={{
          open: canvasContainer ? open : false,
          onOpenChange: handleOpenChange,
          activeSnapPoint,
          setActiveSnapPoint: handleActiveSnapPointChange,
        }}
        legacyContentProps={{
          ...DOCK_SHELL_OWNER_PROPS,
          style: { height: canvasHeight, width: canvasWidth },
          "data-workspace-canvas-drawer-fullscreen": drawerFullscreen
            ? "true"
            : undefined,
          className: drawerClassName(drawerFullscreen),
        }}
        legacyTrigger={
          <WorkspaceDrawerTrigger
            drawerExpanded={drawerExpanded}
            dataShortcutLabel={dataShortcutLabel}
            handleDataShortcutClick={handleDataShortcutClick}
          />
        }
      >
        <div className={particleComposer ? FLOATING_PANEL_CLASS : "contents"}>
          {!particleComposer ? (
            <WorkspaceDrawerHeader
              compact
              onCollapse={handleActiveSnapPointChange}
            />
          ) : null}
          <div
            data-workspace-data-drawer-content-viewport="true"
            className={cn(
              particleComposer ? "contents" : "flex min-h-0 flex-none flex-col",
              desktop || drawerCollapsed
                ? "overflow-visible"
                : "overflow-hidden"
            )}
            style={{
              height: particleComposer
                ? `${dockHeight - chrome.header - 2}px`
                : resolveWorkspaceDataDrawerViewportHeight(activeSnapPoint),
            }}
          >
            <WorkspaceDrawerTabs
              key={`${uiPreferencesScope.orgId}:${uiPreferencesScope.viewerId}`}
              windowState={windowState}
              composerMode={Boolean(particleComposer)}
              bodyOverride={particleInspector}
              particleInspectorTitle={particleInspectorTitle}
              particleInspectorMaxWidth={particleInspectorMaxWidth}
              particleLibrary={particleLibrary}
              acceleratorHasAccess={acceleratorHasAccess}
              acceleratorInput={acceleratorInput}
              acceleratorPaywallHref={acceleratorPaywallHref}
              acceleratorRoadmapSections={acceleratorRoadmapSections}
              canEdit={canEdit}
              documentsTab={documentsTab}
              drawerCollapsed={drawerCollapsed}
              handleAcceleratorRequestHandled={handleAcceleratorRequestHandled}
              handleTabOpen={handleTabOpen}
              handleTabChange={handleTabChange}
              peopleCanvasActions={{
                ...peopleCanvasActions,
                add: handleAddPeopleToCanvas,
              }}
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
      </WorkspaceDockHost>
    )
  }
)
