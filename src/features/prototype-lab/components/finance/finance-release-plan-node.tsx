"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import CheckCircle2Icon from "lucide-react/dist/esm/icons/check-circle-2"
import CircleAlertIcon from "lucide-react/dist/esm/icons/circle-alert"
import DatabaseIcon from "lucide-react/dist/esm/icons/database"
import FlaskConicalIcon from "lucide-react/dist/esm/icons/flask-conical"
import GitMergeIcon from "lucide-react/dist/esm/icons/git-merge"
import MapIcon from "lucide-react/dist/esm/icons/map"
import NetworkIcon from "lucide-react/dist/esm/icons/network"
import RocketIcon from "lucide-react/dist/esm/icons/rocket"
import ScaleIcon from "lucide-react/dist/esm/icons/scale"
import ShieldCheckIcon from "lucide-react/dist/esm/icons/shield-check"
import UserRoundIcon from "lucide-react/dist/esm/icons/user-round"
import type { ReactNode } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"
import {
  WorkspaceNodeFrameBody,
  WorkspaceNodeFrameFooter,
  WorkspaceNodeFrameHeader,
  WorkspaceNodeFrameRoot,
  WorkspaceNodeFrameSurface,
} from "@/components/workspace/workspace-node-frame"
import { cn } from "@/lib/utils"

import type {
  FinancePlanBatchReadinessState,
  FinancePlanGateState,
  FinancePlanInputState,
  FinanceReleasePlanNodeData,
  FinanceReleasePlanNodeKind,
} from "./finance-release-plan-data"
import {
  getFinancePlanNodeStatusTone,
  getFinancePlanStatusBadgeClassName,
  getFinancePlanStatusBorderClassName,
} from "./finance-plan-status"

function getBatchReadinessLabel(state: FinancePlanBatchReadinessState) {
  switch (state) {
    case "merged":
      return "Merged"
    case "in_progress":
      return "In progress"
    case "ready":
      return "Ready"
    default:
      return "Blocked"
  }
}

function getGateStateLabel(state: FinancePlanGateState) {
  switch (state) {
    case "collecting":
      return "Collecting evidence"
    case "proven":
      return "Proven"
    default:
      return "Not started"
  }
}

function getInputStateLabel(state: FinancePlanInputState) {
  return state === "resolved" ? "Resolved" : "Open"
}

function getNodeIcon(kind: FinanceReleasePlanNodeKind): ReactNode {
  switch (kind) {
    case "start":
      return <CircleAlertIcon aria-hidden="true" className="size-4" />
    case "guardrail":
      return <ShieldCheckIcon aria-hidden="true" className="size-4" />
    case "decision":
      return <ScaleIcon aria-hidden="true" className="size-4" />
    case "batch":
      return <GitMergeIcon aria-hidden="true" className="size-4" />
    case "gate":
      return <CheckCircle2Icon aria-hidden="true" className="size-4" />
    case "research":
      return <FlaskConicalIcon aria-hidden="true" className="size-4" />
    case "finish":
      return <RocketIcon aria-hidden="true" className="size-4" />
    case "actor":
      return <UserRoundIcon aria-hidden="true" className="size-4" />
    case "surface":
      return <MapIcon aria-hidden="true" className="size-4" />
    case "service":
      return <NetworkIcon aria-hidden="true" className="size-4" />
    case "data":
      return <DatabaseIcon aria-hidden="true" className="size-4" />
    case "external":
      return <FlaskConicalIcon aria-hidden="true" className="size-4" />
    default:
      return <MapIcon aria-hidden="true" className="size-4" />
  }
}

