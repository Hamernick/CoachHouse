"use client"

import type { ComponentProps } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

export function InlineAddInput({ actionLabel, actionDisabled, ...props }: ComponentProps<typeof InputGroupInput> & { actionLabel: string; actionDisabled?: boolean }) {
  return <InputGroup data-inline-add-input className="canvas-glass items-center gap-1 rounded-full border p-0.5 shadow-none focus-within:border-ring">
    <InputGroupInput {...props} className="h-8 min-w-0 rounded-full border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 dark:bg-transparent [@media(pointer:coarse)]:h-11" />
    <InputGroupAddon className="shrink-0">
      <Button type="submit" size="icon" variant="ghost" disabled={actionDisabled} aria-label={actionLabel} className="size-8 rounded-full text-muted-foreground hover:text-foreground [@media(pointer:coarse)]:size-11">
        <Plus aria-hidden className="size-4" />
      </Button>
    </InputGroupAddon>
  </InputGroup>
}
