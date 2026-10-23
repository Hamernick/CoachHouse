import { z } from "zod"

/** References to existing cards on the same organization board; never cloned records. */
export const workspaceToolIdSchema = z.enum([
  "organization-overview",
  "programs",
  "fiscal-sponsorship",
])
export const workspaceToolTargetHandleSchema = z.enum([
  "workspace-card-target-left",
  "workspace-card-target-right",
  "workspace-card-target-top",
  "workspace-card-target-bottom",
])
export const workspaceToolSourceHandleSchema = z.enum([
  "workspace-card-source-left",
  "workspace-card-source-right",
  "workspace-card-source-top",
  "workspace-card-source-bottom",
])
export type WorkspaceToolId = z.infer<typeof workspaceToolIdSchema>
export const WORKSPACE_TOOL_LABELS: Record<WorkspaceToolId, string> = {
  "organization-overview": "Organization",
  programs: "Resources",
  "fiscal-sponsorship": "Fiscal Sponsorship",
}
export function isWorkspaceToolId(id: string): id is WorkspaceToolId {
  return workspaceToolIdSchema.safeParse(id).success
}
export function workspaceToolLabel(id: string): string | undefined {
  return isWorkspaceToolId(id) ? WORKSPACE_TOOL_LABELS[id] : undefined
}
