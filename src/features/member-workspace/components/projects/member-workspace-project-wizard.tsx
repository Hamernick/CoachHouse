"use client"

import { loadSharedProjectOptions, manageSharedProjectOption } from "../../project-workflow-actions"
import type { ProjectOptionSettings } from "../../lib/project-option-settings"

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useEffect, useMemo, useState, useTransition } from "react"
import { GuidedProjectSetup } from "./guided-project-setup"
import { usePathname, useRouter } from "next/navigation"

import {
  ProjectWizard,
  type Client,
  type PlatformAdminDashboardLabProject,
  type PlatformAdminDashboardLabStatus,
  type StepQuickCreateValue,
} from "@/features/platform-admin-dashboard"
import type {
  MemberWorkspaceCreateProjectFormInput,
  MemberWorkspacePersonOption,
  MemberWorkspaceProjectOrganizationOption,
} from "../../types"
import { toast } from "@/lib/toast"

type MemberWorkspaceProjectWizardProps = {
  createProjectAction?: (
    input: MemberWorkspaceCreateProjectFormInput
  ) => Promise<{ ok: true; id: string } | { error: string }>
  initialProject?: PlatformAdminDashboardLabProject | null
  onOpenChange: (open: boolean) => void
  open: boolean
  organizationOptions: MemberWorkspaceProjectOrganizationOption[]
  assigneeOptions?: MemberWorkspacePersonOption[]
  updateProjectAction?: (
    projectId: string,
    input: MemberWorkspaceCreateProjectFormInput
  ) => Promise<{ ok: true; id: string } | { error: string }>
}

const ORGANIZATION_STATUS_OPTIONS = [
  { id: "todo", label: "Onboarding", dotClass: "bg-orange-600" },
  { id: "in-progress", label: "Active", dotClass: "bg-teal-600" },
  { id: "canceled", label: "Archived", dotClass: "bg-zinc-500" },
]

const PROJECT_STATUS_OPTIONS = [
  { id: "backlog", label: "Backlog", dotClass: "bg-zinc-500" },
  { id: "planned", label: "Planned", dotClass: "bg-blue-600" },
  { id: "active", label: "Active", dotClass: "bg-teal-600" },
  { id: "completed", label: "Completed", dotClass: "bg-emerald-600" },
  { id: "cancelled", label: "Cancelled", dotClass: "bg-zinc-500" },
]

function todayDateValue() {
  return new Date().toISOString().slice(0, 10)
}

