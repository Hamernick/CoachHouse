"use client"

import type { Edge as ReactFlowEdge } from "@xyflow/react"
import type { CSSProperties } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from "@xyflow/react"

import { cn } from "@/lib/utils"

import type {
  WorkspaceOntologyCategory,
  WorkspaceOntologyDetailLevel,
  WorkspaceOntologyStatus,
} from "../types"

export type WorkspaceOntologyEdgeData = {
  label?: string
  category?: WorkspaceOntologyCategory
  status?: WorkspaceOntologyStatus | string
  role?: string
  kind?: "hierarchy" | "relationship"
  showLabel?: boolean
  active?: boolean
  dimmed?: boolean
  detailLevel?: WorkspaceOntologyDetailLevel
  transitionPhase?: "entering" | "stable" | "exiting"
  transitionDelayMs?: number
}

const WORKSPACE_ONTOLOGY_EDGE_LABEL_CLASSNAME =
  "workspace-ontology-edge-label workspace-ontology-edge-presence border-border/80 bg-background text-foreground/80 dark:border-white/15 block max-w-44 truncate whitespace-nowrap rounded-full border px-2 py-1 text-[11px] leading-none font-medium shadow-sm"

export function WorkspaceOntologyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<ReactFlowEdge<WorkspaceOntologyEdgeData>>) {
  const transitionPhase = data?.transitionPhase ?? "stable"
  const transitionDelayMs = data?.transitionDelayMs ?? 0
  const transitionStyle = {
    "--workspace-ontology-wave-delay": `${transitionDelayMs}ms`,
  } as CSSProperties
  const showEdgeLabel =
    data?.showLabel === true &&
    data.detailLevel !== "overview" &&
    Boolean(data.label)
  const rootHierarchy =
    data?.kind === "hierarchy" && sourcePosition === Position.Bottom
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
    offset: data?.kind === "relationship" ? 180 : rootHierarchy ? 64 : 24,
  })
  const resolvedLabelX = rootHierarchy
    ? sourceX
    : data?.kind === "hierarchy"
      ? (sourceX + targetX) / 2
      : labelX
  const resolvedLabelY =
    data?.kind === "relationship"
      ? Math.max(sourceY, targetY) + 180
      : rootHierarchy
        ? sourceY + 64
        : labelY
  return (
    <>
      <g
        className={cn(
          data?.role === "workspace-ontology" &&
            "workspace-ontology-layout-edge"
        )}
      >
        <g
          className="workspace-ontology-edge-presence"
          data-transition-phase={transitionPhase}
          data-transition-delay-ms={transitionDelayMs}
          data-workspace-ontology-active={data?.active ? "true" : undefined}
          data-workspace-ontology-dimmed={data?.dimmed ? "true" : undefined}
          style={transitionStyle}
        >
          <BaseEdge
            id={id}
            path={edgePath}
            markerEnd={markerEnd}
            style={style}
          />
        </g>
      </g>
      {showEdgeLabel ? (
        <EdgeLabelRenderer>
          <span
            className={cn(
              "pointer-events-none absolute",
              data?.role === "workspace-ontology" &&
                "workspace-ontology-layout-edge"
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${resolvedLabelX}px, ${resolvedLabelY}px)`,
            }}
          >
            <span
              className={WORKSPACE_ONTOLOGY_EDGE_LABEL_CLASSNAME}
              data-workspace-ontology-edge-kind={data?.kind}
              data-workspace-ontology-edge-label="true"
              data-workspace-ontology-active={data?.active ? "true" : undefined}
              data-workspace-ontology-dimmed={data?.dimmed ? "true" : undefined}
              data-transition-phase={transitionPhase}
              data-transition-delay-ms={transitionDelayMs}
              style={transitionStyle}
              title={data?.label}
            >
              {data?.label}
            </span>
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
