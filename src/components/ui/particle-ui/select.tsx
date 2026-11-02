"use client"

import type { ComponentProps } from "react"
import { SelectControl } from "@openai/apps-sdk-ui/components/SelectControl"
import { cn } from "@/lib/utils"

export type ParticleSelectProps = Omit<ComponentProps<"select">, "size"> & {
  size?: ComponentProps<typeof SelectControl>["size"]
  variant?: ComponentProps<typeof SelectControl>["variant"]
  invalid?: boolean
}

/** SDK foundation/visuals with the native owner for labels, validation, focus,
 * keyboard and mobile pickers. The pinned custom Select does not forward these
 * native accessibility attributes to its trigger. No second menu implementation.
 */
export function ParticleSelect({ className, size = "2xl", variant = "outline", disabled, invalid, children, ...props }: ParticleSelectProps) {
  return <span className={cn("particle-ui relative inline-flex w-full min-w-0 max-w-full rounded-full focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring", className)}>
    <SelectControl aria-hidden role="presentation" tabIndex={-1} size={size} variant={variant} disabled={disabled} invalid={invalid ?? (props["aria-invalid"] === true || props["aria-invalid"] === "true")} selected block className="pointer-events-none w-full">
      <span className="invisible" aria-hidden>Choose</span>
    </SelectControl>
    <select {...props} disabled={disabled} aria-invalid={props["aria-invalid"] ?? invalid}
      className="absolute inset-0 h-full w-full min-w-0 cursor-pointer appearance-none rounded-[inherit] border-0 bg-transparent py-0 pr-9 pl-3 text-base text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </select>
  </span>
}
