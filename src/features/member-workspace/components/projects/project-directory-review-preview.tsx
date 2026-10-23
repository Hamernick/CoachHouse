"use client"

import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import { MemberWorkspaceProjectsPage } from "./member-workspace-projects-page"

const projects: PlatformAdminDashboardLabProject[] = [
  { id: "preview-old", name: "Earlier project", createdAt: "2026-01-01T12:00:00Z", endDate: new Date(2026, 9, 30), status: "active", priority: "high" },
  { id: "preview-new", name: "Newest project", createdAt: "2026-10-20T12:00:00Z", endDate: new Date(2026, 9, 21), status: "completed", priority: "low" },
  { id: "preview-undated", name: "Undated project", status: "planned", priority: "medium", endDate: null },
].map(project => ({ taskCount: 0, progress: 0, startDate: null, tags: [], members: [], tasks: [], ...project }) as PlatformAdminDashboardLabProject)

// Gated fixture: no database client, server mutation, or production seed path.
export function ProjectDirectoryReviewPreview() {
  return <main className="flex min-h-svh flex-col bg-background text-foreground [--shell-content-pad:0px]">
    <p className="border-b px-4 py-2 text-xs text-muted-foreground">Projects preview · sample data only</p>
    <MemberWorkspaceProjectsPage directory="projects" projects={projects} storageMode="custom"
      canResetStarterData={false} starterProjectCount={0} canCreateProjects={false}
      organizationOptions={[]} assigneeOptions={[]} scope="platform-admin" />
  </main>
}
