"use client"

import type { ComponentProps } from "react"
import { Popover } from "@openai/apps-sdk-ui/components/Popover"
import { cn } from "@/lib/utils"

export const ParticlePopover = Object.assign(
  (props: ComponentProps<typeof Popover>) => <Popover {...props} />,
  {
    Trigger: Popover.Trigger,
    Content: ({ className, ...props }: ComponentProps<typeof Popover.Content>) => <Popover.Content align="start" {...props} className={cn("particle-ui particle-ui-popover z-50", className)} />,
  },
)
