"use client"

import type { ComponentProps } from "react"
import SearchIcon from "lucide-react/dist/esm/icons/search"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

export function SearchInput({
  submitLabel = "Search",
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { submitLabel?: string }) {
  return (
    <InputGroup className="bg-background ring-input focus-within-visible:ring-ring h-11 min-w-0 items-center gap-0 rounded-full ring-1 ring-inset focus-within-visible:ring-2 md:h-8">
      <InputGroupAddon className="shrink-0">
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-11 touch-manipulation rounded-full md:size-8"
          aria-label={submitLabel}
        >
          <SearchIcon data-icon="inline-start" aria-hidden />
        </Button>
      </InputGroupAddon>
      <InputGroupInput
        {...props}
        type="search"
        className={cn(
          "h-full touch-manipulation rounded-full border-0 bg-transparent pr-3 pl-0 text-base shadow-none focus-visible:ring-0 md:text-[13px] dark:bg-transparent",
          className
        )}
      />
    </InputGroup>
  )
}
