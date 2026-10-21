"use client"

import { useCallback, useState, type ReactNode } from "react"

import { useWorkspaceToolsController } from "../hooks/use-workspace-tools-controller"
import type { WorkspaceToolsInput } from "../types"
import { WorkspaceToolRow } from "./workspace-tool-row"

type WorkspaceToolsPanelProps = {
  input: WorkspaceToolsInput
}

export function WorkspaceToolsPanel({ input }: WorkspaceToolsPanelProps) {
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState<
    boolean | null
  >(null)
  const [googleDriveConnected, setGoogleDriveConnected] = useState<
    boolean | null
  >(null)
  const handleGoogleDriveConnectionChange = useCallback(
    (connected: boolean) => setGoogleDriveConnected(connected),
    []
  )
  const {
    availableTools,
    installedTools,
    stripeConnection,
  } = useWorkspaceToolsController(
    input,
    googleDriveConnected,
    googleCalendarConnected
  )

  return (
    <div

      className="mx-auto flex w-full max-w-none flex-col gap-6 px-2 pt-2 pb-4 sm:pb-6"
    >
      {installedTools.length > 0 ? (
        <ToolSection title="Installed">
          {installedTools.map((tool) => (
            <WorkspaceToolRow
              key={tool.id}
              tool={tool}
              onGoogleDriveConnectionChange={handleGoogleDriveConnectionChange}
              onGoogleCalendarConnectionChange={setGoogleCalendarConnected}
              stripeConnection={stripeConnection}
            />
          ))}
        </ToolSection>
      ) : null}

      {availableTools.length > 0 ? (
        <ToolSection title="Available">
          {availableTools.map((tool) => (
            <WorkspaceToolRow
              key={tool.id}
              tool={tool}
              onGoogleDriveConnectionChange={handleGoogleDriveConnectionChange}
              onGoogleCalendarConnectionChange={setGoogleCalendarConnected}
              stripeConnection={stripeConnection}
            />
          ))}
        </ToolSection>
      ) : null}

    </div>
  )
}

function ToolSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const headingId = `workspace-tools-${title.toLowerCase()}`

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-sm font-medium">
        {title}
      </h3>
      <div className="grid gap-2">{children}</div>
    </section>
  )
}
