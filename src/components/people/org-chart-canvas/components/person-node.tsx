import { memo } from "react"
import { Handle, Position } from "@xyflow/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { type PersonCategory } from "@/lib/people/categories"

import { CATEGORY_STRIP } from "../constants"
import { initials } from "../helpers"
import type { PersonNodeData } from "../types"

export const PersonNode = memo(function PersonNode({
  data,
}: {
  data: PersonNodeData
}) {
  const img = data.image ?? null
  const category = (data.category ?? "staff") as PersonCategory
  const isSupporter = category === "supporters"

  return (
    <div className="relative w-[240px] rounded-lg border border-border/70 bg-card p-2">
      <div className="flex items-center gap-3 pl-2">
        <Avatar
          className={cn(
            "size-10",
            isSupporter && "rounded-xl bg-muted/60 ring-1 ring-border/60",
          )}
        >
          <AvatarImage
            className={cn(isSupporter ? "object-contain p-1.5" : "object-cover")}
            src={img ?? undefined}
            alt={data.name}
          />
          <AvatarFallback className={cn(isSupporter && "rounded-xl")}>
            {initials(data.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{data.name}</div>
          <div className="truncate text-xs text-muted-foreground">{data.title}</div>
        </div>
      </div>
      <span
        className={cn(
          "pointer-events-none absolute left-2 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full",
          CATEGORY_STRIP[category],
        )}
        aria-hidden="true"
      />
      <Handle type="target" position={Position.Top} className="!bg-transparent" />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent"
      />
    </div>
  )
})
