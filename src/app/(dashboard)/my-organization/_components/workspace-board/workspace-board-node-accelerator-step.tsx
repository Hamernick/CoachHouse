"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import { AnimatePresence, motion } from "framer-motion"
import { memo, useRef } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"

import { resolveWorkspaceBoardHandleClassName } from "@/lib/workspace-canvas/handle-styles"
import { useWorkspaceNodeInternalsSync } from "@/lib/workspace-canvas/node-internals-sync"

import {
  ACCELERATOR_STEP_BOTTOM_TARGET_HANDLE_ID,
  ACCELERATOR_STEP_SIDE_TARGET_HANDLE_ID,
} from "./workspace-board-accelerator-step-layout"
import { WorkspaceBoardLazyAcceleratorStepNodeCard } from "./workspace-board-accelerator-lazy"
import type { WorkspaceBoardAcceleratorStepNodeData } from "./workspace-board-node"

export const WorkspaceBoardAcceleratorStepNode = memo(
  function WorkspaceBoardAcceleratorStepNode({
    id,
    data,
  }: NodeProps<ReactFlowNode<WorkspaceBoardAcceleratorStepNodeData>>) {
    const nodeRef = useRef<HTMLDivElement>(null)
    useWorkspaceNodeInternalsSync(id, nodeRef)
    if (!data.step) return null
    const isAbovePlacement = data.placement === "above"

    return (
      <div ref={nodeRef} className="relative h-auto w-full min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={data.step.id}
            initial={{
              opacity: 0,
              x: isAbovePlacement ? 0 : -56,
              y: isAbovePlacement ? 56 : 0,
              scale: 0.9,
              clipPath: isAbovePlacement
                ? "inset(42% 12% 0 12% round 22px)"
                : "inset(16% 48% 16% 0 round 22px)",
              filter: "blur(2px)",
            }}
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
              scale: 1,
              clipPath: "inset(0% 0% 0% 0% round 24px)",
              filter: "blur(0px)",
            }}
            exit={{
              opacity: 0,
              x: isAbovePlacement ? 0 : 24,
              y: isAbovePlacement ? -24 : 0,
              scale: 0.985,
              clipPath: isAbovePlacement
                ? "inset(0 12% 48% 12% round 20px)"
                : "inset(10% 0% 10% 54% round 20px)",
              filter: "blur(1.5px)",
            }}
            transition={{
              opacity: { duration: 0.2, ease: "easeOut" },
              x: { type: "spring", stiffness: 360, damping: 30, mass: 0.9 },
              y: { type: "spring", stiffness: 360, damping: 30, mass: 0.9 },
              scale: {
                type: "spring",
                stiffness: 300,
                damping: 26,
                mass: 0.9,
              },
              clipPath: { duration: 0.24, ease: "easeOut" },
              filter: { duration: 0.2, ease: "easeOut" },
            }}
            className={[
              "h-auto w-full min-w-0",
              isAbovePlacement ? "origin-bottom" : "origin-left",
            ].join(" ")}
          >
            <WorkspaceBoardLazyAcceleratorStepNodeCard
              step={data.step}
              placeholderVideoUrl={data.placeholderVideoUrl}
              stepIndex={data.stepIndex}
              stepTotal={data.stepTotal}
              canGoPrevious={data.canGoPrevious}
              canGoNext={data.canGoNext}
              completed={data.completed}
              moduleCompleted={data.moduleCompleted}
              onPrevious={data.onPrevious}
              onNext={data.onNext}
              onComplete={data.onComplete}
              onClose={data.onClose}
              tutorialCallout={data.tutorialCallout}
              onWorkspaceOnboardingSubmit={data.onWorkspaceOnboardingSubmit}
            />
          </motion.div>
        </AnimatePresence>
        <Handle
          type="target"
          position={Position.Left}
          id={ACCELERATOR_STEP_SIDE_TARGET_HANDLE_ID}
          className={resolveWorkspaceBoardHandleClassName({
            position: Position.Left,
            hidden: data.presentationMode || isAbovePlacement,
          })}
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id={ACCELERATOR_STEP_BOTTOM_TARGET_HANDLE_ID}
          className={resolveWorkspaceBoardHandleClassName({
            position: Position.Bottom,
            hidden: data.presentationMode || !isAbovePlacement,
          })}
        />
      </div>
    )
  }
)

WorkspaceBoardAcceleratorStepNode.displayName =
  "WorkspaceBoardAcceleratorStepNode"
