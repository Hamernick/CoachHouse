"use client"

import PanelLeftOpenIcon from "lucide-react/dist/esm/icons/panel-left-open"
import { useState } from "react"

import { ClientOnly } from "@/components/client-only"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

import type { WorkspaceCardShortcutItemModel } from "./workspace-card-shortcut-model"

export function WorkspaceCardShortcutsMobile({
  items,
}: {
  items: WorkspaceCardShortcutItemModel[]
}) {
  const [open, setOpen] = useState(false)
  const triggerClassName =
    "canvas-glass h-11 w-11 rounded-2xl border"

  return (
    <div className="pointer-events-auto md:hidden">
      <ClientOnly
        fallback={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(triggerClassName, "pointer-events-none")}
            aria-label="Open workspace card shortcuts"
            aria-hidden="true"
            tabIndex={-1}
          >
            <PanelLeftOpenIcon className="h-5 w-5" aria-hidden />
          </Button>
        }
      >
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={triggerClassName}
              aria-label="Open workspace card shortcuts"
            >
              <PanelLeftOpenIcon className="h-5 w-5" aria-hidden />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="canvas-glass px-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-4 pb-2 text-left">
              <DrawerTitle>Workspace cards</DrawerTitle>
              <DrawerDescription>
                Open or hide the cards attached to your organization workspace.
              </DrawerDescription>
            </DrawerHeader>
            <div className="grid gap-2 px-4 pb-4">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-12 justify-start rounded-2xl border px-3 text-left",
                      item.selected
                        ? "border-neutral-300/80 bg-neutral-100/80 dark:border-neutral-700/70 dark:bg-neutral-900/88"
                        : item.visible
                          ? "border-neutral-300/65 bg-neutral-100/55 dark:border-neutral-700/70 dark:bg-neutral-900/72"
                          : "border-neutral-300/55 bg-neutral-100/40 dark:border-neutral-700/60 dark:bg-neutral-900/64",
                    )}
                    onClick={() => {
                      item.onPress()
                      setOpen(false)
                    }}
                  >
                    <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-xl border border-neutral-300/70 bg-white/60 text-neutral-500 dark:border-neutral-700/70 dark:bg-neutral-950/60 dark:text-neutral-300">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.title}
                    </span>
                  </Button>
                )
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </ClientOnly>
    </div>
  )
}
