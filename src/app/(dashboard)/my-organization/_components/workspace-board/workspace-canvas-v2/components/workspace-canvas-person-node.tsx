"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import { memo } from "react"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Handle, Position, type NodeProps } from "@xyflow/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PERSON_CATEGORY_META } from "@/lib/people/categories"
import { cn } from "@/lib/utils"

import type { WorkspaceCanvasPersonNodeData } from "./workspace-canvas-surface-v2-helpers"

function getInitials(name?: string | null) {
  if (!name?.trim()) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

export const WorkspaceCanvasPersonNode = memo(
  function WorkspaceCanvasPersonNode({
    data,
  }: NodeProps<ReactFlowNode<WorkspaceCanvasPersonNodeData>>) {
    const { person, canEdit, onRemove } = data
    const isSupporter = person.category === "supporters"
    const categoryMeta = PERSON_CATEGORY_META[person.category]

    return (
      <div
        className="border-border/70 bg-card/95 relative flex h-16 w-[244px] items-center rounded-2xl border p-2 shadow-sm backdrop-blur"
        data-workspace-canvas-person-node="true"
        data-person-id={person.id}
      >
        <div className="workspace-person-node-drag-handle flex h-full min-w-0 flex-1 cursor-grab items-center gap-3 rounded-xl pr-12 pl-3 active:cursor-grabbing">
          <Avatar
            className={cn(
              "border-border/70 bg-muted/70 size-10 border shadow-xs",
              isSupporter && "rounded-xl"
            )}
          >
            <AvatarImage
              src={person.image ?? undefined}
              alt={person.name}
              className={cn(isSupporter && "object-contain p-1.5")}
            />
            <AvatarFallback
              className={cn(
                "text-xs font-semibold",
                isSupporter && "rounded-xl"
              )}
            >
              {getInitials(person.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-semibold">
              {person.name}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {person.title || categoryMeta.label}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 left-2 h-8 w-1 -translate-y-1/2 rounded-full",
            categoryMeta.stripClass
          )}
          aria-hidden
        />
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="nodrag nopan text-muted-foreground hover:text-foreground absolute top-1 right-1 size-11 touch-manipulation rounded-xl"
            onClick={() => onRemove(person.id)}
            aria-label={`Remove ${person.name} from canvas`}
          >
            <XIcon className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
        <Handle
          type="target"
          position={Position.Top}
          className="!border-transparent !bg-transparent opacity-0"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!border-transparent !bg-transparent opacity-0"
        />
      </div>
    )
  }
)
