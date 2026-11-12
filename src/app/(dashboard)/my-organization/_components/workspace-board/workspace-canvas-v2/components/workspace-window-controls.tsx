"use client"

import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import XIcon from "lucide-react/dist/esm/icons/x"
import Maximize2Icon from "lucide-react/dist/esm/icons/maximize-2"
import Minimize2Icon from "lucide-react/dist/esm/icons/minimize-2"
import { Button } from "@/components/ui/button"

import { useWorkspaceWindowStatus } from "@/components/workspace/workspace-editor-status"
import type { WorkspaceContentWindowState } from "./workspace-content-window"
import styles from "./workspace-dock.module.css"

export function WorkspaceWindowControls({
  windowState,
  backToPlanning = false,
}: {
  windowState?: WorkspaceContentWindowState
  backToPlanning?: boolean
}) {
  const status = useWorkspaceWindowStatus()
  const controls = [
    {
      id: "close",
      label: backToPlanning ? "Back to planning" : "Close content window",
      title: status.text ? `Close — ${status.text}` : "Close",
      action: windowState?.onClose,
      Icon: backToPlanning ? ArrowLeftIcon : XIcon,
    },
    {
      id: "maximize",
      label: windowState?.maximized
        ? "Restore content window"
        : "Maximize content window",
      title: windowState?.maximized ? "Restore" : "Maximize",
      action: windowState?.onToggleMaximize,
      Icon: windowState?.maximized ? Minimize2Icon : Maximize2Icon,
    },
  ] as const
  return (
    <div
      className={styles.windowControls}
      role="group"
      aria-label="Window controls"
    >
      {controls.map(({ id, label, title, action, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="ghost"
          size="icon"
          className={backToPlanning ? "relative size-8 rounded-md text-muted-foreground [@media(pointer:coarse)]:size-11" : styles.windowControl}
          data-window-action={id}
          data-unsaved={
            id === "close" && status.outstanding ? "true" : undefined
          }
          aria-label={
            id === "close" && status.text ? `${label}. ${status.text}` : label
          }
          title={title}
          onClick={action}

        >
          {backToPlanning ? <><Icon aria-hidden className="size-4" />{id === "close" && status.outstanding && <span aria-hidden className="absolute right-1 top-1 size-1 rounded-full bg-current" />}</> : <span className={styles.windowDot} aria-hidden="true">
            <Icon />
            <span className={styles.unsavedDot} />
          </span>}
        </Button>
      ))}
      <span className="sr-only" role="status" aria-live="polite">
        {status.text}
      </span>
    </div>
  )
}
