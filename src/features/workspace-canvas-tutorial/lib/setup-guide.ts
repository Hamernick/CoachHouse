import { getWorkspaceEditorPath } from "@/lib/workspace/routes"

export const SETUP_GUIDE_VERSION = 2
export const SETUP_GUIDE_STAGE_IDS = ["welcome", "identity", "identity-edit", "identity-drawer", "people", "program", "story", "review", "next"] as const
export type SetupGuideStage = typeof SETUP_GUIDE_STAGE_IDS[number]
export type SetupGuideProgress = { version: 2; stage: SetupGuideStage; status: "active" | "paused" | "finished" }
export type SetupGuideEvidence = {
  name?: string | null
  description?: string | null
  mission?: string | null
  programCount: number
  isPublic?: boolean | null
  canEdit: boolean
  hasAcceleratorAccess: boolean
}
export function normalizeSetupGuideProgress(value: unknown): SetupGuideProgress | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (![1, 2].includes(Number(record.version)) || !SETUP_GUIDE_STAGE_IDS.includes(record.stage as SetupGuideStage)) return null
  if (!["active", "paused", "finished"].includes(String(record.status))) return null
  return { version: 2, stage: record.stage as SetupGuideStage, status: record.status as SetupGuideProgress["status"] }
}

export function resolveSetupGuideResumeStage(stageParam: string | null, saved: unknown): SetupGuideStage {
  return SETUP_GUIDE_STAGE_IDS.includes(stageParam as SetupGuideStage)
    ? stageParam as SetupGuideStage
    : normalizeSetupGuideProgress(saved)?.stage ?? "welcome"
}

export function setupGuideReturnHref(stage: SetupGuideStage) {
  const params = new URLSearchParams({ guide: "1", guideStep: stage })
  if (stage === "identity-drawer") params.set("drawer", "organization")
  if (stage === "people") params.set("drawer", "people")
  if (stage === "program") {
    params.set("drawer", "organization")
    params.set("tab", "programs")
  }
  if (stage === "story" || stage === "review") {
    params.set("drawer", "accelerator")
    params.set("focus", stage === "review" ? "organization-launch" : "roadmap-guide")
  }
  return `/workspace?${params}`
}

export function setupGuideEditorHref(stage: SetupGuideStage, tab: "company" | "programs", focus?: string) {
  const url = new URL(getWorkspaceEditorPath({ tab, focus }), "https://workspace.local")
  url.searchParams.set("from", "workspace-guide")
  url.searchParams.set("returnTo", setupGuideReturnHref(stage))
  return url.pathname + url.search
}

export function resolveSetupGuideStage(stage: SetupGuideStage, evidence: SetupGuideEvidence) {
  const stages = {
    welcome: { title: "Welcome to your workspace", body: "Your organization, people and programs, all in one place. Let’s take a quick look around.", label: "Get started", href: null, complete: false },
    identity: { title: "Start with your organization", body: "This card brings your organization’s name, logo and story together. It’s your home base on the canvas.", label: "Next", href: null, complete: Boolean(evidence.name?.trim()) },
    "identity-edit": { title: "Your details, easy to update", body: "The Edit button opens your organization’s details. After the tour, use it to update your name, logo and story.", label: "Next", href: null, complete: false },
    "identity-drawer": { title: "Another way to your details", body: "Open Organization in the drawer to see the same profile. You’re viewing it here; choose Edit when you’re ready to make changes.", label: "Next", href: null, complete: false },
    people: { title: "Bring your people into view", body: "The People tab keeps your contacts together. After the tour, search here and use a person’s drag handle to place them on the canvas.", label: "Next", href: null, complete: false },
    program: { title: "Add your resources", body: "Share the programs, services and resources your organization offers.", label: "Next", href: null, complete: evidence.programCount > 0 },
    story: { title: "Build faster", body: evidence.hasAcceleratorAccess ? "The Accelerator brings your lessons, roadmap and progress together. Choose a lesson here after the tour." : "Upgrade to the Accelerator. Go from idea to impact with guided lessons, checklists, and frameworks to help you get on the map and in good standing.", label: "Next", href: null, complete: Boolean(evidence.description?.trim() || evidence.mission?.trim()) },
    review: { title: "Decide when to go public", body: "Build your nfp tracks your saved profile details. This is where you finish setup and preview what visitors will see. Staying private is always an option.", label: "Next", href: null, complete: evidence.isPublic === true },
    next: { title: "You know your way around", body: "Your profile, people and plan all live here. Continue building from your organization card. Nothing becomes public until you choose to publish.", label: "Continue building", href: "/workspace", complete: false },
  }
  return stages[stage]
}

export function setupGuideFocusCard(stage: SetupGuideStage) {
  if (stage === "identity" || stage === "identity-edit" || stage === "next") return "organization-overview"
  if (stage === "program") return "programs"
  return null
}

export function nextSetupGuideStage(stage: SetupGuideStage, _evidence?: SetupGuideEvidence): SetupGuideStage {
  // A walkthrough teaches the interface even when the underlying profile is complete.
  return SETUP_GUIDE_STAGE_IDS[SETUP_GUIDE_STAGE_IDS.indexOf(stage) + 1] ?? "next"
}

export const SETUP_GUIDE_TARGETS: Partial<Record<SetupGuideStage, string>> = {
  identity: '.react-flow__node[data-id="organization-overview"]',
  "identity-edit": '.react-flow__node[data-id="organization-overview"] [aria-label="Edit card"]',
  "identity-drawer": '[data-setup-guide-tab="organization"]',
  program: '[data-workspace-organization-drawer-panel="true"] [data-setup-guide-target="programs"]',
  people: '[data-setup-guide-tab="people"]',
  story: '[data-setup-guide-tab="accelerator"]',
  review: '[data-setup-guide-target="launch"]',
}
