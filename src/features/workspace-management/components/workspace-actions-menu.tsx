"use client"

import { useRef } from "react"
import EllipsisIcon from "lucide-react/dist/esm/icons/ellipsis"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import UserPlusIcon from "lucide-react/dist/esm/icons/user-plus"
import { SidebarMenuAction } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { WorkspaceSummary } from "../types"

export type WorkspaceMenuAction = "edit" | "delete" | "access"

export function WorkspaceActionsMenu({ workspace, onAction }: {
  workspace: WorkspaceSummary
  onAction: (action: WorkspaceMenuAction, trigger: HTMLButtonElement) => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  function select(action: WorkspaceMenuAction) {
    if (!trigger.current) return
    openingDialog.current = true
    onAction(action, trigger.current)
  }
  return (
    <DropdownMenu onOpenChange={(open) => { if (open) openingDialog.current = false }}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction
          ref={trigger}
          aria-label={`Options for ${workspace.name}`}
          title="Workspace options"
          className="top-1 rounded-full text-sidebar-foreground/60 transition-[color,opacity] hover:text-sidebar-foreground opacity-0 group-hover/workspace:opacity-100 group-focus-within/workspace:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <EllipsisIcon aria-hidden />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-52 rounded-xl border-border/70 p-1.5 shadow-none" onCloseAutoFocus={(event) => { if (openingDialog.current) event.preventDefault() }}>
        <DropdownMenuItem className="min-h-9 rounded-lg" onSelect={() => select("edit")}><PencilIcon aria-hidden />Edit workspace</DropdownMenuItem>
        <DropdownMenuItem className="min-h-9 rounded-lg" onSelect={() => select("access")}><UserPlusIcon aria-hidden />Invite people</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-9 rounded-lg" onSelect={() => select("delete")}><Trash2Icon aria-hidden />Delete workspace</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
