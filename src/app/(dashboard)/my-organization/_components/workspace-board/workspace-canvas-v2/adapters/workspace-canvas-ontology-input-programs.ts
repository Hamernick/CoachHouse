import type {
  WorkspaceOntologyInput,
  WorkspaceOntologyNodeInput,
} from "@/features/workspace-ontology"
import {
  buildWorkspaceAcceleratorFullscreenHref,
  isWorkspaceAcceleratorControllerStepVisible,
} from "@/features/workspace-accelerator-card"
import {
  WORKSPACE_ACCELERATOR_PATH,
  getWorkspaceAcceleratorPaywallPath,
  getWorkspaceEditorPath,
} from "@/lib/workspace/routes"

import type {
  WorkspaceOrganizationEditorData,
  WorkspaceSeedData,
} from "../../workspace-board-types"
import { isWorkspaceAcceleratorOntologyStepVisible } from "./workspace-canvas-ontology-input-accelerator"

export const WORKSPACE_ONTOLOGY_RECENT_ACTIVITY_LIMIT = 3

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function sortRecentActivity(activities: WorkspaceSeedData["activityFeed"]) {
  return activities
    .map((activity, index) => ({
      activity,
      index,
      timestamp: Date.parse(activity.timestamp),
    }))
    .sort(
      (left, right) =>
        (Number.isFinite(right.timestamp) ? right.timestamp : 0) -
          (Number.isFinite(left.timestamp) ? left.timestamp : 0) ||
        left.index - right.index
    )
    .map(({ activity }) => activity)
}

function resolveActivityHref({
  activity,
  seed,
}: {
  activity: WorkspaceSeedData["activityFeed"][number]
  seed: WorkspaceSeedData
}) {
  if (activity.source !== "accelerator") return activity.href ?? null
  if (!seed.hasAcceleratorAccess) {
    return getWorkspaceAcceleratorPaywallPath("workspace-ontology")
  }

  const moduleId =
    typeof activity.metadata?.moduleId === "string"
      ? activity.metadata.moduleId
      : null
  const moduleSteps =
    seed.acceleratorTimeline
      ?.filter((step) => step.moduleId === moduleId)
      .filter(isWorkspaceAcceleratorControllerStepVisible) ?? []
  const destinationStep =
    moduleSteps.find((step) => step.status === "in_progress") ??
    moduleSteps.find((step) => {
      const status = String(step.status)
      return (
        status !== "completed" &&
        status !== "complete" &&
        step.stepKind !== "complete"
      )
    }) ??
    moduleSteps[0]

  return destinationStep
    ? buildWorkspaceAcceleratorFullscreenHref({
        stepId: destinationStep.id,
        moduleId: destinationStep.moduleId,
      })
    : WORKSPACE_ACCELERATOR_PATH
}

export function buildWorkspaceProgramsOntologyRoot({
  seed,
  editor,
}: {
  seed: WorkspaceSeedData
  editor: WorkspaceOrganizationEditorData
}): WorkspaceOntologyInput["roots"][number] {
  const hiddenAcceleratorModuleIds = new Set(
    (seed.acceleratorTimeline ?? [])
      .filter((step) => !isWorkspaceAcceleratorOntologyStepVisible(step))
      .map((step) => step.moduleId)
  )
  const programNodes = editor.programs
    .filter((program) => program.status_label?.trim().toLowerCase() !== "draft")
    .map<WorkspaceOntologyNodeInput>((program) => {
      const complete = hasText(program.title) && hasText(program.description)
      return {
        id: `ontology:program:${program.id}`,
        label: program.title?.trim() || "Untitled program",
        description:
          program.description?.trim() || "Add a clear program description.",
        category: "programs",
        kind: "Program",
        status: complete ? "complete" : "missing",
        statusLabel: complete
          ? program.status_label?.trim() || "Program defined"
          : "Needs definition",
        relationshipLabel: "delivers",
        href: getWorkspaceEditorPath({
          tab: "programs",
          programId: program.id,
        }),
        actionLabel:
          complete || !editor.canEdit ? "Open program" : "Complete program",
        keywords: [
          program.subtitle ?? "",
          program.location ?? "",
          ...(program.features ?? []),
        ],
      }
    })
  const allActivity = sortRecentActivity(
    seed.activityFeed.filter((activity) => {
      if (activity.source === "calendar") return false
      if (activity.source !== "accelerator") return true
      const moduleId =
        typeof activity.metadata?.moduleId === "string"
          ? activity.metadata.moduleId
          : null
      return !moduleId || !hiddenAcceleratorModuleIds.has(moduleId)
    })
  )
  const activityNodes = allActivity
    .slice(0, WORKSPACE_ONTOLOGY_RECENT_ACTIVITY_LIMIT)
    .map<WorkspaceOntologyNodeInput>((activity) => ({
      id: `ontology:activity:${activity.id}`,
      label: activity.title,
      description:
        activity.description?.trim() || "Recent organization activity.",
      category: "activity",
      kind: "Activity",
      status: activity.status === "completed" ? "complete" : "in-progress",
      statusLabel: activity.status === "completed" ? "Completed" : "Scheduled",
      relationshipLabel: "produces",
      href: resolveActivityHref({ activity, seed }),
      actionLabel:
        activity.href || activity.source === "accelerator" ? "Open" : null,
      keywords: [activity.source, activity.type, activity.timestamp],
    }))

  return {
    id: "programs",
    label: "Resources",
    children: [
      {
        id: "ontology:programs:portfolio",
        label: "Program portfolio",
        description: "Services, initiatives, projects, and public offerings.",
        category: "programs",
        kind: "Portfolio",
        status: programNodes.length > 0 ? "in-progress" : "missing",
        statusLabel:
          programNodes.length > 0
            ? `${programNodes.length} programs`
            : "No programs yet",
        relationshipLabel: "contains",
        href: getWorkspaceEditorPath({ tab: "programs" }),
        actionLabel:
          programNodes.length > 0
            ? editor.canEdit
              ? "Manage programs"
              : "View programs"
            : editor.canEdit
              ? "Create program"
              : "View programs",
        children: programNodes,
      },
      {
        id: "ontology:programs:activity",
        label: "Operational activity",
        description: "Recent and scheduled work connected to the organization.",
        category: "activity",
        kind: "Activity stream",
        status: activityNodes.length > 0 ? "in-progress" : "missing",
        statusLabel:
          activityNodes.length > 0
            ? `${activityNodes.length} recent${allActivity.length > activityNodes.length ? ` · ${allActivity.length - activityNodes.length} archived` : ""}`
            : "No activity yet",
        relationshipLabel: "generates",
        href: null,
        actionLabel: null,
        children: activityNodes,
      },
    ],
  }
}