function FinanceReleasePlanLaneNode({
  data,
}: {
  data: FinanceReleasePlanNodeData
}) {
  return (
    <aside
      className="border-border pointer-events-none border-l-2 pl-4"
      data-finance-release-plan-kind="lane"
    >
      <p className="text-muted-foreground text-xs font-medium">
        {data.eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-balance">{data.title}</h2>
      <p className="text-muted-foreground mt-1 text-xs leading-5 text-pretty">
        {data.summary}
      </p>
    </aside>
  )
}

function FinanceReleasePlanHandles({
  diagram,
  isConnectable,
  kind,
}: {
  diagram?: boolean
  isConnectable: boolean
  kind: FinanceReleasePlanNodeKind
}) {
  if (diagram) {
    return (
      <>
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-zinc-400"
          id="diagram-target"
          isConnectable={isConnectable}
          position={Position.Left}
          type="target"
        />
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-zinc-400"
          id="diagram-source"
          isConnectable={isConnectable}
          position={Position.Right}
          type="source"
        />
      </>
    )
  }

  const sequenceInput = ["batch", "gate", "finish"].includes(kind)
  const sequenceOutput = ["start", "batch", "gate"].includes(kind)
  const approvalOutput = ["guardrail", "decision"].includes(kind)
  const approvalInput = kind === "batch" || kind === "start"
  const researchOutput = kind === "research"
  const researchInput = kind === "batch"

  return (
    <>
      {sequenceInput ? (
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-zinc-400"
          id="target"
          isConnectable={isConnectable}
          position={Position.Left}
          type="target"
        />
      ) : null}
      {sequenceOutput ? (
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-zinc-400"
          id="source"
          isConnectable={isConnectable}
          position={Position.Right}
          type="source"
        />
      ) : null}
      {approvalInput ? (
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-amber-500"
          id="approval-target"
          isConnectable={isConnectable}
          position={Position.Top}
          type="target"
        />
      ) : null}
      {approvalOutput ? (
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-amber-500"
          id="approval-source"
          isConnectable={isConnectable}
          position={Position.Bottom}
          type="source"
        />
      ) : null}
      {researchInput ? (
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-amber-500"
          id="research-target"
          isConnectable={isConnectable}
          position={Position.Bottom}
          type="target"
        />
      ) : null}
      {researchOutput ? (
        <Handle
          className="!border-card !size-2.5 !border-2 !bg-amber-500"
          id="research-source"
          isConnectable={isConnectable}
          position={Position.Top}
          type="source"
        />
      ) : null}
    </>
  )
}

function FinanceReleasePlanCurrentState({
  data,
}: {
  data: FinanceReleasePlanNodeData
}) {
  const implementationComplete =
    Boolean(data.workItems?.length) &&
    data.workItems?.every((item) => item.state === "complete")
  const stateLabel = implementationComplete
    ? "Implementation complete"
    : data.readinessState
      ? getBatchReadinessLabel(data.readinessState)
      : data.gateState
        ? getGateStateLabel(data.gateState)
        : data.inputState
          ? getInputStateLabel(data.inputState)
          : null

  if (!stateLabel) return null

  return (
    <section
      aria-label="Current state"
      className="border-border/70 bg-muted/40 mt-4 rounded-lg border p-3"
      data-finance-release-plan-current-state={
        data.readinessState ?? data.gateState ?? data.inputState
      }
    >
      <p className="text-foreground text-xs font-semibold">Current state</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge
          className={cn(
            "rounded-full",
            getFinancePlanStatusBadgeClassName(
              getFinancePlanNodeStatusTone(data)
            )
          )}
          variant="outline"
        >
          {stateLabel}
        </Badge>
        {data.readinessDetails?.map((detail) => (
          <Badge
            className="rounded-full tabular-nums"
            key={detail}
            variant="outline"
          >
            {detail}
          </Badge>
        ))}
      </div>
    </section>
  )
}

export function FinanceReleasePlanNode({
  data,
  isConnectable,
}: NodeProps<ReactFlowNode<FinanceReleasePlanNodeData>>) {
  if (data.kind === "lane") {
    return <FinanceReleasePlanLaneNode data={data} />
  }

  return (
    <WorkspaceNodeFrameRoot
      className={cn(
        "workspace-card-drag-handle bg-card h-full w-full cursor-grab rounded-xl shadow-sm active:cursor-grabbing",
        getFinancePlanStatusBorderClassName(getFinancePlanNodeStatusTone(data)),
        data.kind === "gate" && "border-dashed"
      )}
      data-finance-release-plan-kind={data.kind}
    >
      <FinanceReleasePlanHandles
        diagram={data.diagram}
        isConnectable={isConnectable}
        kind={data.kind}
      />
      <WorkspaceNodeFrameSurface className="flex h-full flex-col">
        <WorkspaceNodeFrameHeader className="border-border/60 shrink-0 border-b px-5 py-4">
          <div className="border-border/70 bg-muted text-foreground grid size-9 shrink-0 place-items-center rounded-lg border">
            {getNodeIcon(data.kind)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground truncate text-xs font-medium">
              {data.eyebrow}
            </p>
            <h2 className="mt-0.5 text-base leading-5 font-semibold text-balance">
              {data.title}
            </h2>
          </div>
          <Badge
            className={cn(
              "shrink-0 rounded-full",
              getFinancePlanStatusBadgeClassName(
                getFinancePlanNodeStatusTone(data)
              )
            )}
            variant="outline"
          >
            {data.statusLabel}
          </Badge>
        </WorkspaceNodeFrameHeader>

        <WorkspaceNodeFrameBody className="nowheel nodrag nopan min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-muted-foreground text-sm leading-6 text-pretty">
            {data.summary}
          </p>

          <FinanceReleasePlanCurrentState data={data} />

          {data.dependencies?.length ? (
            <section className="mt-4" aria-label="Dependencies">
              <p className="text-foreground text-xs font-semibold">
                Depends on
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.dependencies.map((dependency) => (
                  <Badge
                    className="rounded-full"
                    key={dependency}
                    variant="secondary"
                  >
                    {dependency}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-4 space-y-4">
            {data.sections.map((section) => (
              <section key={section.label}>
                <h3 className="text-foreground text-xs font-semibold">
                  {section.label}
                </h3>
                <ul className="mt-2 space-y-2">
                  {section.items.map((item) => (
                    <li
                      className="text-muted-foreground flex gap-2 text-xs leading-5"
                      key={item}
                    >
                      <span
                        aria-hidden="true"
                        className="bg-foreground/45 mt-2 size-1.5 shrink-0 rounded-full"
                      />
                      <span className="text-pretty">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </WorkspaceNodeFrameBody>

        {data.footer ? (
          <WorkspaceNodeFrameFooter className="border-border/60 shrink-0 border-t px-5 py-3">
            <p className="text-muted-foreground text-xs leading-5 text-pretty">
              {data.footer}
            </p>
          </WorkspaceNodeFrameFooter>
        ) : null}
      </WorkspaceNodeFrameSurface>
    </WorkspaceNodeFrameRoot>
  )
}
