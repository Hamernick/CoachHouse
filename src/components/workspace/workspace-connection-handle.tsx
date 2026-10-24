"use client"

import { useMemo, type ComponentProps } from "react"
import { Handle, useConnection, useNodeId, useStoreApi } from "@xyflow/react"
import { cn } from "@/lib/utils"
import styles from "./workspace-connection-handle.module.css"

/** Native handles own hit testing; the clipped halo is decorative and never intercepts input. */
export function WorkspaceConnectionHandle({
  className,
  style,
  ...props
}: ComponentProps<typeof Handle>) {
  const nodeId = useNodeId()
  const store = useStoreApi()
  const origin = useConnection((connection) =>
    connection.inProgress
      ? `${connection.fromHandle.nodeId}|${connection.fromHandle.type}|${connection.fromHandle.id}`
      : ""
  )
  const hovered = useConnection((connection) =>
    Boolean(
      connection.inProgress &&
      connection.isValid &&
      connection.toHandle?.nodeId === nodeId &&
      connection.toHandle?.id === props.id &&
      connection.toHandle?.type === props.type
    )
  )
  const compatible = useMemo(() => {
    if (!origin || !nodeId || props.isConnectable === false) return false
    const state = store.getState()
    const from = state.connection.fromHandle
    if (!from || from.nodeId === nodeId || from.type === props.type)
      return false
    const connection =
      props.type === "target"
        ? {
            source: from.nodeId,
            sourceHandle: from.id ?? null,
            target: nodeId,
            targetHandle: props.id ?? null,
          }
        : {
            source: nodeId,
            sourceHandle: props.id ?? null,
            target: from.nodeId,
            targetHandle: from.id ?? null,
          }
    return state.isValidConnection?.(connection) ?? false
  }, [origin, nodeId, props.id, props.type, props.isConnectable, store])
  const horizontal = props.position === "left" || props.position === "right"
  const haloStyle = horizontal
    ? { top: style?.top ?? "50%", [props.position]: 0 }
    : { left: style?.left ?? "50%", [props.position]: 0 }
  return (
    <>
      <span
        aria-hidden
        className={styles.halo}
        data-side={props.position}
        data-active={compatible || undefined}
        data-hovered={hovered || undefined}
        style={haloStyle}
      />
      <Handle
        {...props}
        style={style}
        className={cn(className, styles.handle, compatible && styles.available)}
      />
    </>
  )
}
