export * from "./lib"
export { useNoteDocuments } from "./hooks/use-note-documents"
export { ParticleNoteDocumentDialog } from "./components/particle-note-document-dialog"
export { ModuleNotesFields } from "./components/particle-module-notes-editor"
export { ModuleNotesParticleSource } from "./components/module-notes-particle-source"
export {
  ParticleFrame,
  ParticleHeader,
  ParticleBody,
} from "./components/particle-frame"
export { particleInspectorMaxWidth } from "./lib/particle-editing"
export { ParticleDocumentLibrarySource } from "./components/particle-document-library-source"
export type { ParticleLibraryDocument } from "./lib/particle-library-document"
export { resolveLibraryImageParticle } from "./lib/particle-library-document"
export { ParticleHistoryActions } from "./components/particle-history-actions"
export {
  ParticleNode,
  ParticleRemoveControl,
  type ParticleLibraryTool,
  ParticleLibrary,
  ParticleInspector,
  ParticleComposer,
  ParticleCreateActions,
} from "./components"
export { useParticleFlow } from "./hooks/use-particle-flow"
export { useParticleCalendarTarget } from "./hooks/use-particle-calendar-target"
export type {
  Particle,
  ParticleType,
  ParticleStatus,
  ParticlePosition,
  ParticleConnection,
  ParticleGraph,
  ParticleOperation,
  ParticleBatch,
  ParticleCommit,
  ParticleResult,
  ParticleFailureCode,
} from "./types"

export { ParticleEdge } from "./components/particle-edge"
export {
  ParticleGeometryObserver,
  ParticleLayoutActions,
} from "./components/particle-layout-controls"

export { ParticleConnections } from "./components/particle-connections"

export { isWorkspaceToolId } from "./lib/workspace-tool-contract"

export {
  ParticleConnectionMenu,
  type ParticleConnectionMenuState,
} from "./components/particle-connection-menu"


export { ParticleLibraryDragProvider } from "./components/particle-library-drag-provider"
export type { ParticleLibraryDragRequest } from "./components/particle-library-drag-context"
export { useParticleLibraryDropTarget } from "./hooks/use-particle-library-drop-targets"
export type { ParticleLibraryDragItem } from "./components/particle-library-drag-context"
export { uploadParticleFile, particleFileError, PARTICLE_FILE_ACCEPT } from "./lib/particle-file"

export { useParticleSession, type ParticleSession } from "./hooks/use-particle-session"
export { usePersonPlacements } from "./hooks/use-person-placements"

export { ParticleDiscardDialog } from "./components/particle-discard-dialog"

export type { ParticlePlan, ParticlePlanProposal, ParticlePlanning } from "./lib/particle-plan-schema"
export { PARTICLE_PRESETS, DEFAULT_PRESET_FIELDS, buildParticlePreset } from "./lib/particle-presets"
export type { ParticlePreset } from "./lib/particle-presets"

export { researchPlanOperations } from "./lib/research-plan"

export { planFromProposal } from "./lib/particle-plan-schema"

export { particlePlanBranchStates, particlePlanBranchLabel, particlePlanOutcomeReferences } from "./lib/particle-plan-branches"
export type { PlanBranchState } from "./lib/particle-plan-branches"
