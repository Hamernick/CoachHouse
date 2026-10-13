export type WorkspaceCanvasSceneTransitionKind =
  | "same-family"
  | "family-change"
  | "welcome-handoff"
  | "accelerator-entry"
  | "accelerator-preview-exit"

export type WorkspaceCanvasTransitionTiming = {
  transitionKind: WorkspaceCanvasSceneTransitionKind
  layoutDurationMs: number
  cameraDelayMs: number
  cameraDurationMs: number
}

export type WorkspaceCanvasPresentationMotionPreset =
  | "default"
  | "surface-handoff"
  | "accelerator-entry"

export type WorkspaceCanvasPresentationMotionStage =
  | "presentation-frame"
  | "presentation-skeleton"
  | "bottom-fade"
  | "copy-shell"
  | "copy-heading"
  | "copy-body"
  | "content-swap"

export type WorkspaceCanvasMotionTransitionValue = {
  duration: number
  ease: readonly [number, number, number, number]
  delay?: number
}

export type WorkspaceCanvasMotionTransition = {
  opacity?: WorkspaceCanvasMotionTransitionValue
  y?: WorkspaceCanvasMotionTransitionValue
  scale?: WorkspaceCanvasMotionTransitionValue
}

export type WorkspaceCanvasMotionTarget = false | {
  opacity: number
  y?: number
  scale?: number
}

export type WorkspaceCanvasStageMotion = {
  initial: WorkspaceCanvasMotionTarget
  animate: {
    opacity: number
    y?: number
    scale?: number
  }
  exit?: {
    opacity: number
    y?: number
    scale?: number
  }
  transition?: WorkspaceCanvasMotionTransition
}

export const WORKSPACE_CANVAS_STAGED_EASE = [0.22, 1, 0.36, 1] as const

// Particle positions animate through React Flow so edges share every frame.
export const WORKSPACE_CANVAS_PARTICLE_LAYOUT_MOTION = {
  duration: 0.24,
  ease: WORKSPACE_CANVAS_STAGED_EASE,
} as const

const WORKSPACE_TUTORIAL_SURFACE_HANDOFF_DELAY_MS = 110
const WORKSPACE_ACCELERATOR_ENTRY_HANDOFF_DELAY_MS = 140

export function resolveWorkspaceCanvasSceneTransitionTiming({
  transitionKind,
  prefersReducedMotion,
  initialScene = false,
}: {
  transitionKind: WorkspaceCanvasSceneTransitionKind
  prefersReducedMotion: boolean
  initialScene?: boolean
}): WorkspaceCanvasTransitionTiming {
  if (initialScene || prefersReducedMotion) {
    return {
      transitionKind,
      layoutDurationMs: 0,
      cameraDelayMs: 0,
      cameraDurationMs: 0,
    }
  }

  if (transitionKind === "same-family") {
    return {
      transitionKind,
      layoutDurationMs: 0,
      cameraDelayMs: 0,
      cameraDurationMs: 0,
    }
  }

  if (transitionKind === "welcome-handoff") {
    return {
      transitionKind,
      layoutDurationMs: 240,
      cameraDelayMs: 0,
      cameraDurationMs: 0,
    }
  }

  if (transitionKind === "accelerator-entry") {
    return {
      transitionKind,
      layoutDurationMs: 300,
      cameraDelayMs: 40,
      cameraDurationMs: 360,
    }
  }

  if (transitionKind === "accelerator-preview-exit") {
    return {
      transitionKind,
      layoutDurationMs: 220,
      cameraDelayMs: 0,
      cameraDurationMs: 240,
    }
  }

  return {
    transitionKind,
    layoutDurationMs: 240,
    cameraDelayMs: 0,
    cameraDurationMs: 280,
  }
}

export function resolveWorkspaceCanvasPresentationHandoffDelayMs(
  preset: WorkspaceCanvasPresentationMotionPreset,
) {
  if (preset === "surface-handoff") {
    return WORKSPACE_TUTORIAL_SURFACE_HANDOFF_DELAY_MS
  }

  if (preset === "accelerator-entry") {
    return WORKSPACE_ACCELERATOR_ENTRY_HANDOFF_DELAY_MS
  }

  return 0
}

export function shouldWorkspaceCanvasAnimateInitialPresentation(
  preset: WorkspaceCanvasPresentationMotionPreset,
  prefersReducedMotion: boolean,
) {
  return (
    !prefersReducedMotion &&
    (preset === "accelerator-entry" || preset === "surface-handoff")
  )
}

