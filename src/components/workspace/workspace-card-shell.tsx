import type { ComponentProps } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function WorkspaceCardShell({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "border-border/60 bg-muted relative w-full max-w-[42rem] rounded-[2rem] shadow-sm",
        className
      )}
      {...props}
    />
  )
}

export const WORKSPACE_CARD_CONTENT_SURFACE_CLASS_NAME =
  "bg-background border-border/60 mx-3 rounded-[1.45rem] border p-3"
