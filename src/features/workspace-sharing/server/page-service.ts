import "server-only"
import { assertPageCanvasManagement } from "./page-canvas-access"

import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { publicSharingEnabled } from "@/lib/feature-flags"
import type { Database } from "@/lib/supabase"
import { workspacePageCommandSchema, workspacePageReviewInputSchema } from "../lib"
import type { WorkspacePageCommand } from "../lib"
import { assertSavedPageSelection, projectWorkspacePage, publicationHash, WorkspaceSharingError } from "./page-projection"
import { committedPageRowSchema, decodeWorkspacePage, loadPageActor, loadSavedPage, loadSavedPageSources } from "./page-context"
import type { PageActor } from "./page-context"
import { resolvePageDriveSources } from "./page-drive-sources"
import { resolvePageImageSources } from "./page-asset-sources"
import { identifyPageImages, uploadPageImages } from "./page-image-publication"

import { resolvePageDocumentSources } from "./page-document-sources"
import { identifyPageDocuments, uploadPageDocuments } from "./page-document-publication"

import { bindPageForms } from "./page-form-publication"

function assertRevision(current: number, expected: number) {
  if (current !== expected) throw new WorkspaceSharingError("conflict", "This page changed. Reload before saving.")
}

async function buildReview(actor: PageActor, input: z.infer<typeof workspacePageReviewInputSchema>) {
  const sources = await loadSavedPageSources(actor, input.canvasId ?? null)
  const drive = await resolvePageDriveSources(actor, { ...sources, draft: input.draft })
  const images = await resolvePageImageSources(actor, { ...sources, draft: input.draft })
  const imageReview = identifyPageImages(images, input.pageId, input.expectedRevision, input.canvasId ?? null)
  const documents = await resolvePageDocumentSources(actor, { ...sources, draft: input.draft })
  const documentReview = identifyPageDocuments(documents, input.pageId, input.expectedRevision, input.canvasId ?? null)
  const snapshot = projectWorkspacePage({
    orgId: actor.orgId, graph: sources.graph, profile: sources.profile,
    publicSlug: sources.public_slug, draft: input.draft, driveLinks: drive.links, imageIds: imageReview.ids, documentIds: documentReview.ids,
  })
  // Asset preparation may take time. Recheck the audience before disclosing a
  // preview or uploading copies; commit independently checks locked authority.
  const current = await loadSavedPageSources(actor, input.canvasId ?? null)
  assertSavedPageSelection(current.graph, actor.orgId, input.draft)
  if (publicationHash(current) !== publicationHash(sources))
    throw new WorkspaceSharingError("conflict", "Saved content changed. Review it again before sharing.")
  await assertPageCanvasManagement(actor, input.canvasId ?? null)
  const formVersions = bindPageForms(snapshot, input.pageId, input.expectedRevision)
  const reviewToken = publicationHash({ orgId: actor.orgId, pageId: input.pageId,
    expectedRevision: input.expectedRevision, canvasId: input.canvasId ?? null, draft: input.draft, snapshot })
  return { sources, snapshot, reviewToken, drive, images, imageReview, documents, documentReview, formVersions }
}

export async function reviewWorkspacePage(input: unknown) {
  const parsed = workspacePageReviewInputSchema.safeParse(input)
  if (!parsed.success) throw new WorkspaceSharingError("invalid", "Review the selected Particles and try again.")
  const actor = await loadPageActor()
  const page = await loadSavedPage(actor, parsed.data.pageId)
  if (page && (page.canvas_id ?? null) !== (parsed.data.canvasId ?? null))
    throw new WorkspaceSharingError("scope", "Open this page from its original workspace.")
  assertRevision(page?.revision ?? 0, parsed.data.expectedRevision)
  const review = await buildReview(actor, parsed.data)
  return {
    page: page ? decodeWorkspacePage(page) : null,
    snapshot: review.snapshot, reviewToken: review.reviewToken, imagePreviews: review.imageReview.previews, documentPreviews: review.documentReview.previews,
  }
}

