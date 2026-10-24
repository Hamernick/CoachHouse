"use client"

import type { ReactNode } from "react"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  WorkspaceNodeFrameRoot,
  WorkspaceNodeFrameBody,
  WorkspaceNodeFrameFooter,
} from "@/components/workspace/workspace-node-frame"
import { WORKSPACE_PARTICLE_CHROME } from "@/components/workspace/workspace-particle-chrome"

import { WORKSPACE_CARD_LAYOUT_SYSTEM } from "./workspace-board-card-layout-system"
import { WorkspaceBoardCardHeader } from "./workspace-board-card-header"
import {
  resolveWorkspaceCardCanvasShellClassName,
  resolveWorkspaceCardCanvasShellStyle,
} from "./workspace-board-layout-config"
import type {
  WorkspaceCardId,
  WorkspaceCardOverflowAction,
  WorkspaceCardSize,
} from "./workspace-board-types"

export function WorkspaceBoardNodeCardShell({
  cardId,
  title,
  subtitle,
  headerMeta,
  headerAction,
  hideSubtitle = false,
  size,
  presentationMode,
  fullHref,
  canEdit,
  editorHref = null,
  onEditorOpen,
  menuActions = [],
  shellInsetClassName = "p-3",
  compact = false,
  shellClassName,
  contentClassName,
  contentInsetClassName,
  contentPanelClassName,
  contentSurface = "default",
  footer,
  footerClassName,
  isCanvasFullscreen = false,
  onToggleCanvasFullscreen,
  children,
}: {
  cardId: WorkspaceCardId
  title: string
  subtitle: string
  headerMeta?: ReactNode
  headerAction?: ReactNode
  hideSubtitle?: boolean
  size: WorkspaceCardSize
  presentationMode: boolean
  fullHref: string
  canEdit: boolean
  editorHref?: string | null
  onEditorOpen?: () => void
  menuActions?: WorkspaceCardOverflowAction[]
  shellInsetClassName?: string
  compact?: boolean
  shellClassName?: string
  contentClassName?: string
  contentInsetClassName?: string
  contentPanelClassName?: string
  contentSurface?: "default" | "plain"
  footer?: ReactNode
  footerClassName?: string
  isCanvasFullscreen?: boolean
  onToggleCanvasFullscreen?: () => void
  children: ReactNode
}) {
  const canvasShellStyle = resolveWorkspaceCardCanvasShellStyle({
    size,
    cardId,
    isCanvasFullscreen,
  })
  const Root = compact ? WorkspaceNodeFrameRoot : Card
  const Body = compact ? WorkspaceNodeFrameBody : CardContent
  const Footer = compact ? WorkspaceNodeFrameFooter : CardFooter

  return (
    <Root
      data-workspace-card={cardId}
      style={canvasShellStyle}
      className={cn(
        "border-border/60 bg-muted relative w-full max-w-[42rem]",
        compact ? WORKSPACE_PARTICLE_CHROME.root : "rounded-[2rem] shadow-sm",
        !compact && shellInsetClassName,
        resolveWorkspaceCardCanvasShellClassName({
          size,
          cardId,
          isCanvasFullscreen,
        }),
        shellClassName
      )}
    >
      <WorkspaceBoardCardHeader
        title={title}
        subtitle={subtitle}
        presentationMode={presentationMode}
        fullHref={fullHref}
        canEdit={canEdit}
        editorHref={editorHref}
        onEditorOpen={onEditorOpen}
        menuActions={menuActions}
        headerMeta={headerMeta}
        headerAction={headerAction}
        hideSubtitle={hideSubtitle}
        isCanvasFullscreen={isCanvasFullscreen}
        onToggleCanvasFullscreen={onToggleCanvasFullscreen}
        surface="card"
        compact={compact}
      />
      <Body
        className={cn(
          compact ? "px-0 pb-0" : contentSurface === "plain" ? "px-3" : "px-0",
          !compact && (contentSurface === "plain" || !footer ? "pb-3" : "pb-0"),
          contentInsetClassName
        )}
      >
        <div
          className={cn(
            compact && contentSurface !== "plain"
              ? WORKSPACE_PARTICLE_CHROME.body
              : contentSurface === "plain"
                ? "mx-0 p-0"
                : "bg-background border-border/60 mx-3 rounded-[1.45rem] border p-3",
            isCanvasFullscreen && "overflow-y-auto",
            contentPanelClassName
          )}
        >
          <div
            className={cn(
              "nopan flex flex-col",
              WORKSPACE_CARD_LAYOUT_SYSTEM.flexColumn,
              presentationMode && "px-0 pt-0 pb-0",
              contentClassName
            )}
          >
            {children}
          </div>
        </div>
      </Body>
      {footer ? (
        <Footer
          className={cn(
            "nopan items-center",
            compact
              ? WORKSPACE_PARTICLE_CHROME.footer
              : "justify-between gap-3 px-3 py-3",
            footerClassName
          )}
        >
          {footer}
        </Footer>
      ) : null}
    </Root>
  )
}
