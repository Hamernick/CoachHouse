"use client"

import type { MouseEvent } from "react"
import DatabaseIcon from "lucide-react/dist/esm/icons/database"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import { DrawerTrigger } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
const WORKSPACE_CARD_SHORTCUT_BUTTON_SOURCE =
  "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/shortcuts/workspace-card-shortcut-button.tsx"

export function WorkspaceDrawerTrigger({
  drawerExpanded,
  dataShortcutLabel,
  handleDataShortcutClick,
}: {
  drawerExpanded: boolean
  dataShortcutLabel: string
  handleDataShortcutClick: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
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
          tokenSource: "src/components/workspace/workspace-tutorial-theme.ts",
          primitiveImport: "@/components/ui/button",
        })}
        onClick={handleDataShortcutClick}
        className={cn(
          "nodrag nopan text-foreground size-9 h-9 w-9 rounded-xl",
          "hidden",
          drawerExpanded &&
            "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground shadow-sm"
        )}
        aria-label={dataShortcutLabel}
        title={dataShortcutLabel}
      >
        <DatabaseIcon className="h-4 w-4" aria-hidden />
      </Button>
    </DrawerTrigger>
  )
}
