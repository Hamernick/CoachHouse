import { Position } from "@xyflow/react"

import { cn } from "@/lib/utils"

export function resolveWorkspaceBoardHandleClassName({
  position: _position,
  hidden = false,
}: {
  position: Position
  hidden?: boolean
}) {
  return cn(
    hidden && "!pointer-events-none !opacity-0",
  )
}
