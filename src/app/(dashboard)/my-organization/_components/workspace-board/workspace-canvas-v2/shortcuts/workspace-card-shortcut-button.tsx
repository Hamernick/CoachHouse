"use client"

import type { ComponentProps, SyntheticEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME,
} from "@/components/workspace/workspace-tutorial-theme"
import { cn } from "@/lib/utils"

import { WorkspaceTutorialCallout } from "../../workspace-tutorial-callout"
import type { WorkspaceCardShortcutItemModel } from "./workspace-card-shortcut-model"

const WORKSPACE_SHORTCUT_VISIBLE_BUTTON_CLASSNAME =
  "text-foreground"
const WORKSPACE_SHORTCUT_SELECTED_BUTTON_CLASSNAME =
  "bg-accent text-accent-foreground shadow-none hover:bg-accent"
const WORKSPACE_SHORTCUT_TUTORIAL_TOOLS_BUTTON_CLASSNAME =
  "border-sky-300/70 bg-sky-50/85 text-sky-700 shadow-none hover:bg-sky-100/90 dark:border-sky-400/45 dark:bg-sky-500/14 dark:text-sky-100 dark:hover:bg-sky-500/20"

export function renderWorkspaceCardShortcutTooltipContent({
  title,
  comingSoon,
}: {
  title: string
  comingSoon: boolean
}) {
  if (!comingSoon) {
    return title
  }

  return (
    <div className="flex items-center gap-2">
      <span>{title}</span>
      <Badge
        variant="outline"
        className="rounded-full border-border/70 bg-muted/60 px-2 py-0 text-[10px] font-semibold text-foreground/80"
      >
        Coming soon
      </Badge>
    </div>
  )
}

export function WorkspaceCardShortcutButton({
  item,
  tooltipSide = "left",
}: {
  item: WorkspaceCardShortcutItemModel
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"]
}) {
  const Icon = item.icon
  const tutorialCallout = item.tutorialCallout
  const tutorialHighlighted = item.tutorialHighlighted
  const comingSoon = item.comingSoon
  const tutorialIndicatorLabel =
    tutorialCallout && item.id === "accelerator"
      ? "Open the Accelerator"
      : undefined
  const calloutId = `workspace-card-shortcut:${item.id}`
  const isTutorialToolsStepHighlight = tutorialHighlighted && tutorialCallout === null
  const stopShortcutInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation()
  }
  const handleShortcutClick = (event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    item.onPress()
  }
  const buttonVariant = "ghost"

  const iconNode = (
    <Icon
      className={cn(
        "h-4 w-4 transition-opacity duration-150",
        item.selected && "opacity-95",
        item.visible && !item.selected && "opacity-90",
        !item.visible && !item.selected && "opacity-80",
      )}
      aria-hidden
    />
  )

  const button = (
    <Button
      type="button"
      variant={buttonVariant}
      size="icon"
      onClick={handleShortcutClick}
      onMouseDownCapture={stopShortcutInteractionPropagation}
      onPointerDownCapture={stopShortcutInteractionPropagation}
      onPointerDown={stopShortcutInteractionPropagation}
      aria-label={item.title}
      aria-pressed={item.selected}
      aria-disabled={comingSoon}

      className={cn(
        "nodrag nopan size-9 h-9 w-9 rounded-xl",
        item.visible && WORKSPACE_SHORTCUT_VISIBLE_BUTTON_CLASSNAME,
        isTutorialToolsStepHighlight &&
          WORKSPACE_SHORTCUT_TUTORIAL_TOOLS_BUTTON_CLASSNAME,
        comingSoon && "cursor-not-allowed opacity-70",
        (tutorialHighlighted || item.selected) &&
          !isTutorialToolsStepHighlight &&
          WORKSPACE_SHORTCUT_SELECTED_BUTTON_CLASSNAME,
      )}
    >
      {iconNode}
    </Button>
  )

  if (tutorialCallout) {
    return (
      <div className="relative inline-flex overflow-visible">
        <WorkspaceTutorialCallout
          calloutId={`${calloutId}:callout`}
          mode="indicator"
          tapHereLabel={tutorialIndicatorLabel}
          tooltipContentClassName={WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME}
          indicatorSide="right"
          indicatorAnchorAlign="end"
          indicatorAnchorVerticalAlign="center"
          indicatorSideOffset={12}
        />
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent
            side={tooltipSide}
            align="center"
            sideOffset={12}

            className={WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME}
          >
            {renderWorkspaceCardShortcutTooltipContent({
              title: item.title,
              comingSoon,
            })}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side={tooltipSide}
        align="center"
        sideOffset={12}

        className={WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME}
      >
        {renderWorkspaceCardShortcutTooltipContent({
          title: item.title,
          comingSoon,
        })}
      </TooltipContent>
    </Tooltip>
  )
}
