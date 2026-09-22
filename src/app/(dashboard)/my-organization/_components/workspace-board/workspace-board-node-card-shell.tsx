"use client"

import type { ReactNode } from "react"

import { CardContent, CardFooter } from "@/components/ui/card"
import {
  WorkspaceCardShell,
  WORKSPACE_CARD_CONTENT_SURFACE_CLASS_NAME,
} from "@/components/workspace/workspace-card-shell"
import { cn } from "@/lib/utils"

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
  shellClassName,
  contentClassName,
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
  shellClassName?: string
  contentClassName?: string
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

  return (
    <WorkspaceCardShell
      data-workspace-card={cardId}
      style={canvasShellStyle}
      className={cn(
        shellInsetClassName,
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
      />
      <CardContent
        className={cn(
          contentSurface === "plain" ? "px-3" : "px-0",
          contentSurface === "plain" || !footer ? "pb-3" : "pb-0"
        )}
      >
        <div
          className={cn(
            contentSurface === "plain"
              ? "mx-0 p-0"
              : WORKSPACE_CARD_CONTENT_SURFACE_CLASS_NAME,
            isCanvasFullscreen && "overflow-y-auto"
          )}
        >
          <div
            className={cn(
              "nodrag nopan flex flex-col",
              WORKSPACE_CARD_LAYOUT_SYSTEM.flexColumn,
              presentationMode && "px-0 pt-0 pb-0",
              contentClassName
            )}
          >
            {children}
          </div>
        </div>
      </CardContent>
      {footer ? (
        <CardFooter
          className={cn(
            "nodrag nopan items-center justify-between gap-3 px-3 py-3",
            footerClassName
          )}
        >
          {footer}
        </CardFooter>
      ) : null}
    </WorkspaceCardShell>
  )
}
