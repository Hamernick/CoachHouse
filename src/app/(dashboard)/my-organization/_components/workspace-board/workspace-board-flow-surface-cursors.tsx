"use client"

import { memo } from "react"
import { useWorkspaceSupportMode } from "@/features/organization-workspace-support/client"

import { RealtimeCursors } from "@/components/realtime-cursors"

export const WorkspaceRealtimeCursorsOverlay = memo(function WorkspaceRealtimeCursorsOverlay({
  roomName,
  username,
  suspendPublishing,
  onConnectionStateChange,
}: {
  roomName: string
  username: string
  suspendPublishing?: boolean
  onConnectionStateChange: (state: "connecting" | "live" | "degraded") => void
}) {
  const supportAccess = useWorkspaceSupportMode()
  return (
    <RealtimeCursors
      roomName={roomName}
      username={username}
      onConnectionStateChange={onConnectionStateChange}
      showStatusBanner={false}
      suspendPublishing={suspendPublishing || supportAccess}
    />
  )
})

WorkspaceRealtimeCursorsOverlay.displayName = "WorkspaceRealtimeCursorsOverlay"
