"use client"

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"
import { Dithering } from "@paper-design/shaders-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import {
  resolveWorkspaceCanvasStageMotion,
} from "@/lib/workspace-canvas/motion-spec"
import { cn } from "@/lib/utils"
import type { WorkspaceCanvasTutorialNodeVariant, WorkspaceCanvasTutorialPresentationSurface, WorkspaceCanvasTutorialStepId } from "../types"
import { useWorkspaceCanvasTutorialController } from "../hooks/use-workspace-canvas-tutorial-controller"
import { resolveWorkspaceCanvasTutorialProgressPercent, shouldWorkspaceCanvasTutorialBlockPanelNext } from "../lib"
import {
  resolveWorkspaceTutorialBodyLayoutClass,
  resolveWorkspaceTutorialBodyGridClass,
  resolveWorkspaceTutorialCopyRailClass,
  resolveWorkspaceTutorialPresentationFrameMaxHeight,
  resolveWorkspaceTutorialPresentationFrameOverflowClass,
  resolveWorkspaceTutorialPresentationSlotClass,
} from "./workspace-canvas-tutorial-panel-layout"

import { WorkspaceTutorialPresentationSkeleton } from "./workspace-canvas-tutorial-panel-skeleton"
import { resolveWorkspaceTutorialPresentationHandoffDelayMs, resolveWorkspaceTutorialPresentationMotionPreset, resolveWorkspaceTutorialPresentationTransitionKey, shouldWorkspaceTutorialAnimateInitialPresentation, type WorkspaceTutorialPresentationMotionPreset } from "./workspace-canvas-tutorial-panel-motion"

type WorkspaceCanvasTutorialPanelProps = {
  stepIndex: number
  openedStepIds: WorkspaceCanvasTutorialStepId[]
  attached: boolean
  dragEnabled: boolean
  dragHandleClassName?: string
  variant: WorkspaceCanvasTutorialNodeVariant
  onPrevious: () => void
  onNext: () => void
  presentationContent?: ReactNode
  presentationKey?: string | null
  presentationSurface?: WorkspaceCanvasTutorialPresentationSurface | null
  className?: string
}

const WORKSPACE_TUTORIAL_BLOCKED_CONTINUE_HINT_TIMEOUT_MS = 1800
const WORKSPACE_TUTORIAL_PANEL_CONTROL_BUTTON_CLASSNAME = "nodrag nopan size-9 h-9 w-9 rounded-xl"

type WorkspaceTutorialPresentationFrameProps = {
  stepId: WorkspaceCanvasTutorialStepId
  presentationSurface: WorkspaceCanvasTutorialPresentationSurface
  presentationContent: ReactNode
  presentationKey: string | null
  motionPreset: WorkspaceTutorialPresentationMotionPreset
  prefersReducedMotion: boolean
}

type WorkspaceTutorialBottomFadeProps = {
  active: boolean
  width: number
  motionPreset: WorkspaceTutorialPresentationMotionPreset
  prefersReducedMotion: boolean
}

function WorkspaceTutorialBottomFade({
  active,
  width,
  motionPreset,
  prefersReducedMotion,
}: WorkspaceTutorialBottomFadeProps) {
  const animateInitialPresentation = shouldWorkspaceTutorialAnimateInitialPresentation(motionPreset, prefersReducedMotion)
  const bottomFadeMotion = resolveWorkspaceCanvasStageMotion({
    stage: "bottom-fade",
    preset: motionPreset,
    prefersReducedMotion,
  })

  return (
    <AnimatePresence initial={animateInitialPresentation} mode="wait">
      {active ? (
        <motion.div
          key={`${motionPreset}-workspace-tutorial-bottom-fade`}
          aria-hidden="true"
          initial={bottomFadeMotion.initial}
          animate={bottomFadeMotion.animate}
          exit={bottomFadeMotion.exit}
          transition={bottomFadeMotion.transition}
          className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-14 -translate-x-1/2 bg-gradient-to-t from-background/78 via-background/32 to-transparent dark:from-background/82 dark:via-background/34"
          style={{ width }}
        />
      ) : null}
    </AnimatePresence>
  )
}
type WorkspaceTutorialBlockedContinueButtonProps = {
  helperText: string
  onPointerDown: (event: SyntheticEvent) => void
}

