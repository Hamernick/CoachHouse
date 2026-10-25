"use client"

import {
  Frame,
  FrameBody,
  FrameFooter,
  FramePanel,
} from "@/components/ui/frame"
import { cn } from "@/lib/utils"

import { WORKSPACE_CARD_LAYOUT_SYSTEM } from "./workspace-board-card-layout-system"
import { WorkspaceBoardCardHeader } from "./workspace-board-card-header"
import {
  resolveWorkspaceCardCanvasShellClassName,
  resolveWorkspaceCardCanvasShellStyle,
} from "./workspace-board-layout-config"
import type { WorkspaceCardFrameProps } from "./workspace-board-types"

export function WorkspaceBoardCardFrame({
  cardId,
  title,
  subtitle,
  tone = "default",
  titleIcon,
  titleBadge,
  headerDetails,
  headerMeta,
  headerAction,
  hideTitle = false,
  hideSubtitle = false,
  size,
  presentationMode,
  onSizeChange: _onSizeChange,
  fullHref,
  canEdit,
  editorHref = null,
  menuActions = [],
  contentClassName,
  footer,
  isCanvasFullscreen = false,
  onToggleCanvasFullscreen,
  fullscreenControlMode = "overflow",
  children,
}: WorkspaceCardFrameProps) {
  const canvasShellStyle = resolveWorkspaceCardCanvasShellStyle({
    size,
    cardId,
    isCanvasFullscreen,
  })
  const showHeader =
    cardId !== "accelerator" ||
    !hideTitle ||
    !hideSubtitle ||
    Boolean(headerDetails) ||
    Boolean(headerMeta) ||
    Boolean(headerAction) ||
    Boolean(editorHref) ||
    menuActions.length > 0 ||
    Boolean(onToggleCanvasFullscreen)
  const contentCanDrag = canEdit && !presentationMode && !isCanvasFullscreen

  return (
    <Frame
      data-workspace-card={cardId}
      style={canvasShellStyle}
      className={resolveWorkspaceCardCanvasShellClassName({
        size,
        cardId,
        isCanvasFullscreen,
      })}
    >
      <FramePanel
        className={cn(
          "border-border/70 bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-visible p-0",
          tone === "accelerator" &&
            "shadow-[0_14px_36px_-30px_rgba(15,23,42,0.18)]"
        )}
      >
        {showHeader ? (
          <WorkspaceBoardCardHeader
            title={title}
            subtitle={subtitle}
            tone={tone}
            titleIcon={titleIcon}
            titleBadge={titleBadge}
            headerDetails={headerDetails}
            headerMeta={headerMeta}
            headerAction={headerAction}
            hideTitle={hideTitle}
            hideSubtitle={hideSubtitle}
            presentationMode={presentationMode}
            fullHref={fullHref}
            canEdit={canEdit}
            editorHref={editorHref}
            menuActions={menuActions}
            isCanvasFullscreen={isCanvasFullscreen}
            onToggleCanvasFullscreen={onToggleCanvasFullscreen}
            fullscreenControlMode={fullscreenControlMode}
            compactTitleBottomGap={cardId === "roadmap"}
          />
        ) : null}
        <FrameBody
          className={cn(
            "flex flex-col overflow-hidden px-4",
            contentCanDrag
              ? "workspace-card-drag-handle cursor-grab touch-manipulation active:cursor-grabbing"
              : "nopan",
            WORKSPACE_CARD_LAYOUT_SYSTEM.flexColumn,
            cardId === "organization-overview" ? "pt-0" : "pt-1",
            cardId === "calendar" ? "pb-3" : "pb-4",
            presentationMode && "px-3.5 pt-0.5 pb-3",
            isCanvasFullscreen &&
              (cardId === "roadmap" || cardId === "deck"
                ? "overflow-hidden px-0 pt-0 pb-0"
                : "overflow-y-auto px-5 pt-2 pb-5"),
            contentClassName
          )}
        >
          {children}
        </FrameBody>
        {footer ? (
          <FrameFooter className="nopan mt-auto px-4 pt-3 pb-4">
            {footer}
          </FrameFooter>
        ) : null}
      </FramePanel>
    </Frame>
  )
}
