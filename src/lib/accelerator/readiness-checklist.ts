import { getWorkspaceEditorPath } from "@/lib/workspace/routes"

export type ReadinessChecklistItem = {
  href: string
  label: string
}

const READINESS_REASON_TO_CTA: Record<string, { href: string; label: string }> =
  {
    "Add an EIN": {
      href: getWorkspaceEditorPath({ tab: "company" }),
      label: "Add an EIN",
    },
    "Confirm 501(c)(3) status": {
      href: getWorkspaceEditorPath({ tab: "company" }),
      label: "Confirm 501(c)(3) status",
    },
    "Set a program funding goal": {
      href: getWorkspaceEditorPath({ tab: "programs" }),
      label: "Set a program funding goal",
    },
    "Upload legal formation document": {
      href: "/organization/documents",
      label: "Upload legal document",
    },
    "Upload verification letter": {
      href: "/organization/documents",
      label: "Upload verification letter",
    },
    "Formation status must be approved": {
      href: getWorkspaceEditorPath({ tab: "company" }),
      label: "Set formation status",
    },
  }

export function buildReadinessChecklist(options: {
  reasons: string[]
  nextFormationModuleHref?: string | null
  nextCoreRoadmapHref?: string | null
  maxItems?: number
}): ReadinessChecklistItem[] {
  const {
    reasons,
    nextFormationModuleHref,
    nextCoreRoadmapHref,
    maxItems = 3,
  } = options

  const mapped = reasons
    .map((reason) => {
      if (reason === "Complete the Formation class") {
        return {
          href:
            nextFormationModuleHref ?? "/accelerator/class/formation/module/1",
          label: "Complete the Formation class",
        }
      }
      if (reason === "Complete core roadmap sections") {
        return {
          href: nextCoreRoadmapHref ?? "/workspace/roadmap/origin-story",
          label: "Complete core roadmap sections",
        }
      }
      return READINESS_REASON_TO_CTA[reason] ?? null
    })
    .filter((entry): entry is ReadinessChecklistItem => Boolean(entry))

  return mapped
    .filter(
      (entry, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.href === entry.href && candidate.label === entry.label
        ) === index
    )
    .slice(0, maxItems)
}