function WorkspaceTutorialBlockedContinueButton({
  helperText,
  onPointerDown,
}: WorkspaceTutorialBlockedContinueButtonProps) {
  const blockedContinueHintTimeoutRef = useRef<number | null>(null)
  const [isBlockedContinueHintOpen, setIsBlockedContinueHintOpen] =
    useState(false)
  const clearBlockedContinueHintTimeout = () => {
    if (blockedContinueHintTimeoutRef.current === null) return
    window.clearTimeout(blockedContinueHintTimeoutRef.current)
    blockedContinueHintTimeoutRef.current = null
  }
  const openBlockedContinueHint = () => {
    clearBlockedContinueHintTimeout()
    setIsBlockedContinueHintOpen(true)
  }
  const closeBlockedContinueHint = () => {
    clearBlockedContinueHintTimeout()
    setIsBlockedContinueHintOpen(false)
  }
  const handleBlockedContinueClick = (event: SyntheticEvent) => {
    event.preventDefault()
    onPointerDown(event)
    openBlockedContinueHint()
    blockedContinueHintTimeoutRef.current = window.setTimeout(() => {
      setIsBlockedContinueHintOpen(false)
      blockedContinueHintTimeoutRef.current = null
    }, WORKSPACE_TUTORIAL_BLOCKED_CONTINUE_HINT_TIMEOUT_MS)
  }

  useEffect(
    () => () => {
      clearBlockedContinueHintTimeout()
    },
    [],
  )

  return (
    <Tooltip
      open={isBlockedContinueHintOpen}
      onOpenChange={setIsBlockedContinueHintOpen}
    >
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-disabled="true"
          className={cn(WORKSPACE_TUTORIAL_PANEL_CONTROL_BUTTON_CLASSNAME, "cursor-help opacity-50")}
          onPointerDown={onPointerDown}
          onPointerEnter={openBlockedContinueHint}
          onPointerLeave={closeBlockedContinueHint}
          onFocus={openBlockedContinueHint}
          onBlur={closeBlockedContinueHint}
          onClick={handleBlockedContinueClick}
          aria-label={helperText}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="end"
        sideOffset={10}
        className="workspace-tutorial-callout w-56 whitespace-normal text-left"
      >
        <p className="text-xs leading-tight text-foreground">{helperText}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function WorkspaceTutorialPresentationFrame({
  stepId,
  presentationSurface,
  presentationContent,
  presentationKey,
  motionPreset,
  prefersReducedMotion,
}: WorkspaceTutorialPresentationFrameProps) {
  const presentationFrameRadius =
    presentationSurface.frameRadius ??
    (presentationSurface.kind === "dashed-frame" ? 32 : 30)
  const presentationFrameClasses = cn(
    "mx-auto relative box-border flex justify-center bg-transparent",
    resolveWorkspaceTutorialPresentationFrameOverflowClass({
      stepId,
      presentationSurface,
    }),
  )
  const presentationFrameBorderClasses =
    presentationSurface.kind === "dashed-frame"
      ? "border-2 border-dashed border-border/70"
      : "border border-border/70 bg-card/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_44px_-34px_rgba(15,23,42,0.42)] dark:bg-card/76"
  const animateInitialPresentation = shouldWorkspaceTutorialAnimateInitialPresentation(motionPreset, prefersReducedMotion)
  const presentationFrameMotion = resolveWorkspaceCanvasStageMotion({
    stage: "presentation-frame",
    preset: motionPreset,
    prefersReducedMotion,
  })

  return (
    <div

      className={cn(
        "grid min-h-0 justify-items-center overflow-visible",
        presentationSurface.heightMode === "fill"
          ? "h-full content-stretch items-stretch"
          : "h-auto content-start items-start",
        presentationSurface.chrome?.allowCalloutOverflow && "relative z-20",
      )}
    >
      <AnimatePresence initial={animateInitialPresentation} mode="wait">
        <motion.div

          key={presentationKey ?? stepId}
          data-workspace-tutorial-mask-for={presentationSurface.cardId}
          initial={presentationFrameMotion.initial}
          animate={presentationFrameMotion.animate}
          exit={presentationFrameMotion.exit}
          transition={presentationFrameMotion.transition}
          className={cn(
            presentationFrameClasses,
            presentationSurface.heightMode === "fill"
              ? "h-full self-stretch"
              : "self-start",
          )}
          style={{
            width: presentationSurface.frameWidth,
            padding: presentationSurface.frameInset,
            borderRadius: presentationFrameRadius,
            maxHeight: resolveWorkspaceTutorialPresentationFrameMaxHeight({
              stepId,
              presentationSurface,
            }),
            height:
              presentationSurface.heightMode === "fill" ? "100%" : undefined,
          }}
        >
          <div
            key="presentation-frame-border"
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0",
              presentationFrameBorderClasses,
            )}
            style={{ borderRadius: presentationFrameRadius }}
          />
          <div
            key="presentation-card-content"

            data-workspace-tutorial-card-content
            className="relative flex justify-center"
            style={{
              width: presentationSurface.cardWidth,
            }}
          >
            {presentationContent}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function WorkspaceCanvasTutorialPanel({
  stepIndex,
  openedStepIds,
  attached,
  dragEnabled,
  dragHandleClassName,
  variant: _variant,
  onPrevious,
  onNext,
  presentationContent,
  presentationKey = null,
  presentationSurface = null,
  className,
}: WorkspaceCanvasTutorialPanelProps) {
  const { step, stepCount, continueMode, message } = useWorkspaceCanvasTutorialController(stepIndex, openedStepIds)
  const progressPercent = resolveWorkspaceCanvasTutorialProgressPercent(
    stepIndex,
    stepCount,
  )
  const prefersReducedMotion = useReducedMotion()
  const previousStepIndexRef = useRef(stepIndex)
  const currentPresentationTransitionKey =
    resolveWorkspaceTutorialPresentationTransitionKey({
      sceneId: step.sceneId,
      presentationSurface,
    })
  const previousPresentationTransitionKeyRef = useRef(
    currentPresentationTransitionKey,
  )
  const presentationMotionPreset = resolveWorkspaceTutorialPresentationMotionPreset({
    stepId: step.id,
    presentationSurface,
    previousPresentationTransitionKey:
      previousPresentationTransitionKeyRef.current,
  })
  const presentationHandoffDelayMs = resolveWorkspaceTutorialPresentationHandoffDelayMs(presentationMotionPreset)
  const [isContentRevealReady, setIsContentRevealReady] = useState(true)
  const isFirstStep = stepIndex <= 0
  const isFinalStep = stepIndex >= stepCount - 1
  const continueBlocked =
    shouldWorkspaceCanvasTutorialBlockPanelNext(continueMode)
  const continueHelperText =
    continueMode === "shortcut"
      ? "Click on the highlighted button on the card to continue."
      : continueMode === "action"
        ? "Use the highlighted part of the accelerator to continue."
        : null
  const stopGuideInteractionPropagation = (event: SyntheticEvent) => event.stopPropagation()
  const copyShellMotion = resolveWorkspaceCanvasStageMotion({
    stage: "copy-shell",
    preset: presentationMotionPreset,
    prefersReducedMotion: !!prefersReducedMotion,
  })
  const copyHeadingMotion = resolveWorkspaceCanvasStageMotion({
    stage: "copy-heading",
    preset: presentationMotionPreset,
    prefersReducedMotion: !!prefersReducedMotion,
  })
  const copyBodyMotion = resolveWorkspaceCanvasStageMotion({
    stage: "copy-body",
    preset: presentationMotionPreset,
    prefersReducedMotion: !!prefersReducedMotion,
  })
  const copyRailClass = resolveWorkspaceTutorialCopyRailClass({
    stepId: step.id,
    presentationSurface,
  })
  const bodyLayoutClass = resolveWorkspaceTutorialBodyLayoutClass({
    stepId: step.id,
    presentationSurface,
  })
  const presentationChrome = presentationSurface?.chrome ?? null
  const fillPresentationSurface = presentationSurface?.heightMode === "fill"
  const shouldUseWelcomeShellShadow = step.id === "welcome"

  useEffect(() => {
    const previousStepIndex = previousStepIndexRef.current
    const previousPresentationTransitionKey =
      previousPresentationTransitionKeyRef.current
    previousStepIndexRef.current = stepIndex
    previousPresentationTransitionKeyRef.current = currentPresentationTransitionKey

    if (prefersReducedMotion || previousStepIndex === stepIndex) {
      setIsContentRevealReady(true)
      return
    }

    if (
      previousPresentationTransitionKey !== currentPresentationTransitionKey
    ) {
      setIsContentRevealReady(false)
      const timeoutId = window.setTimeout(() => {
        setIsContentRevealReady(true)
      }, presentationHandoffDelayMs)

      return () => window.clearTimeout(timeoutId)
    }

    setIsContentRevealReady(true)
  }, [
    currentPresentationTransitionKey,
    prefersReducedMotion,
    presentationHandoffDelayMs,
    stepIndex,
  ])

  return (
    <div className="pointer-events-none relative h-full w-full">
        <Card

          data-workspace-tutorial-shell
          className={cn(
          "border-border/70 nopan pointer-events-auto mx-auto flex w-full min-h-0 flex-col overflow-hidden rounded-[30px] border bg-transparent !shadow-none",
          fillPresentationSurface ? "h-full" : "h-auto",
          shouldUseWelcomeShellShadow &&
            "!shadow-[0_18px_44px_-34px_rgba(15,23,42,0.24)]",
          attached && "rounded-b-[26px]",
          presentationChrome?.shellOverflow === "visible" && "overflow-visible",
          className,
        )}
      >
        <CardHeader
          className={cn(
            "border-border/70 bg-card/92 supports-[backdrop-filter]:bg-card/80 pointer-events-auto space-y-3 rounded-t-[28px] border-b px-5 py-5 backdrop-blur-md sm:px-6",
            dragEnabled && dragHandleClassName,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="border-border/70 bg-background/90 relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border shadow-inner">
                <Dithering
                  colorBack="#050816"
                  colorFront="#13b5ff"
                  shape="sphere"
                  type="4x4"
                  size={2}
                  speed={1}
                  scale={0.6}
                  style={{ height: "100%", width: "100%" }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-white/10" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[15px] leading-[20px] font-medium text-foreground">
                  Welcome to Workspace
                </p>
                <p className={WORKSPACE_TEXT_STYLES.surfaceSubtitle}>
                  {progressPercent}% complete
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {!isFirstStep ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={WORKSPACE_TUTORIAL_PANEL_CONTROL_BUTTON_CLASSNAME}
                  onPointerDown={stopGuideInteractionPropagation}
                  onClick={onPrevious}
                  aria-label="Previous tutorial step"
                  title="Back"
                >
                  <ChevronLeftIcon className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}

              {continueBlocked ? (
                <WorkspaceTutorialBlockedContinueButton
                  helperText={continueHelperText ?? "Complete this step to continue"}
                  onPointerDown={stopGuideInteractionPropagation}
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={WORKSPACE_TUTORIAL_PANEL_CONTROL_BUTTON_CLASSNAME}
                  onPointerDown={stopGuideInteractionPropagation}
                  onClick={onNext}
                  aria-label={isFinalStep ? "Enter workspace" : "Next tutorial step"}
                  title={isFinalStep ? "Enter workspace" : "Continue"}
                >
                  <ChevronRightIcon className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>

          <div className="bg-border/60 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-[360ms]"
              style={{
                width: `${progressPercent}%`,
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
        </CardHeader>

        <CardContent

          className={cn(
            "relative min-h-0 overflow-hidden rounded-b-[28px] bg-background/70 px-0 py-0 supports-[backdrop-filter]:bg-background/28 backdrop-blur-[26px] dark:bg-background/38 dark:supports-[backdrop-filter]:bg-background/20",
            fillPresentationSurface ? "flex-1" : "flex-none",
            attached && "rounded-b-[24px]",
            presentationChrome?.shellOverflow === "visible" && "overflow-visible",
          )}
        >
          <div

            className={cn(
              "relative flex min-h-0 flex-col overflow-hidden border-t border-white/10 dark:border-white/6",
              fillPresentationSurface ? "h-full" : "h-auto",
              presentationChrome?.bodyOverflow === "visible" && "overflow-visible",
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/18 blur-[0.2px] dark:bg-white/10"
            />
            <div

              className={cn(
                resolveWorkspaceTutorialBodyGridClass({
                  presentationSurface,
                }),
                bodyLayoutClass,
                presentationChrome?.collapseBodyBottomPadding && "pb-0",
                presentationChrome?.bodyOverflow === "visible" && "overflow-visible",
              )}
            >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={step.id}
                initial={copyShellMotion.initial}
                animate={copyShellMotion.animate}
                exit={copyShellMotion.exit}
                transition={copyShellMotion.transition}
                className={cn(
                  "flex-none flex flex-col gap-1.5",
                  copyRailClass,
                )}
              >
                <motion.div
                  initial={copyHeadingMotion.initial}
                  animate={copyHeadingMotion.animate}
                  exit={copyHeadingMotion.exit}
                  transition={copyHeadingMotion.transition}
                  className="flex flex-wrap items-center gap-2"
                >
                  <h2 className={WORKSPACE_TEXT_STYLES.surfaceTitle}>
                    {step.title}
                  </h2>
                </motion.div>
                <motion.p
                  initial={copyBodyMotion.initial}
                  animate={copyBodyMotion.animate}
                  exit={copyBodyMotion.exit}
                  transition={copyBodyMotion.transition}
                  className={WORKSPACE_TEXT_STYLES.surfaceBody}
                >
                  {message}
                </motion.p>
              </motion.div>
            </AnimatePresence>

            {presentationSurface && presentationContent ? (
              <div

                className={cn(
                  resolveWorkspaceTutorialPresentationSlotClass({
                    presentationSurface,
                  }),
                  presentationChrome?.slotOverflow === "hidden"
                    ? "overflow-hidden"
                    : "overflow-visible",
                  presentationChrome?.allowCalloutOverflow && "relative z-20",
                )}
                style={{
                  paddingTop:
                    presentationChrome?.slotPaddingTop &&
                    presentationChrome.slotPaddingTop > 0
                      ? presentationChrome.slotPaddingTop
                      : undefined,
                }}
              >
                {isContentRevealReady ? (
                  <WorkspaceTutorialPresentationFrame
                    stepId={step.id}
                    presentationSurface={presentationSurface}
                    presentationContent={presentationContent}
                    presentationKey={presentationKey}
                    motionPreset={presentationMotionPreset}
                    prefersReducedMotion={!!prefersReducedMotion}
                  />
                ) : (
                  <WorkspaceTutorialPresentationSkeleton
                    presentationSurface={presentationSurface}
                    motionPreset={presentationMotionPreset}
                    prefersReducedMotion={!!prefersReducedMotion}
                  />
                )}
                <WorkspaceTutorialBottomFade
                  active={presentationChrome?.showBottomFade === true && isContentRevealReady}
                  width={presentationSurface.frameWidth}
                  motionPreset={presentationMotionPreset}
                  prefersReducedMotion={!!prefersReducedMotion}
                />
              </div>
            ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
