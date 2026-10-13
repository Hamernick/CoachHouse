import { buildFindOrganizationHref } from "@/lib/find/routes"
import { organizationNarrativeHtmlToPlainText } from "@/lib/roadmap/organization-narratives"
import { getWorkspaceDrawerPath, getWorkspaceEditorPath } from "@/lib/workspace/routes"
import { withEditorReturnTo } from "@/lib/workspace/editor-navigation"
import type { OrganizationLaunchInput, OrganizationLaunchStep } from "../types"

function text(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeOrganizationLaunchInput(input: OrganizationLaunchInput): OrganizationLaunchInput {
  return {
    ...input,
    name: text(input.name),
    publicSlug: text(input.publicSlug),
    description: organizationNarrativeHtmlToPlainText(text(input.description)),
    mission: organizationNarrativeHtmlToPlainText(text(input.mission)),
    isPublic: input.isPublic === true,
    programCount: Number.isFinite(input.programCount) ? Math.max(0, Math.floor(input.programCount)) : 0,
  }
}

// Guidance from saved profile data, not a replacement for publication authorization.
export function resolveOrganizationLaunch(input: OrganizationLaunchInput) {
  const profile = normalizeOrganizationLaunchInput(input)
  const description = text(profile.description) || text(profile.mission)
  const online = profile.locationType === "online"
  const hasLocation = online
    ? /^https?:\/\//i.test(text(profile.locationUrl))
    : Boolean(text(profile.addressStreet) || text(profile.address) || text(profile.addressCity))
  const steps: OrganizationLaunchStep[] = [
    {
      id: "identity", title: "Name your organization", detail: "Add your name and public profile URL.",
      complete: Boolean(profile.name && profile.publicSlug), optional: false,
      href: getWorkspaceEditorPath({ tab: "company", focus: profile.name ? "public-page" : "name" }),
    },
    {
      id: "story", title: "Tell people what you do", detail: "Write a short description of your work.",
      complete: Boolean(description), optional: false,
      href: getWorkspaceEditorPath({ tab: "company", focus: "description" }),
    },
    {
      id: "location", title: online ? "Add your online destination" : "Choose a public location",
      detail: online ? "Link to where people can access your work." : "A public profile can exist without a map pin.",
      complete: hasLocation, optional: true,
      href: getWorkspaceEditorPath({ tab: "company", focus: online ? "public-page" : "address" }),
    },
    {
      id: "program", title: "Add a program or activity", detail: "Choose separately which activities to share.",
      complete: profile.programCount > 0, optional: true,
      href: getWorkspaceEditorPath({ tab: "programs" }),
    },
    {
      id: "publish", title: "Review your public profile", detail: "You decide when your profile becomes public.",
      complete: Boolean(profile.isPublic), optional: false,
      href: "/workspace/profile-preview",
    },
  ]
  for (const step of steps) {
    if (step.id === "publish") continue
    step.href = `${withEditorReturnTo(step.href, getWorkspaceDrawerPath({ tab: "accelerator", focus: "organization-launch" }))}&from=organization-launch`
  }
  const essentials = steps.filter((step) => !step.optional)
  const next = essentials.find((step) => !step.complete) ?? essentials[essentials.length - 1]
  return {
    profile,
    description,
    steps,
    next,
    completedCount: essentials.filter((step) => step.complete).length,
    totalCount: essentials.length,
    publicHref: profile.isPublic && profile.publicSlug ? buildFindOrganizationHref(profile.publicSlug) : null,
    locationLabel: online ? "Online organization" : [text(profile.addressCity), text(profile.addressState)].filter(Boolean).join(", "),
  }
}