function resolveWorkspaceCanvasPresentationFrameTransition(
  preset: WorkspaceCanvasPresentationMotionPreset,
) {
  if (preset === "accelerator-entry") {
    return {
      opacity: { duration: 0.34, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.04 },
      y: { duration: 0.42, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.04 },
      scale: { duration: 0.42, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.04 },
    } satisfies WorkspaceCanvasMotionTransition
  }

  if (preset === "surface-handoff") {
    return {
      opacity: { duration: 0.22, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
      y: { duration: 0.26, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
      scale: { duration: 0.26, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
    } satisfies WorkspaceCanvasMotionTransition
  }

  return {
    opacity: { duration: 0.18, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
    y: { duration: 0.22, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
    scale: { duration: 0.22, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
  } satisfies WorkspaceCanvasMotionTransition
}

function resolveWorkspaceCanvasBottomFadeTransition(
  preset: WorkspaceCanvasPresentationMotionPreset,
) {
  if (preset === "accelerator-entry") {
    return {
      opacity: { duration: 0.24, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.18 },
      y: { duration: 0.3, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.18 },
    } satisfies WorkspaceCanvasMotionTransition
  }

  if (preset === "surface-handoff") {
    return {
      opacity: { duration: 0.18, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.12 },
      y: { duration: 0.22, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.12 },
    } satisfies WorkspaceCanvasMotionTransition
  }

  return {
    opacity: { duration: 0.16, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.08 },
    y: { duration: 0.2, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.08 },
  } satisfies WorkspaceCanvasMotionTransition
}

export function resolveWorkspaceCanvasStageMotion({
  stage,
  preset,
  prefersReducedMotion,
}: {
  stage: WorkspaceCanvasPresentationMotionStage
  preset: WorkspaceCanvasPresentationMotionPreset
  prefersReducedMotion: boolean
}): WorkspaceCanvasStageMotion {
  if (stage === "presentation-frame") {
    return {
      initial: prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.988 },
      animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
      exit: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 1.01 },
      transition: prefersReducedMotion
        ? undefined
        : resolveWorkspaceCanvasPresentationFrameTransition(preset),
    }
  }

  if (stage === "presentation-skeleton") {
    return {
      initial: prefersReducedMotion ? false : { opacity: 0.55, y: 8 },
      animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
      exit: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 },
      transition: prefersReducedMotion
        ? undefined
        : resolveWorkspaceCanvasPresentationFrameTransition(preset),
    }
  }

  if (stage === "bottom-fade") {
    return {
      initial: prefersReducedMotion ? false : { opacity: 0, y: 6 },
      animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
      exit: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 },
      transition: prefersReducedMotion
        ? undefined
        : resolveWorkspaceCanvasBottomFadeTransition(preset),
    }
  }

  if (stage === "copy-shell") {
    return {
      initial: prefersReducedMotion ? false : { opacity: 0 },
      animate: { opacity: 1 },
      exit: prefersReducedMotion ? undefined : { opacity: 0 },
      transition: prefersReducedMotion
        ? undefined
        : { opacity: { duration: 0.18, ease: WORKSPACE_CANVAS_STAGED_EASE } },
    }
  }

  if (stage === "copy-heading") {
    return {
      initial: prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.996 },
      animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
      exit: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 1.003 },
      transition: prefersReducedMotion
        ? undefined
        : {
            opacity: { duration: 0.2, ease: WORKSPACE_CANVAS_STAGED_EASE },
            y: { duration: 0.24, ease: WORKSPACE_CANVAS_STAGED_EASE },
            scale: { duration: 0.24, ease: WORKSPACE_CANVAS_STAGED_EASE },
          },
    }
  }

  if (stage === "copy-body") {
    return {
      initial: prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.996 },
      animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
      exit: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 1.003 },
      transition: prefersReducedMotion
        ? undefined
        : {
            opacity: { duration: 0.24, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.06 },
            y: { duration: 0.28, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.06 },
            scale: { duration: 0.28, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.06 },
          },
    }
  }

  return {
    initial: prefersReducedMotion ? false : { opacity: 0, y: 10 },
    animate: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 },
    transition: prefersReducedMotion
      ? undefined
      : {
          opacity: { duration: 0.18, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
          y: { duration: 0.22, ease: WORKSPACE_CANVAS_STAGED_EASE, delay: 0.02 },
        },
  }
}
