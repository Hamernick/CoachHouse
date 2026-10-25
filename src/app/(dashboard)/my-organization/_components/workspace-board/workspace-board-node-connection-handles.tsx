import { WorkspaceConnectionHandle } from "@/components/workspace/workspace-connection-handle"
import { Position } from "@xyflow/react"

import { resolveWorkspaceBoardHandleClassName } from "@/lib/workspace-canvas/handle-styles"

import {
  ACCELERATOR_STEP_SIDE_SOURCE_HANDLE_ID,
  ACCELERATOR_STEP_TOP_SOURCE_HANDLE_ID,
} from "./workspace-board-accelerator-step-layout"
import {
  WORKSPACE_CARD_CONNECTION_HANDLE_SIDES,
  WORKSPACE_CARD_SOURCE_HANDLE_IDS,
  WORKSPACE_CARD_TARGET_HANDLE_IDS,
  resolveWorkspaceCardHandlePosition,
} from "./workspace-board-connection-handles"
import type { WorkspaceCardId } from "./workspace-board-types"

export function WorkspaceBoardNodeConnectionHandles({
  cardId,
  presentationMode,
}: {
  cardId: WorkspaceCardId
  presentationMode: boolean
}) {
  return (
    <>
      {WORKSPACE_CARD_CONNECTION_HANDLE_SIDES.map((side) => {
        const position = resolveWorkspaceCardHandlePosition(side)

        return (
          <WorkspaceConnectionHandle
            key={`source-${side}`}
            isConnectable={!presentationMode}
            type="source"
            position={position}
            id={WORKSPACE_CARD_SOURCE_HANDLE_IDS[side]}
            className={resolveWorkspaceBoardHandleClassName({
              position,
              hidden: presentationMode,
            })}
          />
        )
      })}
      {cardId === "accelerator" ? (
        <>
          <WorkspaceConnectionHandle
            isConnectable={!presentationMode}
            type="source"
            position={Position.Right}
            id={ACCELERATOR_STEP_SIDE_SOURCE_HANDLE_ID}
            className={resolveWorkspaceBoardHandleClassName({
              position: Position.Right,
              hidden: true,
            })}
          />
          <WorkspaceConnectionHandle
            isConnectable={!presentationMode}
            type="source"
            position={Position.Top}
            id={ACCELERATOR_STEP_TOP_SOURCE_HANDLE_ID}
            className={resolveWorkspaceBoardHandleClassName({
              position: Position.Top,
              hidden: true,
            })}
          />
        </>
      ) : null}
      {WORKSPACE_CARD_CONNECTION_HANDLE_SIDES.map((side) => {
        const position = resolveWorkspaceCardHandlePosition(side)

        return (
          <WorkspaceConnectionHandle
            key={`target-${side}`}
            isConnectable={!presentationMode}
            type="target"
            position={position}
            id={WORKSPACE_CARD_TARGET_HANDLE_IDS[side]}
            className={resolveWorkspaceBoardHandleClassName({
              position,
              hidden: presentationMode,
            })}
          />
        )
      })}
    </>
  )
}
