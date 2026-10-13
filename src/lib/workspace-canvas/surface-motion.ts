/** Shared by the dock window and contextual Particle previews. */
export const WORKSPACE_SURFACE_MOTION = {
  spring: { type: "spring", stiffness: 600, damping: 50, mass: 1 },
  enterOpacity: { type: "tween", duration: 0.16, ease: "easeOut" },
  exitOpacity: { type: "tween", duration: 0.12, ease: "easeOut" },
} as const
