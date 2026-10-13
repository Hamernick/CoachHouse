"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import { StrictMode, useCallback, useState } from "react"
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useStoreApi,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import {
  WorkspaceReactFlowErrorBootstrap,
  type WorkspaceReactFlowErrorHandler,
} from "@/components/workspace/workspace-reactflow-error-bootstrap"
import { Button } from "@/components/ui/button"

const FIXTURE_NODES: Node[] = [
  {
    id: "source",
    type: "fixture",
    position: { x: 48, y: 72 },
    data: { label: "Organization" },
  },
  {
    id: "target",
    type: "fixture",
    position: { x: 304, y: 72 },
    data: { label: "Program" },
  },
]

const FIXTURE_EDGES: Edge[] = [
  { id: "source-target", source: "source", target: "target" },
]

function FixtureNodeType({ data }: NodeProps<ReactFlowNode<{ label: string }>>) {
  return (
    <div className="bg-card relative w-40 rounded-lg border px-4 py-3 text-sm shadow-sm">
      <Handle type="target" position={Position.Left} />
      {data.label}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function createFixtureNodeTypes(): NodeTypes {
  return { fixture: FixtureNodeType }
}

function WorkspaceReactFlowErrorBootstrapCaseContents() {
  const [nodeTypes, setNodeTypes] = useState(createFixtureNodeTypes)
  const [errors, setErrors] = useState<string[]>([])
  const [bootstrapKey, setBootstrapKey] = useState(0)
  const store = useStoreApi()
  const handleError = useCallback<WorkspaceReactFlowErrorHandler>(
    (errorCode, message) => {
      setErrors((current) => [...current, `${errorCode}: ${message}`])
    },
    []
  )
  const remountBootstrap = () => {
    store.setState({ onError: () => undefined })
    setBootstrapKey((current) => current + 1)
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={remountBootstrap}>
          Remount bootstrap
        </Button>
        <output data-testid="bootstrap-generation">{bootstrapKey}</output>
      </div>
      <WorkspaceReactFlowErrorBootstrap
        key={bootstrapKey}
        onError={handleError}
      >
        {(handleReactFlowError) => (
          <section className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNodeTypes(createFixtureNodeTypes())}
              >
                Replace node types
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  store.getState().onError?.("999", "Fixture error")
                }
              >
                Emit meaningful error
              </Button>
            </div>
            <div className="bg-card h-64 overflow-hidden rounded-xl border">
              <ReactFlow
                nodes={FIXTURE_NODES}
                edges={FIXTURE_EDGES}
                nodeTypes={nodeTypes}
                onError={handleReactFlowError}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={20} size={1} />
              </ReactFlow>
            </div>
            <output
              className="bg-muted/40 min-h-8 rounded-lg border px-3 py-2 text-xs"
              data-testid="meaningful-errors"
            >
              {errors.join("\n")}
            </output>
          </section>
        )}
      </WorkspaceReactFlowErrorBootstrap>
    </section>
  )
}

function WorkspaceReactFlowErrorBootstrapCase() {
  return (
    <ReactFlowProvider>
      <WorkspaceReactFlowErrorBootstrapCaseContents />
    </ReactFlowProvider>
  )
}

export function WorkspaceReactFlowErrorBootstrapFixture() {
  const [providerKey, setProviderKey] = useState(0)

  return (
    <StrictMode>
      <main
        className="mx-auto grid min-h-svh w-full max-w-3xl content-center gap-4 p-6"
        data-workspace-reactflow-error-bootstrap-fixture="true"
      >
        <Button
          className="w-fit"
          type="button"
          onClick={() => setProviderKey((current) => current + 1)}
        >
          Remount provider
        </Button>
        <output data-testid="provider-generation">{providerKey}</output>
        <WorkspaceReactFlowErrorBootstrapCase key={providerKey} />
      </main>
    </StrictMode>
  )
}
