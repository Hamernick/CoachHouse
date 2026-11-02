// Real domain exports used by objective UI; excludes unrelated canvas/server adapters.
export { createParticle, particleRegistry, getParticleCapabilities } from "../../../src/features/workspace-particles/lib/particle-registry"
export { buildParticlePreset, DEFAULT_PRESET_FIELDS, PARTICLE_PRESETS } from "../../../src/features/workspace-particles/lib/particle-presets"
export { PARTICLE_DRAG_MIME, readParticleDrag } from "../../../src/features/workspace-particles/lib/particle-placement"
export { particlePlanBranchStates, particlePlanBranchLabel } from "../../../src/features/workspace-particles/lib/particle-plan-branches"
export { planFromProposal } from "../../../src/features/workspace-particles/lib/particle-plan-schema"

export { planCommand } from "../../../src/features/workspace-particles/lib/particle-plan-command"

export { newlyAttachedParticles } from "../../../src/features/workspace-particles/lib/particle-creation-placement"
export { prepareParticlePlacementReveal, particlePlacementMeasurements } from "../../../src/features/workspace-particles/lib/particle-placement-viewport"
export { ParticleResponsibilityPeople, ParticleResponsibilitySelector } from "../../../src/features/workspace-particles/components/particle-responsibility-fields"
export { EMPTY_RESPONSIBILITY } from "../../../src/features/workspace-particles/lib/particle-responsibility"
export { summarizeObjectiveProgress, summarizePlanWork, isParticleWork } from "../../../src/features/workspace-particles/lib/particle-progress"
export { useParticleProgressClock } from "../../../src/features/workspace-particles/hooks/use-particle-progress-clock"
