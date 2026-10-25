"use client"

import { useMemo } from "react"

import {
  normalizeWorkspaceToolsInput,
  WORKSPACE_TOOL_DEFINITIONS,
} from "../lib"
import type { WorkspaceToolsInput } from "../types"

export function useWorkspaceToolsController(
  input: WorkspaceToolsInput,
  googleDriveConnected: boolean | null,
  googleCalendarConnected: boolean | null = null
) {
  const normalizedInput = useMemo(
    () => normalizeWorkspaceToolsInput(input),
    [input]
  )
  const stripeConnected = normalizedInput.stripeConnection.state === "connected"
  const isInstalled = (
    toolId: (typeof WORKSPACE_TOOL_DEFINITIONS)[number]["id"]
  ) =>
    toolId === "stripe"
      ? stripeConnected
      : toolId === "google-calendar"
        ? googleCalendarConnected === true
        : googleDriveConnected === true

  return {
    availableTools: WORKSPACE_TOOL_DEFINITIONS.filter((tool) => !isInstalled(tool.id)),
    installedTools: WORKSPACE_TOOL_DEFINITIONS.filter((tool) => isInstalled(tool.id)),
    stripeConnection: normalizedInput.stripeConnection,
  }
}
