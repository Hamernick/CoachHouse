"use client"

import { WorkspaceManagementProvider } from "@/features/workspace-management/client"
import { WorkspaceSidebarProvider } from "@/components/workspace/workspace-sidebar-slot"

import { RightRailProvider } from "@/components/app-shell/right-rail"

import { AppShellInner } from "./app-shell/app-shell-inner"
import type { AppShellProps } from "./app-shell/types"

export function AppShell(props: AppShellProps) {
  return (
    <RightRailProvider>
      <WorkspaceManagementProvider>
        <WorkspaceSidebarProvider>
          <AppShellInner {...props} />
        </WorkspaceSidebarProvider>
      </WorkspaceManagementProvider>
    </RightRailProvider>
  )
}
