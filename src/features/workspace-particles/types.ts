import type {
  ObjectivePlan,
  ObjectivePlanPart,
} from "@/features/workspace-objective-planner/client"
import type { RoadmapSection } from "@/lib/roadmap/types"

export type ParticleKind =
  | "organization"
  | "activity"
  | "roadmap"
  | "drive"
  | "image"
  | "plan"
export type ParticleSize = "icon" | "mini" | "large"
export type ParticleReference = { kind: ParticleKind; id: string }
export type ParticlePlacement = {
  id: string
  source: ParticleReference
  x: number
  y: number
  size: ParticleSize
}
export type ParticleImage = { id: string; title: string; path: string }
export type ParticleConnection = { id: string; source: string; target: string }
export type WorkspaceParticleState = {
  version: 1
  plans?: ObjectivePlan[]
  items: ParticlePlacement[]
  images: ParticleImage[]
  connections: ParticleConnection[]
  updatedAt: string
}
export type ParticleDriveDocument = {
  id: string
  fileId: string
  name: string
  mimeType: string
  webViewLink?: string | null
  modifiedAt?: string | null
  status: "available" | "trashed" | "inaccessible" | "needs_reconnect"
}
export type ParticleOrganization = {
  id: string
  title: string
  subtitle: string
  logoUrl?: string | null
  headerUrl?: string | null
  programsCount: number
  peopleCount: number
  fundingGoalCents: number
  raisedCents: number
}
export type ParticleActivity = {
  id: string
  source: "calendar" | "accelerator" | "communications" | "donations"
  status: "scheduled" | "completed"
  title: string
  timestamp: string
  description?: string | null
  href?: string | null
}
export type ParticleCalendarEvent = {
  id: string
  title: string
  startsAt: string
  allDay: boolean
  assignedRoles: string[]
}
export type ParticleProgram = {
  id: string
  title: string
  location?: string | null
  description?: string | null
  bannerImageUrl?: string | null
  imageUrl?: string | null
  statusLabel?: string | null
  chips: string[]
  goalCents: number
  raisedCents: number
}
export type ParticleSource = {
  ref: ParticleReference
  title: string
  description: string
  available: boolean
  canvasNodeId?: string
  section?: RoadmapSection
  document?: ParticleDriveDocument
  image?: ParticleImage
  plan?: ObjectivePlan
  planPart?: ObjectivePlanPart
  organization?: ParticleOrganization
  activities?: ParticleActivity[]
  calendarEvents?: ParticleCalendarEvent[]
  programs?: ParticleProgram[]
  href?: string | null
}
