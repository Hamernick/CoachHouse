"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import WorkflowIcon from "lucide-react/dist/esm/icons/workflow"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { cn } from "@/lib/utils"
import { buildDocumentationDecisionGraph } from "../lib"
import type { DocumentationDecisionStep } from "../types"
import {
  DecisionStepNode,
  type DecisionStepNodeData,
} from "./decision-step-node"
import { AnimatePresence } from "motion/react"
import { DecisionCanvasFooter } from "./decision-canvas-footer"
import {
  DecisionCanvasEditor,
  type DecisionEditorContent,
} from "./decision-canvas-editor"
import { useDecisionCanvasExpansion } from "../hooks/use-decision-canvas-expansion"
import "@xyflow/react/dist/style.css"
import styles from "./decision-canvas.module.css"

const nodeTypes = { decision: DecisionStepNode }
const fitOptions = { padding: 0.14, minZoom: 0.65, maxZoom: 1.1 }

type CanvasProps = {
  title: string
  steps: DocumentationDecisionStep[]
  activeId: string
  reviewed: string[]
  disabled: boolean
  onSelect: (id: string) => void
  onClose: () => void
  editor: DecisionEditorContent | null
}

function DecisionCanvas({
  title,
  steps,
  activeId,
  reviewed,
  disabled,
  onSelect,
  onClose,
  editor,
}: CanvasProps) {
  const [vertical, setVertical] = useState(false)
  const [list, setList] = useState(false)
  const [measured, setMeasured] = useState(false)
  const flow = useReactFlow()
  const graph = useMemo(
    () => buildDocumentationDecisionGraph(steps, vertical),
    [steps, vertical]
  )
  const focusStep = useCallback(
    (id: string) => {
      const node = flow.getNode(id)
      if (node)
        void flow.setCenter(node.position.x + 116, node.position.y + 46, {
          zoom: 1,
        })
    },
    [flow]
  )
  const { container, origin, selectStep, collapse, restoreFocus } =
    useDecisionCanvasExpansion({
      editorId: editor?.id ?? null,
      onSelect,
      onClose,
      focusStep,
    })
  const nodes = useMemo<Node<DecisionStepNodeData>[]>(
    () =>
      graph.steps.map((step, index) => ({
        id: step.id,
        type: "decision",
        position: step.position,
        data: {
          ...step,
          index,
          active: step.id === activeId,
          reviewed: reviewed.includes(step.id),
          disabled,
          vertical,
          onSelect: selectStep,
          onFocus: focusStep,
        },
      })),
    [graph, activeId, reviewed, disabled, vertical, selectStep, focusStep]
  )
  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        type: "smoothstep",
        style: {
          stroke: reviewed.includes(edge.source)
            ? "var(--chart-2)"
            : "color-mix(in oklab, var(--muted-foreground) 35%, transparent)",
          strokeWidth: 1.5,
        },
      })),
    [graph, reviewed]
  )

  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width <= 0) return
      setVertical(entry.contentRect.width < 640)
      setMeasured(true)
    })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [container])
  useEffect(() => {
    if (!measured) return
    const frame = requestAnimationFrame(() => {
      if (vertical) {
        const node = graph.steps[0]
        if (node) void flow.setCenter(116, node.position.y + 116, { zoom: 1 })
      } else void flow.fitView(fitOptions)
    })
    return () => cancelAnimationFrame(frame)
  }, [vertical, measured, flow, graph])

  return (
    <section
      className={styles.canvas}
      aria-label="Decision canvas"
      onKeyDown={(event) => {
        if (
          editor &&
          event.key === "Escape" &&
          !event.defaultPrevented &&
          !(
            event.target instanceof Element &&
            event.target.closest(
              '[role="listbox"], [data-slot="select-content"]'
            )
          )
        ) {
          event.preventDefault()
          collapse()
        }
      }}
      {...getReactGrabOwnerProps({
        ownerId: "documentation:decision-canvas",
        component: "DocumentationDecisionCanvasPanel",
        source:
          "src/features/documentation-decision-canvas/components/documentation-decision-canvas-panel.tsx",
        slot: "decision-canvas",
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="bg-background flex size-10 shrink-0 items-center justify-center rounded-2xl border">
            <WorkflowIcon
              className="text-muted-foreground size-4"
              aria-hidden
            />
          </span>
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="text-muted-foreground text-xs">
              Open a step. Shape your plan.
            </p>
          </div>
        </div>
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-xs">
          Your working draft
        </span>
      </div>
      <div
        ref={container}
        data-decision-viewport
        className="border-border/40 bg-muted/30 relative mx-2 h-[clamp(16rem,48dvh,380px)] overflow-hidden rounded-2xl border sm:mx-3 sm:h-[340px] lg:h-[360px]"
      >
        <div
          className={styles.graph}
          data-editing={Boolean(editor)}
          aria-hidden={Boolean(editor) || undefined}
          inert={Boolean(editor) || undefined}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            minZoom={0.35}
            maxZoom={1.5}
            fitView
            fitViewOptions={fitOptions}
            className={cn(list && "invisible")}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1}
              color="color-mix(in oklab, var(--muted-foreground) 28%, transparent)"
            />
          </ReactFlow>
          {list && (
            <ol
              aria-label="Planner steps"
              className="absolute inset-0 space-y-2 overflow-y-auto p-4"
            >
              {steps.map((step, index) => (
                <li key={step.id}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={(event) =>
                      selectStep(step.id, event.currentTarget)
                    }
                    data-decision-list-step={step.id}
                    className="bg-card h-auto min-h-16 w-full justify-start gap-3 rounded-xl px-4 py-3 text-left whitespace-normal"
                    aria-label={`Open ${step.label}`}
                    aria-current={step.id === activeId ? "step" : undefined}
                  >
                    <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums">
                      {reviewed.includes(step.id) ? (
                        <CheckIcon
                          className="text-chart-2 size-4"
                          aria-hidden
                        />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="flex-1">{step.label}</span>
                    {reviewed.includes(step.id) && (
                      <span className="text-muted-foreground text-xs">
                        Reviewed
                      </span>
                    )}
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <AnimatePresence
          initial={false}
          custom={origin}
          onExitComplete={restoreFocus}
        >
          {editor && (
            <DecisionCanvasEditor
              key="expanded-node"
              editor={editor}
              origin={origin}
              onClose={collapse}
            />
          )}
        </AnimatePresence>
      </div>
      <DecisionCanvasFooter
        steps={steps}
        reviewed={reviewed}
        disabled={disabled}
        list={list}
        onToggle={() => setList((value) => !value)}
        onSelect={selectStep}
        editorActions={editor?.actions}
      />
    </section>
  )
}

export function DocumentationDecisionCanvasPanel(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <DecisionCanvas {...props} />
    </ReactFlowProvider>
  )
}
