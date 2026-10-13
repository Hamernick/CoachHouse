"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import {
  WorkspaceNodeFrameRoot,
  WorkspaceNodeFrameSurface,
} from "@/components/workspace/workspace-node-frame"
import { cn } from "@/lib/utils"
import type { DocumentationDecisionStep } from "../types"

export type DecisionStepNodeData = DocumentationDecisionStep & {
  index: number
  active: boolean
  reviewed: boolean
  disabled: boolean
  incoming: boolean
  outgoing: boolean
  vertical: boolean
  onSelect: (id: string, trigger: HTMLButtonElement) => void
  onFocus: (id: string) => void
}

export const DecisionStepNode = memo(function DecisionStepNode({
  data,
}: NodeProps<ReactFlowNode<DecisionStepNodeData>>) {
  return (
    <WorkspaceNodeFrameRoot
      {...getReactGrabOwnerProps({
        ownerId: `documentation:decision-step:${data.id}`,
        component: "DecisionStepNode",
        source:
          "src/features/documentation-decision-canvas/components/decision-step-node.tsx",
        slot: "decision-step",
        tokenSource:
          "src/features/documentation-decision-canvas/components/decision-canvas.module.css",
      })}
      className={cn(
        "border-border/60 bg-card pointer-events-auto w-[232px] rounded-2xl shadow-sm",
        data.active &&
          "border-primary bg-primary text-primary-foreground shadow-md"
      )}
    >
      {data.incoming && (
        <Handle
          type="target"
          position={data.vertical ? Position.Top : Position.Left}
          isConnectable={false}
          className="!border-background !bg-muted-foreground !size-2"
        />
      )}
      <WorkspaceNodeFrameSurface>
        <Button
          variant="ghost"
          type="button"
          data-decision-node-button
          aria-label={`Open ${data.label}`}
          aria-current={data.active ? "step" : undefined}
          disabled={data.disabled}
          onClick={(event) => data.onSelect(data.id, event.currentTarget)}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible"))
              data.onFocus(data.id)
          }}
          className={cn(
            "nodrag nopan h-auto min-h-[92px] w-full justify-start gap-3 rounded-2xl px-4 py-4 text-left whitespace-normal",
            data.active && "hover:bg-primary/90 hover:text-primary-foreground"
          )}
        >
          <span
            className={cn(
              "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
              data.active && "bg-primary-foreground/15 text-primary-foreground",
              data.reviewed && "bg-chart-2/15 text-chart-2"
            )}
          >
            {data.reviewed ? (
              <CheckIcon className="size-4" aria-hidden />
            ) : (
              String(data.index + 1).padStart(2, "0")
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-5 font-medium">
              {data.label}
            </span>
            <span
              className={cn(
                "mt-1 block text-xs font-normal",
                data.active
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground"
              )}
            >
              {data.reviewed
                ? "Reviewed"
                : data.active
                  ? "Continue here"
                  : data.id === "review"
                    ? "Your working plan"
                    : "Open step"}
            </span>
          </span>
          <ArrowUpRightIcon
            className="size-3.5 shrink-0 opacity-60"
            aria-hidden
          />
        </Button>
      </WorkspaceNodeFrameSurface>
      {data.outgoing && (
        <Handle
          type="source"
          position={data.vertical ? Position.Bottom : Position.Right}
          isConnectable={false}
          className="!border-background !bg-muted-foreground !size-2"
        />
      )}
    </WorkspaceNodeFrameRoot>
  )
})