type CommitArgs = Database["public"]["Functions"]["commit_workspace_page"]["Args"]
async function commit(actor: PageActor, command: WorkspacePageCommand, extra: Partial<CommitArgs> = {}) {
  const admin = createSupabaseAdminClient({ actorId: actor.actorId, requestTimeoutMs: 15_000 })
  const { data, error } = await admin.rpc("commit_workspace_page", {
    p_canvas_id: command.canvasId ?? null,
    p_actor_id: actor.actorId, p_org_id: actor.orgId, p_page_id: command.pageId,
    p_operation_id: command.operationId, p_operation_hash: publicationHash(command),
    p_expected_revision: command.expectedRevision, p_intent: command.intent,
    p_draft: command.intent === "make_private" ? null : command.draft,
    p_snapshot: null, p_expected_graph: null, p_expected_org_updated_at: null,
    ...extra,
  })
  if (error) {
    if (error.code === "40001" || error.code === "23505")
      throw new WorkspaceSharingError("conflict", "This page or workspace changed. Review it again before saving.")
    if (error.code === "42501" && error.message === "Form manager required")
      throw new WorkspaceSharingError("scope", "Only this form's manager can publish it.")
    if (error.code === "42501") throw new WorkspaceSharingError("scope", "You no longer have permission to manage this page.")
    if (error.code === "22023") throw new WorkspaceSharingError("invalid", "This page command is invalid. Reload and try again.")
    throw new WorkspaceSharingError("unavailable", "Unable to confirm this save. Retry the same request before making another change.", true)
  }
  const result = z.object({ page: committedPageRowSchema, replayed: z.boolean() }).parse(data)
  await assertPageCanvasManagement(actor, result.page.canvas_id ?? null)
  return { page: decodeWorkspacePage(result.page), replayed: result.replayed }
}

export async function writeWorkspacePage(input: unknown) {
  const parsed = workspacePageCommandSchema.safeParse(input)
  if (!parsed.success) throw new WorkspaceSharingError("invalid", "Review your page details and try again.")
  const command = parsed.data
  const actor = await loadPageActor()
  await assertPageCanvasManagement(actor, command.canvasId ?? null)
  const page = await loadSavedPage(actor, command.pageId)
  if (page && (page.canvas_id ?? null) !== (command.canvasId ?? null))
    throw new WorkspaceSharingError("scope", "Open this page from its original workspace.")
  // A timed-out successful request can be repeated without loading sources or
  // republishing newer edits. The DB rechecks membership and receipt identity.
  if (page?.last_operation_id === command.operationId)
    return commit(actor, command)
  assertRevision(page?.revision ?? 0, command.expectedRevision)
  if (command.intent === "make_private") return commit(actor, command)
  if ((command.intent === "publish" || command.intent === "share_with_guests")) {
    if (command.intent === "publish" && !publicSharingEnabled)
      throw new WorkspaceSharingError("unavailable", "Public publishing is unavailable. No changes were made.")
    const review = await buildReview(actor, command)
    if (review.reviewToken !== command.reviewToken)
      throw new WorkspaceSharingError("conflict", "Your preview changed. Review the saved content before publishing.")
    const imageAssets = await uploadPageImages(actor, command.pageId, review.images, review.imageReview.ids)
    const documentAssets = await uploadPageDocuments(actor, command.pageId, review.documents, review.documentReview.ids)
    return commit(actor, command, {
      p_image_assets: imageAssets, p_document_assets: documentAssets,
      p_form_versions: JSON.parse(JSON.stringify(review.formVersions)),
      p_snapshot: review.snapshot, p_expected_graph: review.sources.canonicalGraph,
      p_expected_org_updated_at: review.sources.updated_at,
      p_expected_drive_sources: review.drive.checks,
      p_expected_profile: review.drive.expectedProfile,
    })
  }
  const sources = await loadSavedPageSources(actor, command.canvasId ?? null)
  assertSavedPageSelection(sources.graph, actor.orgId, command.draft)
  return commit(actor, command, { p_expected_graph: sources.canonicalGraph })
}
