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
    <section aria-labelledby="workspace-tools-plugins" className="flex min-w-0 flex-col gap-4 px-4 pt-3 pb-5">
      <h2 id="workspace-tools-plugins" className="text-muted-foreground text-xs font-medium">Plugins</h2>
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
        <div className="grid gap-2">
          {availableTools.map((tool) => (
            <WorkspaceToolRow
              key={tool.id}
              tool={tool}
              onGoogleDriveConnectionChange={handleGoogleDriveConnectionChange}
              onGoogleCalendarConnectionChange={setGoogleCalendarConnected}
              stripeConnection={stripeConnection}
            />
          ))}
        </div>
      ) : null}

    </section>
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
      <h3 id={headingId} className="text-muted-foreground mb-2 text-xs font-medium">
        {title}
      </h3>
      <div className="grid gap-2">{children}</div>
    </section>
  )
}
