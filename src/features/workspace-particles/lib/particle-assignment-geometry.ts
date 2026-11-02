import type { Particle } from "../types"
import { supportsParticleResponsibility } from "./particle-responsibility"

/** 8px separation plus the full 44px touch target, in canvas coordinates.
 * Keep the same reservation across pointer types so saved layouts stay stable. */
export const PARTICLE_ASSIGNMENT_HEIGHT = 52
export function particleAssignmentHeight(particle: Particle, membership = false) {
  return (supportsParticleResponsibility(particle) || membership) ? PARTICLE_ASSIGNMENT_HEIGHT : 0
}
export function withParticleAssignmentBounds<T extends { width?: number | string; height?: number | string }>(particle: Particle, size: T, membership = false) {
  return typeof size.height === "number" ? { ...size, height: size.height + particleAssignmentHeight(particle, membership) } : size
}
export function particleAssignmentCardSize(particle: Particle, size: { width: number; height: number }, membership = false) {
  return { ...size, height: Math.max(1, size.height - particleAssignmentHeight(particle, membership)) }
}
