"use client"

import "@xyflow/react/dist/style.css"

import { useMemo } from "react"
import { ReactFlow, Background, BackgroundVariant, type Node } from "@xyflow/react"

import { WorkspaceOntologyNode } from "./workspace-ontology-node"
import { resolveWorkspaceOntologyNodeSize } from "../lib"
import type {
  WorkspaceOntologyDetailLevel,
  WorkspaceOntologyProjectedNode,
} from "../types"
import type { WorkspaceOntologyNodeData } from "./workspace-ontology-node"

const NODE_TYPES = {
  "workspace-ontology": WorkspaceOntologyNode,
}

function buildFixtureNode({
  id,
  label,
  statusLabel,
  ownerLabel,
  detailLevel,
  x,
  hasChildren = false,
  selected = false,
}: {
  id: string
  label: string
  statusLabel: string
  ownerLabel: string | null
  detailLevel: WorkspaceOntologyDetailLevel
  x: number
  hasChildren?: boolean
  selected?: boolean
}): Node<WorkspaceOntologyNodeData> {
  const node: WorkspaceOntologyProjectedNode = {
    id,
    label,
    description: "Visual containment fixture.",
    category: hasChildren ? "accelerator" : "organization",
    kind: hasChildren ? "Operational section" : "Required record",
    status: "in-progress",
    statusLabel,
    relationshipLabel: "contains",
    href: "/workspace?view=editor&tab=company",
    actionLabel: "Open exact completion workflow",
    ownerLabel,
    rootId: hasChildren ? "accelerator" : "organization-overview",
    parentId: hasChildren ? "accelerator" : "organization-overview",
    depth: 1,
    childCount: hasChildren ? 417 : 0,
    hasChildren,
    presentation: hasChildren ? "group" : "action",
  }
  const size = resolveWorkspaceOntologyNodeSize(node)
  return {
    id,
    type: "workspace-ontology",
    position: { x, y: 96 },
    width: size.width,
    height: size.height,
    style: size,
    selected,
    draggable: false,
    selectable: true,
    focusable: false,
    data: {
      kind: "workspace-ontology",
      node,
      detailLevel,
      expanded: false,
    },
  }
}

export function WorkspaceOntologyVisualFixture() {
  const nodes = useMemo(
    () => [
      buildFixtureNode({
        id: "visual:overview",
        label:
          "A deliberately long organization requirement that must stay inside",
        statusLabel: "In progress with a deliberately long status",
        ownerLabel: "Operations lead with a deliberately long name",
        detailLevel: "overview",
        x: 0,
      }),
      buildFixtureNode({
        id: "visual:standard",
        label: "Standard density keeps the status contained",
        statusLabel: "In progress with a deliberately long status",
        ownerLabel: "Hidden outside full detail",
        detailLevel: "standard",
        x: 320,
      }),
      buildFixtureNode({
        id: "visual:full",
        label: "Full density keeps owner information contained",
        statusLabel: "In progress",
        ownerLabel: "Operations lead with a deliberately long name",
        detailLevel: "full",
        x: 640,
      }),
      buildFixtureNode({
        id: "visual:selected-group",
        label: "Selected accelerator section with many connected requirements",
        statusLabel: "In progress",
        ownerLabel: "Program operations",
        detailLevel: "full",
        x: 960,
        hasChildren: true,
        selected: true,
      }),
    ],
    []
  )

  return (
    <main className="bg-background text-foreground min-h-dvh p-8">
      <section className="mx-auto max-w-[74rem]">
        <header className="mb-5">
          <h1 className="text-lg font-semibold text-balance">
            Workspace ontology node containment
          </h1>
          <p className="text-muted-foreground mt-1 text-sm text-pretty">
            Overview, standard, full, and selected group states using extreme
            content lengths.
          </p>
        </header>
        <div
          data-workspace-ontology-visual-fixture="true"
          className="workspace-flow border-border relative h-[24rem] overflow-hidden rounded-2xl border bg-[#fcfcfc] dark:bg-zinc-800"
        >
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.16, minZoom: 0.2, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={1}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnPinch={false}
            zoomOnScroll={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1}
              color="rgba(113, 113, 122, 0.32)"
            />
          </ReactFlow>
        </div>
      </section>
    </main>
  )
}
