"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { CollapsibleContent } from "@/components/ui/collapsible"
import { SidebarMenuAction, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar"
import { useWorkspaceManagement } from "./workspace-management-context"
import { WorkspaceActionsMenu, type WorkspaceMenuAction } from "./workspace-actions-menu"
import { WorkspaceDeleteDialog } from "./workspace-delete-dialog"
import { WorkspaceNameDialog } from "./workspace-name-dialog"
import type { WorkspaceSummary } from "../types"

export function WorkspaceSidebarActions({ children }: { children?: ReactNode }) {
  const context = useWorkspaceManagement()
  const pathname = usePathname()
  const [dialog, setDialog] = useState<{ workspace: WorkspaceSummary | null; returnFocus: HTMLElement; kind: WorkspaceMenuAction } | null>(null)
  const scope = context?.scope
  if (!scope || pathname !== "/workspace") return null
  return <>
    {scope.canEdit ? <SidebarMenuAction className="top-0 peer-data-[size=default]/menu-button:top-0 right-0 size-11 rounded-md md:size-8 text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground" aria-label="Create workspace" title="Create workspace" onClick={(event) => setDialog({ workspace: null, returnFocus: event.currentTarget, kind: "edit" })}><PlusIcon aria-hidden /></SidebarMenuAction> : null}
    <CollapsibleContent className="overflow-hidden group-data-[collapsible=icon]:hidden data-[state=closed]:animate-[accordion-up_140ms_ease-out] data-[state=open]:animate-[accordion-down_160ms_ease-out] motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none">
    {scope.workspaces.length > 0 ? <SidebarMenuSub className="mr-0">
      {scope.workspaces.map((workspace) => <SidebarMenuSubItem key={workspace.id ?? "main"} className="group/workspace relative">
        <SidebarMenuSubButton asChild isActive={workspace.id === scope.currentId} className="pr-8">
          <Link data-workspace-navigation href={workspace.id ? `/workspace?workspace=${workspace.id}` : "/workspace"} aria-current={workspace.id === scope.currentId ? "page" : undefined}><span>{workspace.name}</span></Link>
        </SidebarMenuSubButton>
        {scope.canEdit ? <WorkspaceActionsMenu workspace={workspace} onAction={(kind, returnFocus) => {
          if (kind === "access") context?.setAccessRequest({ orgId: scope.orgId, workspace, returnFocus })
          else setDialog({ workspace, returnFocus, kind })
        }} /> : null}
      </SidebarMenuSubItem>)}
    </SidebarMenuSub> : <p className="px-[var(--shell-rail-item-padding,0.5rem)] py-2 text-sm text-muted-foreground">No workspaces</p>}
    {scope.workspaces.length > 0 ? children : null}
    </CollapsibleContent>
    {dialog?.kind === "edit" ? <WorkspaceNameDialog key={`${scope.orgId}:${dialog.workspace?.id ?? "create"}`} orgId={scope.orgId} workspace={dialog.workspace} returnFocus={dialog.returnFocus} onClose={() => setDialog(null)} onSaved={(workspaces, id, created) => {
      context?.setScope({ ...scope, workspaces })
      setDialog(null)
      if (created && id) context?.navigate(`/workspace?workspace=${id}`)
    }} /> : null}
    {dialog?.kind === "delete" && dialog.workspace ? <WorkspaceDeleteDialog
      orgId={scope.orgId} workspace={dialog.workspace} returnFocus={dialog.returnFocus}
      onClose={() => setDialog(null)} onDeleted={(workspaces) => {
        context?.setScope({ ...scope, workspaces })
        setDialog(null)
        if (dialog.workspace?.id === scope.currentId) context?.navigate("/workspace")
      }}
    /> : null}
  </>
}
