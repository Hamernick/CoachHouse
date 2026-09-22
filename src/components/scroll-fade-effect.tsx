"use client"

import {
  forwardRef,
  useCallback,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
} from "react"

import { cn } from "@/lib/utils"
import { useScrollFadeEffect } from "@/lib/scroll-fade-effect"

export type ScrollFadeEffectProps = ComponentPropsWithoutRef<"div"> & {
  /**
   * Whether to apply the fade utility classes.
   * @defaultValue true
   */
  enabled?: boolean
  /**
   * Scroll direction to apply the fade effect.
   * @defaultValue "vertical"
   * */
  orientation?: "horizontal" | "vertical"
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value)
    return
  }

  if (ref) ref.current = value
}

export const ScrollFadeEffect = forwardRef<
  HTMLDivElement,
  ScrollFadeEffectProps
>(function ScrollFadeEffect(
  { className, enabled = true, orientation = "vertical", ...props },
  forwardedRef
) {
  const scrollFadeRef = useScrollFadeEffect(enabled, orientation)
  const mergedRef = useCallback(
    (element: HTMLDivElement | null) => {
      scrollFadeRef(element)
      assignRef(forwardedRef, element)
    },
    [forwardedRef, scrollFadeRef]
  )

  return (
    <div
      ref={mergedRef}
      data-orientation={orientation}
      className={cn(
        enabled &&
          (orientation === "horizontal"
            ? "scroll-fade-effect-x overflow-x-auto"
            : "scroll-fade-effect-y overflow-y-auto"),
        className
      )}
      {...props}
    />
  )
})
