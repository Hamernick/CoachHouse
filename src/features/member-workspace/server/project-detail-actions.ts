"use server"

import { isOrdinaryWorkspaceProject } from "@/lib/workspace/ordinary-project-access"

import { revalidatePath } from "next/cache"

import type { Database } from "@/lib/supabase"
import type {
  MemberWorkspaceCreateProjectNoteInput,
  MemberWorkspaceCreateProjectQuickLinkInput,
  MemberWorkspaceUpdateProjectNoteInput,
  MemberWorkspaceUpdateProjectQuickLinkInput,
} from "../types"
import { ensureMemberWorkspaceFeatureAccess } from "./access"
import { actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import {
  isMissingOrganizationProjectNotesTableError,
  isMissingOrganizationProjectQuickLinksTableError,
  isMissingOrganizationProjectsTableError,
} from "./table-errors"

type MemberWorkspaceProjectNoteMutationResult =
  | { ok: true; noteId: string }
  | { error: string }

type MemberWorkspaceDeleteProjectNoteResult = { ok: true } | { error: string }

type MemberWorkspaceProjectQuickLinkMutationResult =
  | { ok: true; linkId: string }
  | { error: string }

type MemberWorkspaceDeleteProjectQuickLinkResult =
  | { ok: true }
  | { error: string }

type ProjectNoteMutationProjectRow = Pick<
  Database["public"]["Tables"]["organization_projects"]["Row"],
  "id" | "org_id"
>

type OrganizationProjectNoteInsert =
  Database["public"]["Tables"]["organization_project_notes"]["Insert"]

type OrganizationProjectNoteUpdate =
  Database["public"]["Tables"]["organization_project_notes"]["Update"]

type OrganizationProjectQuickLinkInsert =
  Database["public"]["Tables"]["organization_project_quick_links"]["Insert"]

type OrganizationProjectQuickLinkUpdate =
  Database["public"]["Tables"]["organization_project_quick_links"]["Update"]

function normalizeProjectNoteTitle(value: string) {
  return value.trim()
}

function normalizeProjectNoteContent(value: string | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function normalizeProjectNoteType(value: string | undefined) {
  if (value === "audio" || value === "meeting") {
    return value
  }

  return "general"
}

async function resolveProjectForDetailMutation({
  actor,
  projectId,
}: {
  actor: Awaited<ReturnType<typeof resolveMemberWorkspaceActorContext>>
  projectId: string
}): Promise<
  { ok: true; project: ProjectNoteMutationProjectRow } | { error: string }
> {
  const featureAccess = ensureMemberWorkspaceFeatureAccess(actor)
  if (featureAccess) return featureAccess
  if (!(await isOrdinaryWorkspaceProject({ supabase: actor.supabase, userId: actor.userId, projectId }))) return { error: "Use the fiscal application review for this project." }

  const { data: project, error } = await actor.supabase
    .from("organization_projects")
    .select("id, org_id")
    .eq("id", projectId)
    .maybeSingle<ProjectNoteMutationProjectRow>()

  if (error) {
    if (isMissingOrganizationProjectsTableError(error)) {
      return {
        error:
          "Organizations are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to load that project." }
  }

  if (!project) {
    return { error: "Unable to find that project." }
  }

  if (
    !actorCanAccessOrganizations(actor) &&
    project.org_id !== actor.activeOrg.orgId
  ) {
    return {
      error: "You can only manage project details for the active organization.",
    }
  }

  if (!actorCanAccessOrganizations(actor) && !actor.canEdit) {
    return { error: "Only organization editors can manage project details." }
  }

  return { ok: true, project }
}

function revalidateProjectDetailRoutes(projectId: string) {
  revalidatePath("/organizations")
  revalidatePath(`/organizations/${projectId}`)
}

export async function createMemberWorkspaceProjectNoteAction(
  input: MemberWorkspaceCreateProjectNoteInput
): Promise<MemberWorkspaceProjectNoteMutationResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const project = await resolveProjectForDetailMutation({
    actor,
    projectId: input.projectId,
  })

  if ("error" in project) {
    return project
  }

  const title = normalizeProjectNoteTitle(input.title)
  if (!title) {
    return { error: "Add a title before creating a note." }
  }

  const payload: OrganizationProjectNoteInsert = {
    org_id: project.project.org_id,
    project_id: project.project.id,
    title,
    content: normalizeProjectNoteContent(input.content),
    note_type: normalizeProjectNoteType(input.noteType),
    status: "completed",
    created_by: actor.userId,
    updated_by: actor.userId,
  }

  const { data, error } = await actor.supabase
    .from("organization_project_notes")
    .insert(payload)
    .select("id")
    .single<{ id: string }>()

  if (error) {
    if (isMissingOrganizationProjectNotesTableError(error)) {
      return {
        error:
          "Project notes are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to create note." }
  }

  revalidateProjectDetailRoutes(project.project.id)
  return { ok: true, noteId: data.id }
}

export async function updateMemberWorkspaceProjectNoteAction(
  input: MemberWorkspaceUpdateProjectNoteInput
): Promise<MemberWorkspaceProjectNoteMutationResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const project = await resolveProjectForDetailMutation({
    actor,
    projectId: input.projectId,
  })

  if ("error" in project) {
    return project
  }

  const title = normalizeProjectNoteTitle(input.title)
  if (!title) {
    return { error: "Add a title before saving the note." }
  }

  const payload: OrganizationProjectNoteUpdate = {
    title,
    content: normalizeProjectNoteContent(input.content),
    updated_by: actor.userId,
  }

  if (input.noteType) {
    payload.note_type = normalizeProjectNoteType(input.noteType)
  }

  const { error } = await actor.supabase
    .from("organization_project_notes")
    .update(payload)
    .eq("id", input.noteId)
    .eq("project_id", project.project.id)
    .eq("org_id", project.project.org_id)

  if (error) {
    if (isMissingOrganizationProjectNotesTableError(error)) {
      return {
        error:
          "Project notes are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to update note." }
  }

  revalidateProjectDetailRoutes(project.project.id)
  return { ok: true, noteId: input.noteId }
}

export async function deleteMemberWorkspaceProjectNoteAction({
  noteId,
  projectId,
}: {
  noteId: string
  projectId: string
}): Promise<MemberWorkspaceDeleteProjectNoteResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const project = await resolveProjectForDetailMutation({
    actor,
    projectId,
  })

  if ("error" in project) {
    return project
  }

  const { error } = await actor.supabase
    .from("organization_project_notes")
    .delete()
    .eq("id", noteId)
    .eq("project_id", project.project.id)
    .eq("org_id", project.project.org_id)

  if (error) {
    if (isMissingOrganizationProjectNotesTableError(error)) {
      return {
        error:
          "Project notes are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to delete note." }
  }

  revalidateProjectDetailRoutes(project.project.id)
  return { ok: true }
}

function normalizeProjectQuickLinkName(value: string) {
  return value.trim()
}

function normalizeProjectQuickLinkUrl(value: string) {
  const response: { ok: true; url: string } | { error: string } = (() => {
    const trimmed = value.trim()
    if (!trimmed) {
      return { error: "Add a URL before saving the link." }
    }

    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { error: "Quick links must use an http or https URL." }
      }
      return { ok: true, url: parsed.toString() }
    } catch {
      return { error: "Enter a valid URL for the quick link." }
    }
  })()

  return response
}

function inferQuickLinkType({
  name,
  url,
}: {
  name: string
  url: string
}): OrganizationProjectQuickLinkInsert["link_type"] {
  const haystack = `${name} ${url}`.toLowerCase()

  if (haystack.includes("figma.com")) return "fig"
  if (haystack.includes(".zip")) return "zip"
  if (
    haystack.includes(".doc") ||
    haystack.includes(".docx") ||
    haystack.includes(".gdoc")
  ) {
    return "doc"
  }
  if (haystack.includes(".pdf")) return "pdf"
  return "file"
}

export async function createMemberWorkspaceProjectQuickLinkAction(
  input: MemberWorkspaceCreateProjectQuickLinkInput
): Promise<MemberWorkspaceProjectQuickLinkMutationResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const project = await resolveProjectForDetailMutation({
    actor,
    projectId: input.projectId,
  })

  if ("error" in project) {
    return project
  }

  const name = normalizeProjectQuickLinkName(input.name)
  if (!name) {
    return { error: "Add a title before creating the link." }
  }

  const normalizedUrl = normalizeProjectQuickLinkUrl(input.url)
  if ("error" in normalizedUrl) {
    return normalizedUrl
  }

  const payload: OrganizationProjectQuickLinkInsert = {
    org_id: project.project.org_id,
    project_id: project.project.id,
    name,
    url: normalizedUrl.url,
    link_type: inferQuickLinkType({
      name,
      url: normalizedUrl.url,
    }),
    size_mb: 0,
    created_by: actor.userId,
    updated_by: actor.userId,
  }

  const { data, error } = await actor.supabase
    .from("organization_project_quick_links")
    .insert(payload)
    .select("id")
    .single<{ id: string }>()

  if (error) {
    if (isMissingOrganizationProjectQuickLinksTableError(error)) {
      return {
        error:
          "Project quick links are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to create quick link." }
  }

  revalidateProjectDetailRoutes(project.project.id)
  return { ok: true, linkId: data.id }
}

export async function updateMemberWorkspaceProjectQuickLinkAction(
  input: MemberWorkspaceUpdateProjectQuickLinkInput
): Promise<MemberWorkspaceProjectQuickLinkMutationResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const project = await resolveProjectForDetailMutation({
    actor,
    projectId: input.projectId,
  })

  if ("error" in project) {
    return project
  }

  const name = normalizeProjectQuickLinkName(input.name)
  if (!name) {
    return { error: "Add a title before saving the link." }
  }

  const normalizedUrl = normalizeProjectQuickLinkUrl(input.url)
  if ("error" in normalizedUrl) {
    return normalizedUrl
  }

  const payload: OrganizationProjectQuickLinkUpdate = {
    name,
    url: normalizedUrl.url,
    link_type: inferQuickLinkType({
      name,
      url: normalizedUrl.url,
    }),
    updated_by: actor.userId,
  }

  const { error } = await actor.supabase
    .from("organization_project_quick_links")
    .update(payload)
    .eq("id", input.linkId)
    .eq("project_id", project.project.id)
    .eq("org_id", project.project.org_id)

  if (error) {
    if (isMissingOrganizationProjectQuickLinksTableError(error)) {
      return {
        error:
          "Project quick links are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to update quick link." }
  }

  revalidateProjectDetailRoutes(project.project.id)
  return { ok: true, linkId: input.linkId }
}

export async function deleteMemberWorkspaceProjectQuickLinkAction({
  linkId,
  projectId,
}: {
  linkId: string
  projectId: string
}): Promise<MemberWorkspaceDeleteProjectQuickLinkResult> {
  const actor = await resolveMemberWorkspaceActorContext()
  const project = await resolveProjectForDetailMutation({
    actor,
    projectId,
  })

  if ("error" in project) {
    return project
  }

  const { error } = await actor.supabase
    .from("organization_project_quick_links")
    .delete()
    .eq("id", linkId)
    .eq("project_id", project.project.id)
    .eq("org_id", project.project.org_id)

  if (error) {
    if (isMissingOrganizationProjectQuickLinksTableError(error)) {
      return {
        error:
          "Project quick links are not available until the latest workspace database migrations are applied.",
      }
    }
    return { error: "Unable to delete quick link." }
  }

  revalidateProjectDetailRoutes(project.project.id)
  return { ok: true }
}
