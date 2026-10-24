"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import { memo, useLayoutEffect, useRef } from "react"
import { type NodeProps } from "@xyflow/react"

import { useWorkspaceNodeInternalsSync } from "@/lib/workspace-canvas/node-internals-sync"

import type {
  WorkspaceCanvasTutorialNodeData,
  WorkspaceCanvasTutorialPresentationMaskLayout,
} from "../types"

import { WorkspaceCanvasTutorialPanel } from "./workspace-canvas-tutorial-panel"

export const WorkspaceCanvasTutorialNode = memo(
  function WorkspaceCanvasTutorialNode({
    id,
    data,
  }: NodeProps<ReactFlowNode<WorkspaceCanvasTutorialNodeData>>) {
    const nodeRef = useRef<HTMLDivElement>(null)
    const lastReportedShellHeightRef = useRef<number | null>(null)
    const lastReportedHeightRef = useRef<number | null>(null)
    const lastReportedMaskLayoutRef = useRef<string | null>(null)
    const onMeasuredShellHeightChange = data.onMeasuredShellHeightChange
    const onMeasuredHeightChange = data.onMeasuredHeightChange
    const onPresentationMaskLayoutChange = data.onPresentationMaskLayoutChange
    useWorkspaceNodeInternalsSync(id, nodeRef)

    useLayoutEffect(() => {
      const element = nodeRef.current
      if (!element) return
      if (
        !onMeasuredShellHeightChange &&
        !onMeasuredHeightChange &&
        !onPresentationMaskLayoutChange
      ) {
        return
      }

      const reportShellHeight = () => {
        if (!onMeasuredShellHeightChange) return
        const shellElement = element.querySelector<HTMLElement>(
          "[data-workspace-tutorial-shell]",
        )
        const nextHeight = Math.round(
          Math.max(
            shellElement?.scrollHeight ?? 0,
            shellElement?.offsetHeight ?? element.offsetHeight,
          ),
        )
        if (lastReportedShellHeightRef.current === nextHeight) return
        lastReportedShellHeightRef.current = nextHeight
        onMeasuredShellHeightChange(nextHeight)
      }

      const reportHeight = () => {
        if (!onMeasuredHeightChange) return
        const presentationContentElement = element.querySelector<HTMLElement>(
          "[data-workspace-tutorial-card-content]",
        )
        const nextHeight = Math.round(
          presentationContentElement?.offsetHeight ?? element.offsetHeight,
        )
        if (lastReportedHeightRef.current === nextHeight) return
        lastReportedHeightRef.current = nextHeight
        onMeasuredHeightChange(nextHeight)
      }

      const reportMaskLayout = () => {
        if (!onPresentationMaskLayoutChange) return

        const maskElement = element.querySelector<HTMLElement>(
          "[data-workspace-tutorial-mask-for]",
        )
        const cardId =
          maskElement?.dataset
            .workspaceTutorialMaskFor as WorkspaceCanvasTutorialPresentationMaskLayout["cardId"] | undefined
        if (!maskElement || !cardId) {
          if (lastReportedMaskLayoutRef.current === "null") return
          lastReportedMaskLayoutRef.current = "null"
          onPresentationMaskLayoutChange(null)
          return
        }

        const nodeRect = element.getBoundingClientRect()
        const maskRect = maskElement.getBoundingClientRect()
        const scale =
          element.offsetWidth > 0 ? nodeRect.width / element.offsetWidth : 1
        const nextLayout = {
          cardId,
          x: Math.round((maskRect.left - nodeRect.left) / scale),
          y: Math.round((maskRect.top - nodeRect.top) / scale),
          width: Math.round(maskRect.width / scale),
          height: Math.round(maskRect.height / scale),
        }
        const nextLayoutKey = JSON.stringify(nextLayout)
        if (lastReportedMaskLayoutRef.current === nextLayoutKey) return
        lastReportedMaskLayoutRef.current = nextLayoutKey
        onPresentationMaskLayoutChange(nextLayout)
      }

      reportShellHeight()
      reportHeight()
      reportMaskLayout()

      const observer = new ResizeObserver(() => {
        reportShellHeight()
        reportHeight()
        reportMaskLayout()
      })
      observer.observe(element)
      const shellElement = element.querySelector<HTMLElement>(
        "[data-workspace-tutorial-shell]",
      )
      if (shellElement && shellElement !== element) {
        observer.observe(shellElement)
      }
      const presentationContentElement = element.querySelector<HTMLElement>(
        "[data-workspace-tutorial-card-content]",
      )
      if (
        presentationContentElement &&
        presentationContentElement !== element
      ) {
        observer.observe(presentationContentElement)
      }
      const maskElement = element.querySelector<HTMLElement>(
        "[data-workspace-tutorial-mask-for]",
      )
      if (
        maskElement &&
        maskElement !== element &&
        maskElement !== presentationContentElement
      ) {
        observer.observe(maskElement)
      }

      return () => observer.disconnect()
    }, [
      onMeasuredHeightChange,
      onMeasuredShellHeightChange,
      onPresentationMaskLayoutChange,
    ])

    return (
      <div
        ref={nodeRef}
        className="nopan pointer-events-none relative h-full w-full min-w-0"
      >
        <WorkspaceCanvasTutorialPanel
          stepIndex={data.stepIndex}
          openedStepIds={data.openedStepIds}
          attached={data.attached}
          dragEnabled={data.dragEnabled}
          dragHandleClassName={data.dragHandleClassName}
          variant={data.variant}
          onPrevious={data.onPrevious}
          onNext={data.onNext}
          presentationContent={data.presentationContent}
          presentationKey={data.presentationKey}
          presentationSurface={data.presentationSurface}
          className="mx-0 max-w-none"
        />
      </div>
    )
  },
)

WorkspaceCanvasTutorialNode.displayName = "WorkspaceCanvasTutorialNode"
