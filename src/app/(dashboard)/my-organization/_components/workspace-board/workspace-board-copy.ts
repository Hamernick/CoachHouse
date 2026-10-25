import type {
  WorkspaceCardId,
  WorkspaceConnectionState,
} from "./workspace-board-types"
import {
  WORKSPACE_ACCELERATOR_PATH,
  WORKSPACE_PATH,
  WORKSPACE_ROADMAP_PATH,
  getWorkspaceEditorPath,
} from "@/lib/workspace/routes"

export type WorkspaceCardMeta = {
  title: string
  subtitle: string
  fullHref: string
}

export const WORKSPACE_CARD_META: Record<WorkspaceCardId, WorkspaceCardMeta> = {
  "organization-overview": {
    title: "Organization",
    subtitle: "Identity and operating baseline",
    fullHref: WORKSPACE_PATH,
  },
  programs: {
    title: "Resource",
    subtitle: "Projects, programs, events, services, and grant requests",
    fullHref: "",
  },
  accelerator: {
    title: "Accelerator",
    subtitle: "Class tracks, lessons, and resources",
    fullHref: WORKSPACE_ACCELERATOR_PATH,
  },
  roadmap: {
    title: "Roadmap",
    subtitle: "Strategic priorities, sequencing, and operating focus",
    fullHref: WORKSPACE_ROADMAP_PATH,
  },
  "brand-kit": {
    title: "Brand Kit",
    subtitle: "Logos, palette, and a reusable export pack",
    fullHref: "",
  },
  "economic-engine": {
    title: "Fundraising",
    subtitle: "Funding architecture and pipeline health",
    fullHref: getWorkspaceEditorPath({ tab: "programs" }),
  },
  calendar: {
    title: "Calendar",
    subtitle: "Milestones, board cadence, and invites",
    fullHref: WORKSPACE_ROADMAP_PATH,
  },
  communications: {
    title: "Communications",
    subtitle: "Brand basics, heat map, and publishing readiness",
    fullHref: "",
  },
  deck: {
    title: "Tasks",
    subtitle: "Roadmap priorities and accelerator classes in one surface",
    fullHref: WORKSPACE_ACCELERATOR_PATH,
  },
  atlas: {
    title: "Map",
    subtitle: "Public place, checklist, and launch readiness",
    fullHref: getWorkspaceEditorPath({ tab: "company" }),
  },
  "fiscal-sponsorship": {
    title: "Fiscal Sponsorship",
    subtitle: "Model C eligibility, agreements, and grant requests",
    fullHref: "",
  },
}

export const WORKSPACE_EDGE_SPECS: WorkspaceConnectionState[] = [
  {
    id: "edge-organization-to-programs",
    source: "organization-overview",
    target: "programs",
  },
  {
    id: "edge-organization-to-roadmap",
    source: "organization-overview",
    target: "roadmap",
  },
  {
    id: "edge-roadmap-to-deck",
    source: "roadmap",
    target: "deck",
  },
  {
    id: "edge-organization-to-atlas",
    source: "organization-overview",
    target: "atlas",
  },
  {
    id: "edge-activity-to-fiscal-sponsorship",
    source: "programs",
    target: "fiscal-sponsorship",
  },
  {
    id: "edge-organization-to-accelerator",
    source: "organization-overview",
    target: "accelerator",
  },
  {
    id: "edge-deck-to-accelerator",
    source: "deck",
    target: "accelerator",
  },
  {
    id: "edge-accelerator-to-economic",
    source: "accelerator",
    target: "economic-engine",
  },
  {
    id: "edge-accelerator-to-calendar",
    source: "accelerator",
    target: "calendar",
  },
  {
    id: "edge-accelerator-to-comms",
    source: "accelerator",
    target: "communications",
  },
]
