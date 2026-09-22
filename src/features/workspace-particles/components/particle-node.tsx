"use client"

import { memo, useCallback, useEffect } from "react"
import {
  Handle,
  NodeToolbar,
  Position,
  useUpdateNodeInternals,
  useStore,
  type ReactFlowState,
  type NodeProps,
} from "reactflow"
import ExternalLinkIcon from "lucide-react/dist/esm/icons/external-link"
import PencilIcon from "lucide-react/dist/esm/icons/pencil"
import XIcon from "lucide-react/dist/esm/icons/x"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  WorkspaceNodeFrameRoot,
  WorkspaceNodeFrameSurface,
  WorkspaceNodeFrameHeader,
  WorkspaceNodeFrameBody,
} from "@/components/workspace/workspace-node-frame"
import { cn } from "@/lib/utils"
import { getWorkspaceRoadmapDrawerPath } from "@/lib/workspace/routes"
import { googleParticleUrl, particleDisplaySize } from "../lib"
import type { ParticleNodeData } from "../hooks/use-particle-nodes"
import { useWorkspaceParticles } from "./particle-context"
import { ParticleContent } from "./particle-content"
import { ParticleIcon } from "./particle-preview"
import motion from "./particle-motion.module.css"

export const WorkspaceParticleNode = memo(function WorkspaceParticleNode({
  id,
  data,
  selected,
}: NodeProps<ParticleNodeData>) {
  const { source, item, canEdit } = data
  const controller = useWorkspaceParticles()
  const updateNodeInternals = useUpdateNodeInternals()
  const toolbarBelow = useStore(
    useCallback(
      (state: ReactFlowState) =>
        selected && item.y * state.transform[2] + state.transform[1] < 60,
      [selected, item.y]
    )
  )
  const toolbarPosition = toolbarBelow ? Position.Bottom : Position.Top
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, item.size, updateNodeInternals])
  const title = source?.title ?? "Unavailable item"
  const displaySize = particleDisplaySize(item.source, item.size)
  const fileIconOnly =
    item.source.kind === "roadmap" && item.source.id !== "board_calendar"
  const icon = displaySize === "icon"
  const href = source?.document
    ? googleParticleUrl(source.document)
    : source?.section
      ? getWorkspaceRoadmapDrawerPath(source.section.slug)
      : (source?.href ?? null)
  return (
    <WorkspaceNodeFrameRoot
      className={cn(
        "group/particle h-full w-full rounded-2xl",
        motion.placement,
        selected && "ring-ring ring-2"
      )}
      {...getReactGrabOwnerProps({
        ownerId: `workspace:particle:${id}`,
        component: "WorkspaceParticleNode",
        source: "src/features/workspace-particles/components/particle-node.tsx",
        slot: "root",
      })}
      data-particle-size={displaySize}
      data-particle-kind={item.source.kind}
      aria-label={`${title}, ${displaySize} view`}
    >
      <Handle
        id="particle-in"
        type="target"
        position={Position.Left}
        isConnectable={canEdit}
        className="!bg-muted-foreground !border-background !size-2"
      />
      <Handle
        id="particle-out"
        type="source"
        position={Position.Right}
        isConnectable={canEdit}
        className="!bg-muted-foreground !border-background !size-2"
      />
      <NodeToolbar isVisible={selected} position={toolbarPosition} offset={12}>
        <div className="nodrag nopan bg-popover text-popover-foreground flex items-center gap-1 rounded-xl border p-1 shadow-md">
          {!fileIconOnly ? (
            <ToggleGroup
              type="single"
              size="sm"
              value={item.size}
              disabled={!canEdit}
              aria-label={`${title} display size`}
              onValueChange={(value) => {
                if (value === "icon" || value === "mini" || value === "large")
                  controller?.resize(id, value)
              }}
            >
              <ToggleGroupItem value="icon">Icon</ToggleGroupItem>
              <ToggleGroupItem value="mini">Mini</ToggleGroupItem>
              <ToggleGroupItem value="large">Large</ToggleGroupItem>
            </ToggleGroup>
          ) : null}
          {canEdit && source?.plan ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${source.plan.title} plan`}
              onClick={() => controller?.setEditingPlan(source.plan!.id)}
            >
              <PencilIcon />
            </Button>
          ) : null}
          {href && source?.available ? (
            <Button variant="ghost" size="icon" asChild>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  source.document
                    ? `Edit ${title} in Google (new tab)`
                    : `Edit ${title} (new tab)`
                }
              >
                <ExternalLinkIcon />
              </a>
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${title} from canvas`}
              onClick={() => controller?.remove(id)}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      </NodeToolbar>
      <WorkspaceNodeFrameSurface className="flex h-full flex-col gap-0 p-2">
        <WorkspaceNodeFrameHeader
          title={title}
          className={cn(
            "workspace-card-drag-handle cursor-grab items-center active:cursor-grabbing",
            icon
              ? "h-full flex-col justify-center gap-2 p-1"
              : "h-10 shrink-0 px-2"
          )}
        >
          <ParticleIcon
            kind={item.source.kind}
            className={icon ? "size-7" : "size-4"}
          />
          <h3
            className={cn(
              "min-w-0 font-medium",
              icon
                ? "line-clamp-1 max-w-full text-center text-[10px]"
                : "truncate text-sm"
            )}
          >
            {title}
          </h3>
        </WorkspaceNodeFrameHeader>
        {!icon ? (
          <WorkspaceNodeFrameBody
            className={cn(
              "nodrag nopan nowheel bg-background/70 min-h-0 flex-1 rounded-lg border",
              item.size === "large" ? "overflow-auto" : "overflow-hidden"
            )}
          >
            <ParticleContent
              source={source}
              large={item.size === "large"}
              selected={selected}
            />
          </WorkspaceNodeFrameBody>
        ) : null}
      </WorkspaceNodeFrameSurface>
    </WorkspaceNodeFrameRoot>
  )
})
