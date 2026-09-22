"use client"
import { GoogleCalendarPanel } from "@/features/google-calendar/client"
import {
  GoogleDriveConnection,
  WorkspaceToolBrandIcon,
} from "@/features/workspace-tools"
export function CoachDashboardTools() {
  return (
    <div className="grid gap-3">
      <GoogleCalendarPanel
        brand={<WorkspaceToolBrandIcon toolId="google-calendar" />}
      />
      <GoogleDriveConnection
        brand={<WorkspaceToolBrandIcon toolId="google-drive" />}
      />
    </div>
  )
}
