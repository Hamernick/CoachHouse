"use client"

import * as React from "react"
import { useReducedMotion } from "framer-motion"
import ArrowDownIcon from "lucide-react/dist/esm/icons/arrow-down"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"

import { buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { WORKSPACE_TUTORIAL_OUTLINE_BUTTON_SURFACE_CLASSNAME } from "@/components/workspace/workspace-tutorial-theme"
import { cn } from "@/lib/utils"

const WORKSPACE_TUTORIAL_CALLOUT_SETTLE_DELAY_MS = 420
const WORKSPACE_TUTORIAL_CALLOUT_REDUCED_MOTION_DELAY_MS = 120

type WorkspaceTutorialCalloutProps = {
  calloutId?: string
  title?: string
  instruction?: string
  emphasis?: "default" | "tap-here"
  tapHereLabel?: string
  indicatorIconPosition?: "before" | "after"
  className?: string
  tooltipContentClassName?: string
  indicatorAnchorAlign?: "center" | "start" | "end"
  indicatorAnchorVerticalAlign?: "top" | "center" | "bottom"
  indicatorOffsetX?: number
  indicatorOffsetY?: number
  indicatorSide?: "top" | "right" | "bottom" | "left"
  indicatorSideOffset?: number
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  alignOffset?: number
  mode?: "tooltip" | "indicator"
}

export function WorkspaceTutorialCallout({
  title = "",
  instruction = "",
  emphasis = "default",
  tapHereLabel,
  indicatorIconPosition = "before",
  className,
  tooltipContentClassName,
  indicatorAnchorAlign = "center",
  indicatorAnchorVerticalAlign = "top",
  indicatorOffsetX = 0,
  indicatorOffsetY = 0,
  indicatorSide = "top",
  indicatorSideOffset = 10,
  side = "left",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  mode = "tooltip",
  calloutId,
}: WorkspaceTutorialCalloutProps) {
  const resolvedCalloutId = React.useMemo(() => {
    if (calloutId) return calloutId

    const descriptorSeed = [
      mode,
      emphasis,
      tapHereLabel,
      indicatorIconPosition,
      title,
      instruction,
      indicatorSide,
      side,
      align,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    return `workspace-tutorial-callout:${descriptorSeed || "default"}`
  }, [
    align,
    emphasis,
    indicatorSide,
    indicatorIconPosition,
    instruction,
    mode,
    calloutId,
    side,
    tapHereLabel,
    title,
  ])
  const prefersReducedMotion = useReducedMotion()
  const calloutSettleKey = React.useMemo(
    () =>
      [
        resolvedCalloutId,
        mode,
        title,
        instruction,
        tapHereLabel,
        indicatorIconPosition,
        indicatorSide,
        side,
        align,
      ].join("::"),
    [
      align,
      indicatorSide,
      indicatorIconPosition,
      instruction,
      mode,
      resolvedCalloutId,
      side,
      tapHereLabel,
      title,
    ],
  )
  const [calloutReady, setCalloutReady] = React.useState(false)

  React.useEffect(() => {
    setCalloutReady(false)
    const settleDelayMs = prefersReducedMotion
      ? WORKSPACE_TUTORIAL_CALLOUT_REDUCED_MOTION_DELAY_MS
      : WORKSPACE_TUTORIAL_CALLOUT_SETTLE_DELAY_MS
    let timeoutId: number | null = null
    const rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        setCalloutReady(true)
      }, settleDelayMs)
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [calloutSettleKey, prefersReducedMotion])

  const calloutVisibilityClassName = cn(
    "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
    calloutReady ? "opacity-100" : "opacity-0",
  )

  if (mode === "indicator") {
    const IndicatorIcon =
      indicatorSide === "right"
        ? ArrowLeftIcon
        : indicatorSide === "left"
          ? ArrowRightIcon
          : indicatorSide === "bottom"
            ? ArrowUpIcon
            : ArrowDownIcon
    const indicatorAnchorStyle =
      indicatorAnchorAlign === "center"
        ? { left: "50%" }
        : indicatorAnchorAlign === "end"
          ? { right: 0 }
          : {
              left: 0,
            }
    const indicatorVerticalAnchorStyle =
      indicatorAnchorVerticalAlign === "center"
        ? { top: "50%" }
        : indicatorAnchorVerticalAlign === "bottom"
          ? { bottom: 0 }
          : { top: 0 }
    const indicatorTranslateX =
      indicatorAnchorAlign === "center"
        ? `calc(-50% + ${indicatorOffsetX}px)`
        : `${indicatorOffsetX}px`
    const indicatorTranslateY =
      indicatorAnchorVerticalAlign === "center"
        ? `calc(-50% + ${indicatorOffsetY}px)`
        : `${indicatorOffsetY}px`
    const indicatorIcon = (
      <span
        data-slot="workspace-tutorial-indicator-icon-wrap"
        className="inline-flex shrink-0 items-center justify-center"
      >
        <IndicatorIcon
          data-slot="workspace-tutorial-indicator-icon"
          className="size-4"
        />
      </span>
    )
    const indicatorLabel = tapHereLabel ? (
      <span
        data-slot="workspace-tutorial-indicator-label"
        className="inline-flex min-w-0 items-center"
      >
        {tapHereLabel}
      </span>
    ) : null

    return (
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute z-50", className)}

        style={{
          ...indicatorAnchorStyle,
          ...indicatorVerticalAnchorStyle,
          transform: `translate(${indicatorTranslateX}, ${indicatorTranslateY})`,
        }}
      >
        <Tooltip open>
          <TooltipTrigger asChild>
            <span
              data-slot="workspace-tutorial-indicator-anchor"
              className="pointer-events-none block size-10"
            />
          </TooltipTrigger>
          <TooltipContent
            side={indicatorSide}
            align={indicatorSide === "top" && tapHereLabel ? "start" : "center"}
            sideOffset={indicatorSideOffset}
            className={cn(
              "pointer-events-none",
              calloutVisibilityClassName,
              tooltipContentClassName,
            )}

            data-workspace-tutorial-callout-ready={calloutReady ? "true" : "false"}
          >
            <div
              data-slot="workspace-tutorial-indicator"
              data-workspace-tutorial-indicator={tapHereLabel ? "labeled" : "icon"}
              data-workspace-tutorial-indicator-icon-position={
                tapHereLabel ? indicatorIconPosition : "only"
              }
              className={cn(
                "flex items-center whitespace-nowrap",
                tapHereLabel
                  ? "gap-1.5"
                  : "justify-center",
              )}
            >
              {indicatorIconPosition === "before" || !tapHereLabel
                ? indicatorIcon
                : null}
              {indicatorLabel}
              {indicatorIconPosition === "after" && tapHereLabel
                ? indicatorIcon
                : null}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <TooltipContent
      side={side}
      align={align}
      sideOffset={sideOffset}
      alignOffset={alignOffset}

      data-workspace-tutorial-callout-ready={calloutReady ? "true" : "false"}
      className={cn(
        calloutVisibilityClassName,
        "workspace-tutorial-callout pointer-events-none whitespace-normal text-left",
        emphasis === "tap-here" && tapHereLabel
          ? "w-fit max-w-60 py-2 pl-2 pr-3"
          : "w-48",
        tooltipContentClassName,
        className,
      )}
    >
      {emphasis === "tap-here" && tapHereLabel ? (
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-9 shrink-0 rounded-xl [&_svg]:size-4",
              WORKSPACE_TUTORIAL_OUTLINE_BUTTON_SURFACE_CLASSNAME,
            )}
          >
            <ArrowDownIcon className="h-4 w-4" aria-hidden />
          </div>
          <p className="min-w-0 text-xs leading-tight text-current">
            {tapHereLabel}
          </p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="min-w-0 text-xs font-medium leading-tight text-current">
            {title}
          </p>
          {emphasis === "tap-here" ? (
            <p className="text-xs leading-tight text-current opacity-80">
              Click here.
            </p>
          ) : null}
          <p className="text-xs leading-tight text-current opacity-80">
            {instruction}
          </p>
        </div>
      )}
    </TooltipContent>
  )
}