function defaultEndDateValue(startDate: string) {
  const date = new Date(`${startDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 28)
  return date.toISOString().slice(0, 10)
}

function toDateValue(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : undefined
}

function mapProjectStatusToQuickStatus(
  status: PlatformAdminDashboardLabStatus
) {
  switch (status) {
    case "active":
      return "in-progress"
    case "completed":
    case "cancelled":
      return "canceled"
    default:
      return "todo"
  }
}

function mapQuickStatusToProjectStatus(
  statusId?: string
): PlatformAdminDashboardLabStatus {
  switch (statusId) {
    case "backlog":
    case "planned":
    case "active":
    case "completed":
    case "cancelled":
      return statusId
    case "todo":
      return "planned"
    case "in-progress":
      return "active"
    case "canceled":
      return "cancelled"
    default:
      return "planned"
  }
}

function mapQuickCreateToInput({
  value,
  organizationOptions,
}: {
  value: StepQuickCreateValue
  organizationOptions: MemberWorkspaceProjectOrganizationOption[]
}): MemberWorkspaceCreateProjectFormInput {
  const startDate = toDateValue(value.startDate) ?? todayDateValue()
  const endDate =
    toDateValue(value.targetDate) ?? defaultEndDateValue(startDate)
  const selectedOrganization =
    organizationOptions.find(
      (organization) => organization.orgId === value.clientId
    ) ?? organizationOptions[0]

  return {
    orgId: selectedOrganization?.orgId,
    name: value.title,
    description: value.description,
    status: mapQuickStatusToProjectStatus(value.statusId),
    priority:
      value.priorityId === "urgent" ||
      value.priorityId === "high" ||
      value.priorityId === "medium" ||
      value.priorityId === "low"
        ? value.priorityId
        : "medium",
    startDate,
    endDate,
    clientName: selectedOrganization?.name,
    typeLabel: value.sprintTypeLabel ?? (
      value.sprintTypeId === "design"
        ? "Design Sprint"
        : value.sprintTypeId === "dev"
          ? "Dev Sprint"
          : value.sprintTypeId === "planning"
            ? "Planning"
            : value.sprintTypeId?.trim() || undefined),
    durationLabel:
      value.workstreamId === "frontend"
        ? "Frontend"
        : value.workstreamId === "backend"
          ? "Backend"
          : value.workstreamId === "design"
            ? "Design"
            : value.workstreamId === "qa"
              ? "QA"
              : undefined,
    tags: value.tagLabel?.trim() || value.tagId?.trim() || undefined,
    optionSettings: value.optionSettings,
    memberLabels: value.assigneeId ? undefined : undefined,
  }
}

function mapQuickCreateToMemberLabels({
  assigneeId,
  assigneeOptions,
  initialProject,
}: {
  assigneeId?: string
  assigneeOptions: MemberWorkspacePersonOption[]
  initialProject?: PlatformAdminDashboardLabProject | null
}) {
  const selectedAssignee =
    assigneeOptions.find((option) => option.id === assigneeId) ??
    initialProject?.members.find(
      (member) =>
        member.trim().toLowerCase() === assigneeId?.trim().toLowerCase()
    )

  if (!selectedAssignee) {
    return ""
  }

  return typeof selectedAssignee === "string"
    ? selectedAssignee
    : selectedAssignee.name
}

function buildQuickCreateInitialValue({
  initialProject,
  assigneeOptions,
  organizationOptions,
}: {
  initialProject?: PlatformAdminDashboardLabProject | null
  assigneeOptions: MemberWorkspacePersonOption[]
  organizationOptions: MemberWorkspaceProjectOrganizationOption[]
}): Partial<StepQuickCreateValue> | undefined {
  if (!initialProject) return undefined

  const firstMember = initialProject.members[0]?.trim().toLowerCase()
  const matchingAssigneeId =
    assigneeOptions.find(
      (option) => option.name.trim().toLowerCase() === firstMember
    )?.id ?? initialProject.members[0]

  return {
    title: initialProject.name,
    description: initialProject.description,
    assigneeId: matchingAssigneeId,
    startDate: initialProject.startDate,
    statusId: mapProjectStatusToQuickStatus(initialProject.status),
    targetDate: initialProject.endDate,
    priorityId: initialProject.priority,
    clientId: initialProject.organizationId ?? organizationOptions[0]?.orgId,
    sprintTypeId:
      initialProject.typeLabel === "Design Sprint"
        ? "design"
        : initialProject.typeLabel === "Dev Sprint"
          ? "dev"
          : initialProject.typeLabel === "Planning"
            ? "planning"
            : initialProject.typeLabel || undefined,
    workstreamId:
      initialProject.durationLabel === "Frontend"
        ? "frontend"
        : initialProject.durationLabel === "Backend"
          ? "backend"
          : initialProject.durationLabel === "Design"
            ? "design"
            : initialProject.durationLabel === "QA"
              ? "qa"
              : undefined,
    tagId: initialProject.tags[0],
  }
}

export function MemberWorkspaceProjectWizard({
  createProjectAction,
  initialProject,
  onOpenChange,
  open,
  organizationOptions,
  assigneeOptions = [],
  updateProjectAction,
}: MemberWorkspaceProjectWizardProps) {
  const router = useRouter()
  const directoryHref = (usePathname() ?? "").startsWith("/projects") ? "/projects" : "/organizations"
  const [optionSettings, setOptionSettings] = useState<ProjectOptionSettings | undefined>();
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [loadedOptionsFor, setLoadedOptionsFor] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState("");
  useEffect(() => {
    let active = true;
    setOptionSettings(undefined); setOptionsError(""); setLoadedOptionsFor(null); setOptionsLoading(false);
    if (!open) return;
    setOptionsLoading(true);
    loadSharedProjectOptions().then((result) => {
      if (!active) return;
      if ("error" in result) setOptionsError(result.error ?? "Unable to load project options.");
      else setOptionSettings(result.settings);
    }).catch(() => { if (active) setOptionsError("Unable to load project options. Close and reopen to retry."); })
      .finally(() => { if (active) { setOptionsLoading(false); setLoadedOptionsFor(initialProject?.id ?? "new"); } });
    return () => { active = false; };
  }, [open, initialProject?.id]);
  const [renderOpen, setRenderOpen] = useState(open)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setRenderOpen(open)
  }, [open])

  const clientOptions = useMemo<Client[]>(
    () =>
      organizationOptions.map((organization) => ({
        id: organization.orgId,
        name: organization.name,
        status: "active",
      })),
    [organizationOptions]
  )

  const quickCreateUsers = useMemo(
    () =>
      assigneeOptions.map((person) => ({
        id: person.id,
        name: person.name,
        avatar: person.avatarUrl ?? undefined,
      })),
    [assigneeOptions]
  )

  const quickCreateInitialValue = useMemo(
    () =>
      buildQuickCreateInitialValue({
        initialProject,
        assigneeOptions,
        organizationOptions,
      }),
    [assigneeOptions, initialProject, organizationOptions]
  )

  const closeWizard = () => {
    setRenderOpen(false)
    onOpenChange(false)
  }

  const resolvedInitialValue = useMemo(() => ({
    ...quickCreateInitialValue,
    ...(directoryHref === "/projects" && initialProject ? { statusId: initialProject.status } : {}),
    optionSettings,
    ...(initialProject ? { sprintTypeId: initialProject.typeLabel } : {}),
  }), [quickCreateInitialValue, directoryHref, initialProject, optionSettings]);

  const submitProjectInput = (input: MemberWorkspaceCreateProjectFormInput) => {
    startTransition(async () => {
      const result = initialProject
        ? await updateProjectAction?.(initialProject.id, input)
        : await createProjectAction?.(input)

      if (!result) {
        toast.error("Project actions are unavailable.")
        return
      }

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success(
        directoryHref === "/projects"
          ? initialProject ? "Project updated" : "Project created"
          : initialProject ? "Organization updated" : "Organization created"
      )
      closeWizard()
      router.refresh()

      if (!initialProject && directoryHref !== "/projects") {
        router.push(`${directoryHref}/${result.id}`)
      }
    })
  }

  if (!renderOpen) {
    return null
  }

  if (loadedOptionsFor !== (initialProject?.id ?? "new")) {
    return <Dialog open onOpenChange={(next) => { if (!next) closeWizard(); }}>
      <DialogContent><DialogTitle>{initialProject ? "Edit project" : "Create project"}</DialogTitle><DialogDescription>Loading project options…</DialogDescription></DialogContent>
    </Dialog>
  }

  return (
    <ProjectWizard
      renderGuidedSetup={() => <GuidedProjectSetup organizations={organizationOptions} onClose={closeWizard} directoryHref={directoryHref} />}
      onClose={closeWizard}
      mode={initialProject ? "edit" : "create"}
      skipModeStep={Boolean(initialProject)}
      quickCreateInitialValue={resolvedInitialValue}
      quickCreateSubmitLabel={
        initialProject ? "Save Changes" : directoryHref === "/projects" ? "Create project" : "Create Organization"
      }
      quickCreateError={optionsError}
      manageOption={(kind, action, option) => manageSharedProjectOption({ kind, action, option })}
      quickCreateSubmitPending={isPending || optionsLoading}
      quickCreateUsers={quickCreateUsers}
      quickCreateStatuses={directoryHref === "/projects" ? PROJECT_STATUS_OPTIONS : ORGANIZATION_STATUS_OPTIONS}
      quickCreateClients={clientOptions}
      onQuickCreate={(value) =>
        submitProjectInput({
          ...mapQuickCreateToInput({
            value,
            organizationOptions,
          }),
          tags: [value.tagLabel ?? value.tagId, ...(initialProject?.tags.slice(1) ?? [])].filter(Boolean).join(","),
          memberLabels: mapQuickCreateToMemberLabels({
            assigneeId: value.assigneeId,
            assigneeOptions,
            initialProject,
          }),
        })
      }
      guidedCreateLabel="Create project"
      guidedCreatePending={isPending}
    />
  )
}
