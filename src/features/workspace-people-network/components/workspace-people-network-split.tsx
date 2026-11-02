"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { PanelImperativeHandle } from "react-resizable-panels"
import type { WorkspacePeopleNetworkProps } from "../types"
import { WorkspacePeopleNetworkPanel } from "./workspace-people-network-panel"

export function WorkspacePeopleNetworkSplit({
  children,
  ...props
}: WorkspacePeopleNetworkProps & { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  const panelRef = useRef<PanelImperativeHandle>(null)
  const expandedSize = useRef(65)
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      panelRef.current?.resize(expanded ? `${expandedSize.current}%` : "48px")
    )
    return () => cancelAnimationFrame(frame)
  }, [expanded])
  return (
    <ResizablePanelGroup
      orientation="vertical"
      className="bg-background min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      <ResizablePanel
        id="people-network"
        panelRef={panelRef}
        defaultSize="65%"
        minSize={expanded ? "20%" : "48px"}
        maxSize={expanded ? undefined : "48px"}
        className="min-h-0 overflow-hidden"
      >
        <WorkspacePeopleNetworkPanel
          {...props}
          expanded={expanded}
          onExpandedChange={(next) => {
            if (!next)
              expandedSize.current =
                panelRef.current?.getSize().asPercentage ?? 65
            setExpanded(next)
          }}
        />
      </ResizablePanel>
      <ResizableHandle
        withHandle
        disabled={!expanded}
        aria-label="Resize network and people table"
        className="shrink-0"
      />
      <ResizablePanel
        id="people-table"
        defaultSize="35%"
        minSize="20%"
        className="flex min-h-0 flex-col overflow-hidden"
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
