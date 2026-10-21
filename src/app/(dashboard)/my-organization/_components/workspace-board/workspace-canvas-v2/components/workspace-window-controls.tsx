"use client"

import XIcon from "lucide-react/dist/esm/icons/x"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import Maximize2Icon from "lucide-react/dist/esm/icons/maximize-2"
import Minimize2Icon from "lucide-react/dist/esm/icons/minimize-2"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { useWorkspaceWindowStatus } from "@/components/workspace/workspace-editor-status"
import type { WorkspaceContentWindowState } from "./workspace-content-window"
import styles from "./workspace-dock.module.css"

export function WorkspaceWindowControls({
  windowState,
}: {
  windowState?: WorkspaceContentWindowState
}) {
  const status = useWorkspaceWindowStatus()
  const controls = [
    {
      id: "close",
      label: "Close content window",
      title: status.text ? `Close — ${status.text}` : "Close",
      action: windowState?.onClose,
      Icon: XIcon,
    },
    {
      id: "minimize",
      label: "Minimize content window",
      title: "Minimize",
      action: windowState?.onMinimize,
      Icon: MinusIcon,
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
          className={styles.windowControl}
          data-window-action={id}
          data-unsaved={
            id === "close" && status.outstanding ? "true" : undefined
          }
          aria-label={
            id === "close" && status.text ? `${label}. ${status.text}` : label
          }
          title={title}
          onClick={action}
          {...getReactGrabOwnerProps({
            ownerId: `workspace-canvas:window-${id}`,
            component: "WorkspaceWindowControls",
            slot: id,
            source:
              "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-window-controls.tsx",
            tokenSource:
              "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock.module.css",
            primitiveImport: "@/components/ui/button",
          })}
        >
          <span className={styles.windowDot} aria-hidden="true">
            <Icon />
            <span className={styles.unsavedDot} />
          </span>
        </Button>
      ))}
      <span className="sr-only" role="status" aria-live="polite">
        {status.text}
      </span>
    </div>
  )
}
