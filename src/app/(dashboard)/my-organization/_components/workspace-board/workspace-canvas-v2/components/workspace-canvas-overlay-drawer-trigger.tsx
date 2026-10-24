"use client"

import type { MouseEvent } from "react"
import DatabaseIcon from "lucide-react/dist/esm/icons/database"

import { Button } from "@/components/ui/button"
import { DrawerTrigger } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

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
