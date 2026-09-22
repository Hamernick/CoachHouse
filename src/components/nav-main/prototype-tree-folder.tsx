"use client"

import { useEffect, useState } from "react"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import FolderIcon from "lucide-react/dist/esm/icons/folder"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { SidebarMenuSub, SidebarMenuSubItem } from "@/components/ui/sidebar"
import type { PrototypeLabSidebarTreeFolderNode } from "@/lib/prototype-lab-sidebar-tree"
import { cn } from "@/lib/utils"
import { PrototypeTreeEntry } from "./prototype-tree-entry"

export function PrototypeTreeFolder({
  activeEntryId,
  defaultOpenFolderIds,
  node,
  onPrefetch,
}: {
  activeEntryId: string
  defaultOpenFolderIds: string[]
  node: PrototypeLabSidebarTreeFolderNode
  onPrefetch?: (href: string | null | undefined) => void
}) {
  const [open, setOpen] = useState(defaultOpenFolderIds.includes(node.id))

  useEffect(() => {
    if (defaultOpenFolderIds.includes(node.id)) setOpen(true)
  }, [defaultOpenFolderIds, node.id])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-7 w-full min-w-0 items-center justify-start gap-2 rounded-md px-2 text-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-inset"
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 transition-transform",
                open && "rotate-90"
              )}
              aria-hidden
            />
            <FolderIcon
              className="size-4 shrink-0 text-amber-500"
              aria-hidden
            />
            <span className="truncate">{node.label}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-[accordion-up_140ms_ease-out] data-[state=open]:animate-[accordion-down_160ms_ease-out] motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none">
          <SidebarMenuSub>
            {node.children.map((childNode) =>
              childNode.kind === "folder" ? (
                <PrototypeTreeFolder
                  key={childNode.id}
                  activeEntryId={activeEntryId}
                  defaultOpenFolderIds={defaultOpenFolderIds}
                  node={childNode}
                  onPrefetch={onPrefetch}
                />
              ) : (
                <PrototypeTreeEntry
                  key={childNode.id}
                  href={childNode.href}
                  isActive={childNode.id === activeEntryId}
                  label={childNode.label}
                  onPrefetch={onPrefetch}
                />
              )
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  )
}
