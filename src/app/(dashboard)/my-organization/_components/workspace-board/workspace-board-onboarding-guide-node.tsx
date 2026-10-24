"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import Link from "next/link"
import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import XIcon from "lucide-react/dist/esm/icons/x"
import { memo, useRef } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"

import { Button } from "@/components/ui/button"
import { resolveWorkspaceBoardHandleClassName } from "@/lib/workspace-canvas/handle-styles"
import { useWorkspaceNodeInternalsSync } from "@/lib/workspace-canvas/node-internals-sync"
import { cn } from "@/lib/utils"

import {
  WORKSPACE_ONBOARDING_STAGE_DEFINITIONS,
  WORKSPACE_ONBOARDING_STAGE_ORDER,
} from "./workspace-board-onboarding-flow"
import type { WorkspaceOnboardingStage } from "./workspace-board-types"

export type WorkspaceBoardOnboardingNodeData = {
  stage: WorkspaceOnboardingStage
  completedStages: WorkspaceOnboardingStage[]
  stageIndex: number
  stageTotal: number
  targetLabel: string
  primaryLabel: string
  primaryHref: string | null
  canGoPrevious: boolean
  canGoNext: boolean
  canCompleteStage: boolean
  onPrimaryAction: () => void
  onPrevious: () => void
  onNext: () => void
  onDismiss: () => void
}

export const WorkspaceBoardOnboardingGuideNode = memo(
  function WorkspaceBoardOnboardingGuideNode({
    id,
    data,
  }: NodeProps<ReactFlowNode<WorkspaceBoardOnboardingNodeData>>) {
    const stageKey = data.stage
    const stageDefinition =
      WORKSPACE_ONBOARDING_STAGE_DEFINITIONS[stageKey] ??
      WORKSPACE_ONBOARDING_STAGE_DEFINITIONS[2]
    const completedStageSet = new Set<WorkspaceOnboardingStage>(
      data.completedStages
    )
    const nodeRef = useRef<HTMLElement>(null)
    useWorkspaceNodeInternalsSync(id, nodeRef)

    return (
      <article
        ref={nodeRef}
        className="border-border/70 bg-card/96 flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[22px] border shadow-[0_18px_52px_-36px_rgba(15,23,42,0.34)] backdrop-blur"
      >
        <header className="border-border/65 bg-muted/25 border-b px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Canvas onboarding
              </p>
              <h3 className="text-foreground mt-1 line-clamp-1 text-sm font-semibold">
                Stage {data.stage} · {stageDefinition.title}
              </h3>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-lg"
              onClick={data.onDismiss}
              aria-label="Dismiss workspace onboarding flow"
            >
              <XIcon className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {WORKSPACE_ONBOARDING_STAGE_ORDER.map((stage, index) => {
              const isCurrent = stage === data.stage
              const isComplete = completedStageSet.has(stage)
              return (
                <div key={stage} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 text-[10px] font-medium tabular-nums",
                      isCurrent
                        ? "border-primary/55 bg-primary/12 text-primary"
                        : isComplete
                          ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "border-border/70 bg-background/70 text-muted-foreground"
                    )}
                  >
                    {stage}
                  </span>
                  {index < WORKSPACE_ONBOARDING_STAGE_ORDER.length - 1 ? (
                    <span className="bg-border/75 block h-px w-4" aria-hidden />
                  ) : null}
                </div>
              )
            })}
            <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
              {data.stageIndex + 1}/{data.stageTotal}
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {stageDefinition.description}
          </p>
          <ul className="space-y-1.5">
            {stageDefinition.checklist.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
                  <CheckIcon
                    className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400"
                    aria-hidden
                  />
                </span>
                <span className="text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Connected to{" "}
            <span className="text-foreground font-medium">{data.targetLabel}</span> on the canvas.
          </p>
        </div>

        <footer className="border-border/60 bg-muted/15 flex items-center justify-between gap-2 border-t px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={data.onPrevious}
              disabled={!data.canGoPrevious}
            >
              Back
            </Button>
            {data.primaryHref ? (
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-8 rounded-lg px-2.5 text-xs"
              >
                <Link href={data.primaryHref} onClick={data.onPrimaryAction}>
                  {data.primaryLabel}
                  <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-lg px-2.5 text-xs"
                onClick={data.onPrimaryAction}
              >
                {data.primaryLabel}
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs"
            onClick={data.onNext}
            disabled={!data.canCompleteStage}
          >
            {data.canGoNext ? "Complete stage" : "Finish flow"}
          </Button>
        </footer>

        <Handle
          type="target"
          position={Position.Left}
          className={resolveWorkspaceBoardHandleClassName({
            position: Position.Left,
          })}
        />
        <Handle
          type="source"
          position={Position.Right}
          className={resolveWorkspaceBoardHandleClassName({
            position: Position.Right,
          })}
        />
      </article>
    )
  }
)

WorkspaceBoardOnboardingGuideNode.displayName = "WorkspaceBoardOnboardingGuideNode"
