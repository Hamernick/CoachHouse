"use client"

import type { ReactNode } from "react"

import { WorkspaceBoardNodeCardShell } from "./workspace-board-node-card-shell"
import type {
  WorkspaceCardOverflowAction,
  WorkspaceCardSize,
} from "./workspace-board-types"

export function WorkspaceBoardOrganizationCardShell({
  title,
  subtitle,
  headerMeta,
  headerAction,
  size,
  presentationMode,
  fullHref,
  canEdit,
  editorHref = null,
  onEditorOpen,
  menuActions = [],
  contentClassName,
  isCanvasFullscreen = false,
  onToggleCanvasFullscreen,
  children,
}: {
  title: string
  subtitle: string
  headerMeta?: ReactNode
  headerAction?: ReactNode
  size: WorkspaceCardSize
  presentationMode: boolean
  fullHref: string
  canEdit: boolean
  editorHref?: string | null
  onEditorOpen?: () => void
  menuActions?: WorkspaceCardOverflowAction[]
  contentClassName?: string
  isCanvasFullscreen?: boolean
  onToggleCanvasFullscreen?: () => void
  children: ReactNode
}) {
  return (
    <WorkspaceBoardNodeCardShell
      cardId="organization-overview"
      compact
      title={title}
      subtitle={subtitle}
      headerMeta={headerMeta}
      headerAction={headerAction}
      hideSubtitle
      size={size}
      presentationMode={presentationMode}
      fullHref={fullHref}
      canEdit={canEdit}
      editorHref={editorHref}
      onEditorOpen={onEditorOpen}
      menuActions={menuActions}
      contentClassName={contentClassName}
      contentPanelClassName="overflow-hidden p-0"
      isCanvasFullscreen={isCanvasFullscreen}
      onToggleCanvasFullscreen={onToggleCanvasFullscreen}
    >
      {children}
    </WorkspaceBoardNodeCardShell>
  )
}
